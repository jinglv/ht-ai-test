# Project ：backend
# File    ：services.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
RBAC 域业务逻辑服务层

包含：用户、角色、权限的 CRUD 操作与业务校验。
"""
from datetime import datetime
from typing import Any

from loguru import logger
from tortoise.expressions import Q

from hetu.core.exceptions import (
    AccountDisabledError,
    BadCredentialError,
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from hetu.core.security import hash_password, verify_password
from hetu.modules.rbac.models import Permission, Role, User
from hetu.shared.enums import DataScope, PermissionType


# ===================================用户服务==================================
async def get_user_by_username(username: str) -> User | None:
    """根据用户名获取用户"""
    return await User.get_or_none(username=username)


async def get_user_by_id(user_id: int) -> User | None:
    """根据 ID 获取用户"""
    return await User.get_or_none(id=user_id)


async def authenticate(username: str, password: str) -> User:
    """
    认证用户（用户名+密码校验）。

    :raises BadCredentialError: 用户名不存在或密码错误
    :raises AccountDisabledError: 账号已禁用
    """
    user = await get_user_by_username(username)
    if user is None:
        raise BadCredentialError()

    if not verify_password(password, user.password_hash):
        raise BadCredentialError()

    if not user.is_active:
        raise AccountDisabledError()

    # 更新最近登录信息
    user.last_login_at = datetime.now()
    await user.save(update_fields=["last_login_at"])

    logger.info(f"用户登录成功: {user.username}")
    return user


async def create_user(
    username: str,
    password: str,
    real_name: str,
    email: str | None = None,
    phone: str | None = None,
    avatar: str | None = None,
    is_active: bool = True,
    is_super: bool = False,
    role_ids: list[int] | None = None,
) -> User:
    """创建用户"""
    # 检查用户名唯一
    existing = await get_user_by_username(username)
    if existing:
        raise ConflictError(f"用户名 '{username}' 已存在")

    # 检查邮箱唯一
    if email:
        email_user = await User.get_or_none(email=email)
        if email_user:
            raise ConflictError(f"邮箱 '{email}' 已被使用")

    user = await User.create(
        username=username,
        password_hash=hash_password(password),
        real_name=real_name,
        email=email,
        phone=phone,
        avatar=avatar,
        is_active=is_active,
        is_super=is_super,
    )

    # 分配角色
    if role_ids:
        roles = await Role.filter(id__in=role_ids).all()
        await user.roles.add(*roles)

    logger.info(f"创建用户: {username}")
    return user


async def update_user(user_id: int, **kwargs) -> User:
    """更新用户信息"""
    user = await get_user_by_id(user_id)
    if not user:
        raise NotFoundError("用户不存在")

    # 检查邮箱唯一
    if "email" in kwargs and kwargs["email"]:
        email_user = await User.get_or_none(email=kwargs["email"])
        if email_user and email_user.id != user_id:
            raise ConflictError(f"邮箱 '{kwargs['email']}' 已被使用")

    # 如果更新密码，需哈希
    if "password" in kwargs:
        kwargs["password_hash"] = hash_password(kwargs.pop("password"))

    for key, value in kwargs.items():
        if hasattr(user, key):
            setattr(user, key, value)

    await user.save()
    logger.info(f"更新用户: {user.username}")
    return user


async def delete_user(user_id: int) -> None:
    """删除用户（软删除）"""
    user = await get_user_with_roles(user_id)
    if not user:
        raise NotFoundError("用户不存在")

    # 检查是否为内置角色的唯一用户（超管等）
    if user.is_super:
        raise BusinessRuleError("无法删除超级管理员")

    await user.soft_delete()
    logger.info(f"删除用户: {user.username}")


async def set_user_status(user_id: int, is_active: bool) -> User:
    """启用/禁用用户"""
    user = await get_user_by_id(user_id)
    if not user:
        raise NotFoundError("用户不存在")
    user.is_active = is_active
    await user.save(update_fields=["is_active"])
    logger.info(f"用户状态变更: {user.username} -> is_active={is_active}")
    return user


async def reset_user_password(user_id: int, new_password: str) -> None:
    """重置用户密码"""
    user = await get_user_by_id(user_id)
    if not user:
        raise NotFoundError("用户不存在")
    user.password_hash = hash_password(new_password)
    await user.save(update_fields=["password_hash"])
    logger.info(f"重置密码: {user.username}")


async def update_user_roles(user_id: int, role_ids: list[int]) -> User:
    """全量替换用户角色"""
    user = await get_user_with_roles(user_id)
    if not user:
        raise NotFoundError("用户不存在")

    roles = await Role.filter(id__in=role_ids).all()
    await user.roles.clear()
    await user.roles.add(*roles)
    logger.info(f"更新用户角色: {user.username}, 角色数={len(roles)}")
    return user


async def list_users(
    page: int = 1,
    page_size: int = 20,
    keyword: str | None = None,
    is_active: bool | None = None,
) -> dict:
    """分页查询用户列表"""
    qs = User.filter()

    if keyword:
        qs = qs.filter(Q(username__icontains=keyword) | Q(real_name__icontains=keyword))

    if is_active is not None:
        qs = qs.filter(is_active=is_active)

    total = await qs.count()
    offset = (page - 1) * page_size
    users = await qs.offset(offset).limit(page_size).all()

    items = []
    for u in users:
        roles = await u.roles.all()
        items.append({
            "id": u.id,
            "username": u.username,
            "real_name": u.real_name,
            "email": u.email,
            "phone": u.phone,
            "avatar": u.avatar,
            "is_active": u.is_active,
            "is_super": u.is_super,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            "roles": [{"id": r.id, "name": r.name, "code": r.code} for r in roles],
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def get_user_with_roles(user_id: int) -> User | None:
    """获取用户（预加载角色和权限）"""
    return await User.get_or_none(id=user_id).prefetch_related("roles__permissions")


async def get_user_permissions(user: User) -> list[str]:
    """
    获取用户的所有权限码列表。

    超级管理员返回 ["*"]；否则返回所有角色权限码的并集。
    """
    if user.is_super:
        return ["*"]

    permissions = set()
    roles = await user.roles.all().prefetch_related("permissions")
    for role in roles:
        for perm in await role.permissions.all():
            permissions.add(perm.code)
    return list(permissions)


async def get_user_data_scopes(user: User) -> list[DataScope]:
    """获取用户的所有数据权限范围（多角色取最大）"""
    if user.is_super:
        return [DataScope.ALL]

    scopes = set()
    roles = await user.roles.all()
    for role in roles:
        scope_str = role.data_scope or "self"
        try:
            scopes.add(DataScope(scope_str))
        except ValueError:
            scopes.add(DataScope.SELF)

    return list(scopes)


# ===================================角色服务==================================
async def get_role_by_id(role_id: int) -> Role | None:
    """根据 ID 获取角色"""
    return await Role.get_or_none(id=role_id)


async def get_role_by_code(code: str) -> Role | None:
    """根据编码获取角色"""
    return await Role.get_or_none(code=code)


async def create_role(
    name: str,
    code: str,
    description: str | None = None,
    data_scope: str = "self",
    permission_ids: list[int] | None = None,
) -> Role:
    """创建角色"""
    existing = await Role.get_or_none(code=code)
    if existing:
        raise ConflictError(f"角色编码 '{code}' 已存在")

    role = await Role.create(
        name=name,
        code=code,
        description=description,
        data_scope=data_scope,
    )

    if permission_ids:
        perms = await Permission.filter(id__in=permission_ids).all()
        await role.permissions.add(*perms)

    logger.info(f"创建角色: {code}")
    return role


async def update_role(role_id: int, **kwargs) -> Role:
    """更新角色"""
    role = await get_role_by_id(role_id)
    if not role:
        raise NotFoundError("角色不存在")

    # 内置角色保护
    if role.is_builtin:
        if "data_scope" in kwargs:
            raise BusinessRuleError("内置角色的数据权限不可修改")
        if "code" in kwargs:
            raise BusinessRuleError("内置角色编码不可修改")

    # 检查 code 唯一
    if "code" in kwargs and kwargs["code"] != role.code:
        existing = await Role.get_or_none(code=kwargs["code"])
        if existing:
            raise ConflictError(f"角色编码 '{kwargs['code']}' 已存在")

    # 权限替换
    permission_ids = kwargs.pop("permission_ids", None)

    for key, value in kwargs.items():
        if hasattr(role, key):
            setattr(role, key, value)

    await role.save()

    if permission_ids is not None:
        perms = await Permission.filter(id__in=permission_ids).all()
        await role.permissions.clear()
        await role.permissions.add(*perms)

    logger.info(f"更新角色: {role.code}")
    return role


async def delete_role(role_id: int) -> None:
    """删除角色"""
    role = await get_role_by_id(role_id)
    if not role:
        raise NotFoundError("角色不存在")

    if role.is_builtin:
        raise BusinessRuleError("内置角色不可删除")

    # 检查是否有用户占用
    user_count = await role.users.all().count()
    if user_count > 0:
        raise BusinessRuleError(f"角色 '{role.name}' 仍有 {user_count} 个用户，无法删除")

    await role.delete()
    logger.info(f"删除角色: {role.code}")


async def list_roles(page: int = 1, page_size: int = 20, keyword: str | None = None) -> dict:
    """分页查询角色列表"""
    qs = Role.all()

    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(code__icontains=keyword))

    total = await qs.count()
    offset = (page - 1) * page_size
    roles = await qs.offset(offset).limit(page_size).all()

    items = []
    for r in roles:
        user_count = await r.users.all().count()
        perms = await r.permissions.all()
        items.append({
            "id": r.id,
            "name": r.name,
            "code": r.code,
            "description": r.description,
            "data_scope": r.data_scope,
            "is_builtin": r.is_builtin,
            "permissions": [{"id": p.id, "name": p.name, "code": p.code} for p in perms],
            "user_count": user_count,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ===================================权限服务==================================
async def create_permission(**kwargs) -> Permission:
    """创建权限点"""
    existing = await Permission.get_or_none(code=kwargs.get("code"))
    if existing:
        raise ConflictError(f"权限编码 '{kwargs['code']}' 已存在")
    return await Permission.create(**kwargs)


async def update_permission(perm_id: int, **kwargs) -> Permission:
    """更新权限点"""
    perm = await Permission.get_or_none(id=perm_id)
    if not perm:
        raise NotFoundError("权限不存在")

    if "code" in kwargs and kwargs["code"] != perm.code:
        existing = await Permission.get_or_none(code=kwargs["code"])
        if existing:
            raise ConflictError(f"权限编码 '{kwargs['code']}' 已存在")

    for key, value in kwargs.items():
        if hasattr(perm, key):
            setattr(perm, key, value)

    await perm.save()
    logger.info(f"更新权限: {perm.code}")
    return perm


async def delete_permission(perm_id: int) -> None:
    """删除权限点"""
    perm = await Permission.get_or_none(id=perm_id)
    if not perm:
        raise NotFoundError("权限不存在")

    # 检查是否有子权限
    children = await Permission.filter(parent_id=perm_id).count()
    if children > 0:
        raise BusinessRuleError("该权限下有子权限，无法删除")

    await perm.delete()
    logger.info(f"删除权限: {perm.code}")


async def get_permission_tree() -> list[dict]:
    """获取权限树（按类型分组 + 父子层级）"""
    all_perms = await Permission.all().order_by("type", "sort", "id")
    perm_map: dict[int, dict] = {}
    roots: list[dict] = []

    for p in all_perms:
        perm_map[p.id] = {
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "type": p.type,
            "parent_id": p.parent_id,
            "path": p.path,
            "icon": p.icon,
            "sort": p.sort,
            "children": [],
        }

    for p in all_perms:
        node = perm_map[p.id]
        if p.parent_id and p.parent_id in perm_map:
            perm_map[p.parent_id]["children"].append(node)
        else:
            roots.append(node)

    return roots


async def list_permissions(
    page: int = 1,
    page_size: int = 20,
    type_filter: str | None = None,
    keyword: str | None = None,
) -> dict:
    """分页查询权限列表（平铺）"""
    qs = Permission.all()

    if type_filter:
        qs = qs.filter(type=type_filter)
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(code__icontains=keyword))

    total = await qs.count()
    offset = (page - 1) * page_size
    perms = await qs.offset(offset).limit(page_size).all()

    items = []
    for p in perms:
        items.append({
            "id": p.id,
            "name": p.name,
            "code": p.code,
            "type": p.type,
            "parent_id": p.parent_id,
            "path": p.path,
            "icon": p.icon,
            "sort": p.sort,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}
