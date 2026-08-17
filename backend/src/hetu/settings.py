# Project ：backend
# File    ：settings.py
# Author  ：jinglv
# Date    ：2026/7/4 22:09
# Software：PyCharm
"""
应用配置
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ===================================应用基本配置=============================
    APP_NAME: str = "河图智弈"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 9529
    RELOAD: bool = True
    VERSION: str = "v1.0.0"
    DESCRIPTION: str = "企业级AI驱动的测试平台"

    # ===================================安全配置=============================
    SECRET_KEY: str

    # ===================================日期时间格式=============================
    DATETIME_FORMAT: str = "%Y-%m-%d %H:%M:%S"

    # ===================================数据库配置=============================
    DATABASE_NAME: str = "ht_db"
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_USER: str = "postgres"
    DATABASE_PASSWORD: str = ""
    # 开发期自动建表开关（生产环境请关闭）
    DB_GENERATE_SCHEMAS_ON_STARTUP: bool = False

    # ===================================LLM 配置=============================
    LLM_BASE_URL: str = "https://api.deepseek.com"
    LLM_MODEL: str = "deepseek-chat"
    LLM_API_KEY: str = ""
    LLM_MAX_INPUT_TOKENS: int = 131072

    # ===================================多模态LLM 配置=============================
    VL_BINDING_HOST: str = "https://ark.cn-beijing.volces.com/api/v3"
    VL_MODEL: str = "doubao-1-5-vision-pro-32k-250115"
    VL_BINDING_API_KEY: str | None = None
    VL_TIMEOUT: int = 150

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


def get_settings() -> Settings:
    """获取应用设置实例"""
    return settings


# 创建全局设置实例
settings = Settings()
