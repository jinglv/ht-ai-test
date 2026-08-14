# Project ：backend
# File    ：seed.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
种子数据初始化

在数据库迁移完成后执行，创建内置角色、权限点和 admin 账户。
"""
import asyncio
from datetime import datetime

from loguru import logger

from hetu.config import init_db, close_db
from hetu.core.security import hash_password
from hetu.modules.rbac.models import Permission, Role, User
from hetu.shared.enums import DataScope, PermissionType


# 内置角色定义
BUILTIN_ROLES = [
    {
        "name": "超级管理员",
        "code": "super_admin",
        "description": "系统超级管理员，拥有全部权限",
        "data_scope": "all",
        "is_builtin": True,
    },
    {
        "name": "测试经理",
        "code": "test_manager",
        "description": "测试项目经理，可管理项目与成员",
        "data_scope": "project",
        "is_builtin": False,
    },
    {
        "name": "测试工程师",
        "code": "tester",
        "description": "测试工程师，负责编写和执行用例",
        "data_scope": "self",
        "is_builtin": False,
    },
    {
        "name": "需求/产品",
        "code": "product",
        "description": "产品/需求人员，查看测试覆盖情况",
        "data_scope": "project",
        "is_builtin": False,
    },
]

# 内置权限点定义（13个）
BUILTIN_PERMISSIONS = [
    # 菜单权限
    {"name": "首页", "code": "dashboard:view", "type": "menu", "parent_id": None, "sort": 1},
    {"name": "项目管理", "code": "project:menu", "type": "menu", "parent_id": None, "sort": 2},
    {"name": "用例管理", "code": "testcase:menu", "type": "menu", "parent_id": None, "sort": 3},
    {"name": "AI 对话分析", "code": "ai_chat:menu", "type": "menu", "parent_id": None, "sort": 4},
    {"name": "系统管理", "code": "system:menu", "type": "menu", "parent_id": None, "sort": 5},
    # 操作权限
    {"name": "查看项目", "code": "project:view", "type": "action", "parent_id": None, "sort": 10},
    {"name": "创建项目", "code": "project:create", "type": "action", "parent_id": None, "sort": 11},
    {"name": "查看用例", "code": "testcase:view", "type": "action", "parent_id": None, "sort": 20},
    {"name": "创建用例", "code": "testcase:create", "type": "action", "parent_id": None, "sort": 21},
    {"name": "AI 生成用例", "code": "testcase:ai_generate", "type": "action", "parent_id": None, "sort": 22},
    {"name": "管理测试套件", "code": "testsuite:manage", "type": "action", "parent_id": None, "sort": 23},
    {"name": "上传需求文档", "code": "requirement:upload", "type": "action", "parent_id": None, "sort": 24},
    {"name": "AI 对话", "code": "ai_chat:view", "type": "action", "parent_id": None, "sort": 30},
    {"name": "用户管理", "code": "user:manage", "type": "action", "parent_id": None, "sort": 40},
    {"name": "角色管理", "code": "role:manage", "type": "action", "parent_id": None, "sort": 41},
    {"name": "权限管理", "code": "permission:manage", "type": "action", "parent_id": None, "sort": 42},
]

# 默认 admin 账户
ADMIN_USER = {
    "username": "admin",
    "password": "hetu@2026",
    "real_name": "超级管理员",
    "is_super": True,
}


async def seed_roles() -> dict[str, Role]:
    """创建内置角色"""
    role_map = {}
    for role_data in BUILTIN_ROLES:
        role, created = await Role.get_or_create(
            code=role_data["code"],
            defaults={
                "name": role_data["name"],
                "description": role_data["description"],
                "data_scope": role_data["data_scope"],
                "is_builtin": role_data["is_builtin"],
            },
        )
        role_map[role.code] = role
        if created:
            logger.info(f"创建角色: {role.name} ({role.code})")
    return role_map


async def seed_permissions() -> dict[str, Permission]:
    """创建内置权限点"""
    perm_map = {}
    for perm_data in BUILTIN_PERMISSIONS:
        perm, created = await Permission.get_or_create(
            code=perm_data["code"],
            defaults={
                "name": perm_data["name"],
                "type": perm_data["type"],
                "sort": perm_data["sort"],
            },
        )
        perm_map[perm.code] = perm
        if created:
            logger.info(f"创建权限: {perm.name} ({perm.code})")
    return perm_map


async def seed_admin(role_map: dict[str, Role]) -> None:
    """创建默认 admin 账户"""
    existing = await User.get_or_none(username=ADMIN_USER["username"])
    if existing:
        logger.info(f"admin 账户已存在: {existing.username}")
        return

    admin = await User.create(
        username=ADMIN_USER["username"],
        password_hash=hash_password(ADMIN_USER["password"]),
        real_name=ADMIN_USER["real_name"],
        is_active=True,
        is_super=True,
    )

    # 绑定超级管理员角色
    super_role = role_map.get("super_admin")
    if super_role:
        await admin.roles.add(super_role)

    logger.info(f"创建 admin 账户: {admin.username} (密码: {ADMIN_USER['password']})")


async def run_seed() -> None:
    """执行种子数据初始化"""
    logger.info("开始初始化种子数据...")

    from hetu.config import init_db, close_db
    await init_db()

    try:
        role_map = await seed_roles()
        await seed_permissions()
        await seed_admin(role_map)
        logger.info("种子数据初始化完成！")
    except Exception as e:
        logger.error(f"种子数据初始化失败: {e}")
        raise
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(run_seed())
