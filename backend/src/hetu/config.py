# Project ：backend
# File    ：config.py
# Author  ：jinglv
# Date    ：2026/7/4 22:09
# Software：PyCharm
"""
数据库初始化与配置

功能:
- Tortoise ORM 初始化（asyncpg 驱动，PostgreSQL）
- 数据库连接/关闭管理
- 连接串由 settings 中 DATABASE_* 字段拼接
"""
from loguru import logger
from tortoise import Tortoise

from hetu.settings import settings

# ==================================ORM 配置==============================
TORTOISE_ORM = {
    "connections": {
        "default": f"postgres://{settings.DATABASE_USER}:{settings.DATABASE_PASSWORD}"
                   f"@{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.DATABASE_NAME}"
    },
    "apps": {
        "models": {  # 统一的 app label
            "models": [
                "hetu.modules.rbac.models",
                "hetu.modules.project.models",
                "hetu.modules.testcase.models",
                "hetu.modules.ai_chat.models",
            ],
            "default_connection": "default",
            "migrations": "migrations",
        },
    },
    "use_tz": False,
    "timezone": "Asia/Shanghai",
}


# ===================================生命周期=============================
async def init_db() -> None:
    """
    初始化数据库连接。

    表结构由迁移命令管理；仅在显式开启 DB_GENERATE_SCHEMAS_ON_STARTUP 时，
    才允许 Tortoise 为本地临时环境自动建表。
    """
    await Tortoise.init(config=TORTOISE_ORM, _enable_global_fallback=True)
    if settings.DB_GENERATE_SCHEMAS_ON_STARTUP:
        await Tortoise.generate_schemas()
    logger.info(
        f"数据库初始化完成: "
        f"{settings.DATABASE_HOST}:{settings.DATABASE_PORT}/{settings.DATABASE_NAME}"
    )


async def close_db() -> None:
    """关闭数据库连接"""
    await Tortoise.close_connections()
    logger.info("数据库连接已关闭")
