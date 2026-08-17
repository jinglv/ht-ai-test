# Project ：backend
# File    ：schemas.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
RBAC 域请求/响应 DTO

使用 Pydantic 模型进行请求验证与响应序列化。
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ===================================通用分页响应==================================
class PaginatedResponse(BaseModel):
    """分页列表响应"""

    items: list = Field(default_factory=list, description="数据列表")
    total: int = Field(default=0, description="总条数")
    page: int = Field(default=1, description="当前页码")
    page_size: int = Field(default=20, description="每页条数")


# ===================================认证相关==================================
class CaptchaResponse(BaseModel):
    """验证码响应"""

    captcha_id: str = Field(description="验证码唯一 ID")
    image: str = Field(description="Base64 编码图片（含 data:image/png;base64, 前缀）")
    expires_in: int = Field(default=300, description="有效期（秒）")


class LoginRequest(BaseModel):
    """登录请求"""

    username: str = Field(min_length=1, max_length=64, description="用户名")
    password: str = Field(min_length=1, max_length=128, description="密码")
    captcha_id: str = Field(description="验证码 ID")
    captcha_code: str = Field(min_length=1, max_length=10, description="验证码内容")
    remember: bool = Field(default=False, description="记住密码（JWT 延长至 30 天）")


class LoginResponse(BaseModel):
    """登录响应"""

    token: str = Field(description="JWT token")
    token_type: str = Field(default="bearer", description="token 类型")
    expires_in: int = Field(description="过期时间（秒）")
    user: "UserMeResponse" = Field(description="当前用户信息")


class ChangePasswordRequest(BaseModel):
    """修改密码请求"""

    old_password: str = Field(min_length=1, description="旧密码")
    new_password: str = Field(min_length=6, max_length=128, description="新密码")


class ProfileUpdateRequest(BaseModel):
    """更新个人信息请求"""

    real_name: Optional[str] = Field(None, max_length=64, description="真实姓名")
    email: Optional[str] = Field(None, max_length=128, description="邮箱")
    phone: Optional[str] = Field(None, max_length=20, description="手机号")
    avatar: Optional[str] = Field(None, max_length=255, description="头像 URL")


class UserMeResponse(BaseModel):
    """当前用户信息"""

    id: int
    username: str
    real_name: str
    email: Optional[str] = None
    avatar: Optional[str] = None
    is_super: bool
    roles: list[dict] = Field(default_factory=list)
    permissions: list[str] = Field(default_factory=list)


# ===================================用户管理==================================
class UserCreateRequest(BaseModel):
    """创建用户请求"""

    username: str = Field(min_length=3, max_length=64, description="登录账号")
    password: str = Field(min_length=6, max_length=128, description="初始密码")
    real_name: str = Field(min_length=1, max_length=64, description="真实姓名")
    email: Optional[str] = Field(None, max_length=128, description="邮箱")
    phone: Optional[str] = Field(None, max_length=20, description="手机号")
    avatar: Optional[str] = Field(None, max_length=255, description="头像 URL")
    is_active: bool = Field(default=True, description="是否启用")
    is_super: bool = Field(default=False, description="是否超级管理员")
    role_ids: list[int] = Field(default_factory=list, description="角色 ID 列表")


class UserUpdateRequest(BaseModel):
    """更新用户请求"""

    real_name: Optional[str] = Field(None, max_length=64)
    email: Optional[str] = Field(None, max_length=128)
    phone: Optional[str] = Field(None, max_length=20)
    avatar: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    is_super: Optional[bool] = None


class UserStatusRequest(BaseModel):
    """启用/禁用用户"""

    is_active: bool = Field(description="目标状态")


class UserResetPasswordRequest(BaseModel):
    """重置密码请求"""

    new_password: str = Field(min_length=6, max_length=128, description="新密码")


class UserRoleUpdateRequest(BaseModel):
    """更新用户角色"""

    role_ids: list[int] = Field(description="角色 ID 列表（全量替换）")


class UserResponse(BaseModel):
    """用户响应"""

    id: int
    username: str
    real_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None
    is_active: bool
    is_super: bool
    last_login_at: Optional[datetime] = None
    roles: list[dict] = Field(default_factory=list)
    created_at: Optional[datetime] = None


# ===================================角色管理==================================
class RoleCreateRequest(BaseModel):
    """创建角色请求"""

    name: str = Field(min_length=1, max_length=64, description="角色名称")
    code: str = Field(min_length=1, max_length=64, description="角色编码")
    description: Optional[str] = Field(None, max_length=255, description="角色描述")
    data_scope: str = Field(default="self", description="数据权限范围: self/project/all")
    permission_ids: list[int] = Field(default_factory=list, description="权限 ID 列表")


class RoleUpdateRequest(BaseModel):
    """更新角色请求"""

    name: Optional[str] = Field(None, max_length=64)
    description: Optional[str] = Field(None, max_length=255)
    data_scope: Optional[str] = None
    permission_ids: list[int] = Field(default_factory=list, description="权限 ID 列表（全量替换）")


class RoleResponse(BaseModel):
    """角色响应"""

    id: int
    name: str
    code: str
    description: Optional[str] = None
    data_scope: str
    is_builtin: bool
    permissions: list[dict] = Field(default_factory=list)
    user_count: int = 0
    created_at: Optional[datetime] = None


# ===================================权限管理==================================
class PermissionCreateRequest(BaseModel):
    """创建权限点请求"""

    name: str = Field(min_length=1, max_length=64)
    code: str = Field(min_length=1, max_length=128)
    type: str = Field(description="权限类型: menu/action/data")
    parent_id: Optional[int] = None
    path: Optional[str] = Field(None, max_length=255)
    icon: Optional[str] = Field(None, max_length=64)
    sort: int = Field(default=0)


class PermissionUpdateRequest(BaseModel):
    """更新权限点请求"""

    name: Optional[str] = Field(None, max_length=64)
    code: Optional[str] = Field(None, max_length=128)
    type: Optional[str] = None
    parent_id: Optional[int] = None
    path: Optional[str] = Field(None, max_length=255)
    icon: Optional[str] = Field(None, max_length=64)
    sort: Optional[int] = None


class PermissionResponse(BaseModel):
    """权限点响应"""

    id: int
    name: str
    code: str
    type: str
    parent_id: Optional[int] = None
    path: Optional[str] = None
    icon: Optional[str] = None
    sort: int = 0
    children: list["PermissionResponse"] = Field(default_factory=list)


class PermissionTreeResponse(BaseModel):
    """权限树响应"""

    items: list[PermissionResponse] = Field(default_factory=list)


# 前向引用
PermissionResponse.model_rebuild()
