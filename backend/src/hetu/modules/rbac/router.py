# Project ：backend
# File    ：router.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
RBAC 域路由

包含：登录/验证码/登出/个人信息 + 用户管理 + 角色管理 + 权限管理
"""
import random
import string
from datetime import timedelta
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from hetu.core.deps import current_user, pagination
from hetu.core.exceptions import (
    AccountDisabledError,
    BadCredentialError,
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from hetu.core.rbac import require_permission
from hetu.core.security import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from hetu.core.response import fail, json_fail, json_ok, paginated
from hetu.modules.rbac.models import User, Role, Permission
from hetu.modules.rbac.schemas import (
    CaptchaResponse,
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    ProfileUpdateRequest,
    UserCreateRequest,
    UserMeResponse,
    UserResetPasswordRequest,
    UserRoleUpdateRequest,
    UserStatusRequest,
    UserUpdateRequest,
)
from hetu.modules.rbac.services import (
    authenticate,
    create_user,
    delete_user,
    get_permission_tree,
    get_user_by_id,
    get_user_permissions,
    get_user_data_scopes,
    list_roles,
    list_users,
    list_permissions,
    reset_user_password,
    set_user_status,
    update_user,
    update_user_roles,
)
from hetu.shared.enums import DataScope

# 验证码内存存储（生产环境替换为 Redis）
_captcha_store: dict[str, str] = {}

router = APIRouter(prefix="/auth", tags=["认证"])


# ===================================认证路由==================================

@router.get("/captcha", summary="获取登录验证码")
async def get_captcha():
    """生成图形验证码，返回 Base64 图片"""
    try:
        from captcha.image import ImageCaptcha
        captcha_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
        captcha_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=16))

        _captcha_store[captcha_id] = captcha_code

        image = ImageCaptcha()
        data = image.generate(captcha_code)
        import base64
        b64 = base64.b64encode(data.read()).decode("utf-8")

        return json_ok(CaptchaResponse(
            captcha_id=captcha_id,
            image=f"data:image/png;base64,{b64}",
            expires_in=300,
        ).model_dump())
    except ImportError:
        # captcha 库未安装时返回纯文本验证码（开发兜底）
        captcha_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=5))
        captcha_id = "".join(random.choices(string.ascii_lowercase + string.digits, k=16))
        _captcha_store[captcha_id] = captcha_code
        return json_ok(CaptchaResponse(
            captcha_id=captcha_id,
            image=captcha_code,  # 兜底：返回文本而非图片
            expires_in=300,
        ).model_dump())


@router.post("/login", summary="登录")
async def login(req: LoginRequest, request: Request):
    """账号密码登录，含验证码校验"""
    # 验证码校验
    stored = _captcha_store.get(req.captcha_id)
    if not stored or stored.upper() != req.captcha_code.upper():
        _captcha_store.pop(req.captcha_id, None)
        raise ValidationError("验证码错误或已过期")

    _captcha_store.pop(req.captcha_id, None)

    # 认证
    user = await authenticate(req.username, req.password)

    # 获取权限和角色
    permissions = await get_user_permissions(user)
    data_scopes = await get_user_data_scopes(user)
    roles_qs = await user.roles.all()
    roles_info = [{"id": r.id, "code": r.code, "name": r.name} for r in roles_qs]

    # 生成 JWT
    expires = timedelta(days=30) if req.remember else timedelta(days=7)
    token = create_access_token(
        user_id=user.id,
        username=user.username,
        is_super=user.is_super,
        expires_delta=expires,
    )

    # 记录登录 IP
    user.last_login_ip = request.client.host if request.client else None
    await user.save(update_fields=["last_login_ip"])

    return json_ok(LoginResponse(
        token=token,
        token_type="bearer",
        expires_in=int(expires.total_seconds()),
        user=UserMeResponse(
            id=user.id,
            username=user.username,
            real_name=user.real_name,
            email=user.email,
            avatar=user.avatar,
            is_super=user.is_super,
            roles=roles_info,
            permissions=permissions,
        ),
    ).model_dump())


@router.post("/logout", summary="退出登录")
async def logout():
    """退出登录（前端清除 token 即可）"""
    return json_ok(message="退出成功")


@router.get("/me", summary="获取当前用户信息")
async def get_me(request: Request, user_data: dict = Depends(current_user)):
    """获取当前登录用户详情（含角色和权限）"""
    user = await get_user_by_id(user_data["user_id"])
    if not user:
        raise NotFoundError("用户不存在")

    permissions = await get_user_permissions(user)
    roles_qs = await user.roles.all()
    roles_info = [{"id": r.id, "code": r.code, "name": r.name} for r in roles_qs]

    return json_ok({
        "id": user.id,
        "username": user.username,
        "real_name": user.real_name,
        "email": user.email,
        "avatar": user.avatar,
        "is_super": user.is_super,
        "roles": roles_info,
        "permissions": permissions,
    })


@router.put("/password", summary="修改密码")
async def change_password(
    request: Request,
    body: ChangePasswordRequest,
    user_data: dict = Depends(current_user),
):
    """修改当前用户密码"""
    user = await get_user_by_id(user_data["user_id"])
    if not user:
        raise NotFoundError("用户不存在")

    if not verify_password(body.old_password, user.password_hash):
        raise ValidationError("旧密码错误")

    user.password_hash = hash_password(body.new_password)
    await user.save(update_fields=["password_hash"])
    return json_ok(message="密码修改成功")


@router.put("/profile", summary="更新个人信息")
async def update_profile(
    request: Request,
    profile: ProfileUpdateRequest,
    user_data: dict = Depends(current_user),
):
    """更新当前用户个人信息"""
    update_data = profile.model_dump(exclude_none=True)
    user = await update_user(user_data["user_id"], **update_data)

    return json_ok({
        "id": user.id,
        "username": user.username,
        "real_name": user.real_name,
        "email": user.email,
        "phone": user.phone,
        "avatar": user.avatar,
    })


# ===================================用户管理路由==================================
users_router = APIRouter(prefix="/users", tags=["用户管理"])


@users_router.get("", summary="用户列表")
async def list_users_api(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str | None = Query(None),
    is_active: bool | None = Query(None),
    user: dict = Depends(require_permission("user:view")),
):
    """分页查询用户列表"""
    result = await list_users(page, page_size, keyword, is_active)
    return json_ok(paginated(result["items"], result["total"], result["page"], result["page_size"]))


@users_router.get("/{user_id}", summary="用户详情")
async def get_user_detail(
    request: Request,
    user_id: int,
    user: dict = Depends(require_permission("user:view")),
):
    """获取单个用户详情"""
    u = await get_user_by_id(user_id)
    if not u:
        raise NotFoundError("用户不存在")

    roles = await u.roles.all()
    return json_ok({
        "id": u.id,
        "username": u.username,
        "real_name": u.real_name,
        "email": u.email,
        "phone": u.phone,
        "avatar": u.avatar,
        "is_active": u.is_active,
        "is_super": u.is_super,
        "roles": [{"id": r.id, "name": r.name, "code": r.code} for r in roles],
        "created_at": u.created_at.isoformat() if u.created_at else None,
    })


@users_router.post("", summary="创建用户")
async def create_user_api(
    request: Request,
    body: UserCreateRequest,
    user: dict = Depends(require_permission("user:create")),
):
    """创建用户"""
    u = await create_user(
        username=body.username,
        password=body.password,
        real_name=body.real_name,
        email=body.email,
        phone=body.phone,
        avatar=body.avatar,
        is_active=body.is_active,
        is_super=body.is_super,
        role_ids=body.role_ids,
    )
    return json_ok({"id": u.id, "username": u.username}, "创建成功")


@users_router.put("/{user_id}", summary="更新用户")
async def update_user_api(
    request: Request,
    user_id: int,
    body: UserUpdateRequest,
    user: dict = Depends(require_permission("user:update")),
):
    """更新用户信息"""
    update_data = body.model_dump(exclude_none=True)
    u = await update_user(user_id, **update_data)
    return json_ok({"id": u.id}, "更新成功")


@users_router.delete("/{user_id}", summary="删除用户")
async def delete_user_api(
    request: Request,
    user_id: int,
    user: dict = Depends(require_permission("user:delete")),
):
    """删除用户（软删除）"""
    await delete_user(user_id)
    return json_ok(message="删除成功")


@users_router.patch("/{user_id}/status", summary="启用/禁用用户")
async def toggle_user_status(
    request: Request,
    user_id: int,
    body: UserStatusRequest,
    user: dict = Depends(require_permission("user:update")),
):
    """切换用户启用/禁用状态"""
    u = await set_user_status(user_id, body.is_active)
    return json_ok({"id": u.id, "is_active": u.is_active}, "状态更新成功")


@users_router.post("/{user_id}/reset-password", summary="重置密码")
async def reset_password_api(
    request: Request,
    user_id: int,
    body: UserResetPasswordRequest,
    user: dict = Depends(require_permission("user:update")),
):
    """管理员重置用户密码"""
    await reset_user_password(user_id, body.new_password)
    return json_ok(message="密码重置成功")


@users_router.put("/{user_id}/roles", summary="更新用户角色")
async def update_user_roles_api(
    request: Request,
    user_id: int,
    body: UserRoleUpdateRequest,
    user: dict = Depends(require_permission("user:update")),
):
    """全量替换用户角色"""
    u = await update_user_roles(user_id, body.role_ids)
    return json_ok({"id": u.id}, "角色更新成功")


# ===================================角色管理路由==================================
roles_router = APIRouter(prefix="/roles", tags=["角色管理"])


@roles_router.get("", summary="角色列表")
async def list_roles_api(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str | None = Query(None),
    user: dict = Depends(require_permission("role:view")),
):
    """分页查询角色列表"""
    result = await list_roles(page, page_size, keyword)
    return json_ok(paginated(result["items"], result["total"], result["page"], result["page_size"]))


@roles_router.get("/{role_id}", summary="角色详情")
async def get_role_detail(
    request: Request,
    role_id: int,
    user: dict = Depends(require_permission("role:view")),
):
    """获取单个角色详情"""
    role = await get_role_by_id(role_id)
    if not role:
        raise NotFoundError("角色不存在")

    perms = await role.permissions.all()
    user_count = await role.users.all().count()
    return json_ok({
        "id": role.id,
        "name": role.name,
        "code": role.code,
        "description": role.description,
        "data_scope": role.data_scope,
        "is_builtin": role.is_builtin,
        "permissions": [{"id": p.id, "name": p.name, "code": p.code} for p in perms],
        "user_count": user_count,
        "created_at": role.created_at.isoformat() if role.created_at else None,
    })


@roles_router.post("", summary="创建角色")
async def create_role_api(
    request: Request,
    body: "RoleCreateRequest",
    user: dict = Depends(require_permission("role:create")),
):
    """创建角色"""
    role = await create_role(
        name=body.name,
        code=body.code,
        description=body.description,
        data_scope=body.data_scope,
        permission_ids=body.permission_ids,
    )
    return json_ok({"id": role.id}, "创建成功")


@roles_router.put("/{role_id}", summary="更新角色")
async def update_role_api(
    request: Request,
    role_id: int,
    body: "RoleUpdateRequest",
    user: dict = Depends(require_permission("role:update")),
):
    """更新角色"""
    update_data = body.model_dump(exclude_none=True)
    role = await update_role(role_id, **update_data)
    return json_ok({"id": role.id}, "更新成功")


@roles_router.delete("/{role_id}", summary="删除角色")
async def delete_role_api(
    request: Request,
    role_id: int,
    user: dict = Depends(require_permission("role:delete")),
):
    """删除角色"""
    await delete_role(role_id)
    return json_ok(message="删除成功")


@roles_router.put("/{role_id}/permissions", summary="绑定权限")
async def bind_permissions(
    request: Request,
    role_id: int,
    body: "RoleUpdateRequest",
    user: dict = Depends(require_permission("role:update")),
):
    """为角色绑定/替换权限"""
    role = await update_role(role_id, permission_ids=body.permission_ids)
    return json_ok({"id": role.id}, "权限绑定成功")


# ===================================权限管理路由==================================
permissions_router = APIRouter(prefix="/permissions", tags=["权限管理"])


@permissions_router.get("/tree", summary="权限树")
async def get_permission_tree_api(
    request: Request,
    user: dict = Depends(require_permission("permission:view")),
):
    """获取树形权限列表（按类型 + 父子层级）"""
    tree = await get_permission_tree()
    return json_ok(tree)


@permissions_router.get("", summary="权限列表")
async def list_permissions_api(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    type: str | None = Query(None, description="筛选类型: menu/action/data"),
    keyword: str | None = Query(None),
    user: dict = Depends(require_permission("permission:view")),
):
    """分页查询权限列表（平铺）"""
    result = await list_permissions(page, page_size, type, keyword)
    return json_ok(paginated(result["items"], result["total"], result["page"], result["page_size"]))


@permissions_router.post("", summary="创建权限点")
async def create_permission_api(
    request: Request,
    body: "PermissionCreateRequest",
    user: dict = Depends(require_permission("permission:create")),
):
    """创建权限点"""
    from hetu.modules.rbac.schemas import PermissionCreateRequest
    body_parsed = PermissionCreateRequest(**body.model_dump())

    perm = await create_permission(**body_parsed.model_dump())
    return json_ok({"id": perm.id}, "创建成功")


@permissions_router.put("/{perm_id}", summary="更新权限点")
async def update_permission_api(
    request: Request,
    perm_id: int,
    body: "PermissionUpdateRequest",
    user: dict = Depends(require_permission("permission:update")),
):
    """更新权限点"""
    from hetu.modules.rbac.schemas import PermissionUpdateRequest
    body_parsed = PermissionUpdateRequest(**body.model_dump())

    update_data = body_parsed.model_dump(exclude_none=True)
    perm = await update_permission(perm_id, **update_data)
    return json_ok({"id": perm.id}, "更新成功")


@permissions_router.delete("/{perm_id}", summary="删除权限点")
async def delete_permission_api(
    request: Request,
    perm_id: int,
    user: dict = Depends(require_permission("permission:delete")),
):
    """删除权限点"""
    await delete_permission(perm_id)
    return json_ok(message="删除成功")
