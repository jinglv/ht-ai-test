# Project ：backend
# File    ：rbac.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
RBAC 权限装饰器与数据权限依赖注入
"""
from typing import Callable

from fastapi import Depends, HTTPException, Request

from hetu.core.exceptions import ForbiddenError
from hetu.core.security import decode_token
from hetu.shared.enums import DataScope


async def get_current_user(request: Request) -> dict:
    """
    从请求头 Authorization 中解析 JWT，返回当前用户信息。

    返回 dict 包含: user_id, username, is_super
    未认证时抛 401。
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录或 Token 失效")

    token = auth_header[7:]
    payload = decode_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Token 无效或已过期")

    return {
        "user_id": int(payload["sub"]),
        "username": payload["username"],
        "is_super": payload.get("is_super", False),
    }


def require_permission(permission_code: str):
    """
    权限校验依赖工厂（FastAPI 风格）。

    用法:
        @router.get("/users")
        async def list_users(user = Depends(require_permission("user:view"))):
            ...

    超级管理员拥有全部权限（permissions 包含 "*"）。
    """
    async def _check(request: Request):
        user = await get_current_user(request)

        # 超级管理员拥有全部权限
        if user.get("is_super"):
            user["permissions"] = ["*"]
            user["data_scopes"] = [DataScope.ALL]
            return user

        # 从数据库获取用户完整权限信息
        from hetu.modules.rbac.models import User
        from hetu.modules.rbac.services import get_user_permissions, get_user_data_scopes

        db_user = await User.get_or_none(id=user["user_id"]).prefetch_related("roles__permissions")
        if not db_user:
            raise HTTPException(status_code=401, detail="用户不存在")

        permissions = await get_user_permissions(db_user)
        data_scopes = await get_user_data_scopes(db_user)

        if "*" not in permissions and permission_code not in permissions:
            raise ForbiddenError(f"缺少权限: {permission_code}")

        user["permissions"] = permissions
        user["data_scopes"] = [ds.value for ds in data_scopes]
        return user

    return _check


async def get_data_scope(current_user: dict, project_member_projects: list[int] | None = None) -> DataScope:
    """
    确定当前用户的数据权限范围。

    数据权限绑定在用户的角色上，多角色取最大范围。
    超级管理员固定为 ALL。

    :param current_user: 当前用户信息（含 user_id, is_super, data_scopes 列表）
    :param project_member_projects: 当前用户所属项目 ID 列表（PROJECT 范围用）
    :return: DataScope 枚举值
    """
    if current_user.get("is_super"):
        return DataScope.ALL

    # 取用户所有角色的 data_scope 最大值
    user_scopes = current_user.get("data_scopes", ["self"])
    if "all" in user_scopes:
        return DataScope.ALL
    if "project" in user_scopes:
        return DataScope.PROJECT
    return DataScope.SELF


async def apply_data_scope_filter(
    queryset,
    scope: DataScope,
    current_user: dict,
    project_member_projects: list[int] | None = None,
    creator_field: str = "creator_id",
    project_field: str = "project_id",
):
    """
    根据数据权限范围向 queryset 注入过滤条件（异步版本）。

    :param queryset: Tortoise-ORM queryset
    :param scope: 数据权限范围
    :param current_user: 当前用户信息（含 user_id）
    :param project_member_projects: 用户所属项目列表（PROJECT 范围用）
    :param creator_field: 创建人字段名（SELF 范围用）
    :param project_field: 项目字段名（PROJECT 范围用）
    :return: 过滤后的 queryset
    """
    if scope == DataScope.ALL:
        return queryset
    if scope == DataScope.PROJECT:
        if not project_member_projects:
            return queryset.none()
        return queryset.filter(**{f"{project_field}__in": project_member_projects})
    # SELF
    return queryset.filter(**{creator_field: current_user["user_id"]})


async def get_user_project_ids(user_id: int) -> list[int]:
    """
    获取用户所属的所有项目 ID 列表（作为成员）。
    """
    from hetu.modules.project.models import ProjectMember

    rows = await ProjectMember.filter(user_id=user_id).values_list("project_id", flat=True)
    return list(rows)
