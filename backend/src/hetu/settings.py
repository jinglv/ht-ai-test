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
    APP_NAME: str = ""
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = True
    VERSION: str = "1.0.0"
    DESCRIPTION: str = ""

    # ===================================日期时间格式=============================
    DATETIME_FORMAT: str = "%Y-%m-%d %H:%M:%S"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # 忽略未定义的环境变量

    # ===================================数据库配置=============================
    DATABASE_NAME: str = "test_db"
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 3306
    DATABASE_USER: str = "root"
    DATABASE_PASSWORD: str = "test"

    # ===================================LLM 配置=============================
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_API_KEY: str = ""
    LLM_MAX_INPUT_TOKENS: int = 131072  # 模型最大输入 token 数，用于 summarization 中间件自动截断

    # ===================================多模态LLM 配置=============================
    VL_BINDING_HOST: str = "https://api.openai.com/v1"
    VL_MODEL: str = "gpt-4o"
    VL_BINDING_API_KEY: str | None = None  # 视觉模型 API Key
    VL_TIMEOUT: int = 150


def get_settings() -> Settings:
    """获取应用设置实例"""
    return settings


# 创建全局设置实例
settings = Settings()
