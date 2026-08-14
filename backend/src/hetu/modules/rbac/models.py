# Project ：backend
# File    ：models.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
RBAC 域模型

包含：用户 (User)、角色 (Role)、权限点 (Permission)
以及多对多关联表 (user_role, role_permission)。
"""
from tortoise import fields
from tortoise.models import Model

from hetu.shared.enums import PermissionType
from hetu.shared.models import TimestampMixin


class User(TimestampMixin, Model):
    """用户表"""

    id = fields.IntField(pk=True)
    username = fields.CharField(max_length=64, unique=True, description="登录账号")
    password_hash = fields.CharField(max_length=128, description="bcrypt 哈希")
    real_name = fields.CharField(max_length=64, description="真实姓名")
    email = fields.CharField(max_length=128, null=True, unique=True, description="邮箱")
    phone = fields.CharField(max_length=20, null=True, description="手机号")
    avatar = fields.CharField(max_length=255, null=True, description="头像 URL")
    is_active = fields.BooleanField(default=True, description="启用状态")
    is_super = fields.BooleanField(default=False, description="超级管理员标记")
    last_login_at = fields.DatetimeField(null=True, description="最近登录时间")
    last_login_ip = fields.CharField(max_length=45, null=True, description="最近登录 IP")

    # 多对多关系
    roles: fields.ManyToManyRelation["Role"] = fields.ManyToManyField(
        "models.Role",
        through="user_role",
        related_name="users",
        description="用户-角色关联",
    )

    class Meta:
        table = "user"
        table_description = "用户"
        indexes = (("username",), ("email",))

    def __str__(self) -> str:
        return f"{self.username}({self.real_name})"


class Role(TimestampMixin, Model):
    """角色表：含数据权限范围（PRD §3.1.4）"""

    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=64, unique=True, description="角色名称")
    code = fields.CharField(max_length=64, unique=True, description="角色编码")
    description = fields.CharField(max_length=255, null=True, description="角色描述")
    data_scope = fields.CharField(
        max_length=20, default="self", description="数据权限范围: self/project/all"
    )
    is_builtin = fields.BooleanField(default=False, description="内置角色不可删除")

    # 多对多关系
    permissions: fields.ManyToManyRelation["Permission"] = fields.ManyToManyField(
        "models.Permission",
        through="role_permission",
        related_name="roles",
        description="角色-权限关联",
    )
    users: fields.ManyToManyRelation["User"]

    class Meta:
        table = "role"
        table_description = "角色"
        indexes = (("code",),)

    def __str__(self) -> str:
        return self.name


class Permission(TimestampMixin, Model):
    """权限点表：菜单/操作/数据三类，树形结构"""

    id = fields.IntField(pk=True)
    name = fields.CharField(max_length=64, description="权限名称")
    code = fields.CharField(max_length=128, unique=True, description="权限编码 domain:action")
    type = fields.CharField(
        max_length=20, description="权限类型: menu/action/data"
    )
    parent = fields.ForeignKeyField(
        "models.Permission",
        null=True,
        related_name="children",
        on_delete=fields.NO_ACTION,
        description="父权限",
    )
    path = fields.CharField(max_length=255, null=True, description="前端路由")
    icon = fields.CharField(max_length=64, null=True, description="菜单图标")
    sort = fields.IntField(default=0, description="排序")

    class Meta:
        table = "permission"
        table_description = "权限点"
        indexes = (("type", "parent_id"),)


