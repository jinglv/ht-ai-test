# Project ：backend
# File    ：main.py
# Author  ：jinglv
# Date    ：2026/7/3 16:08
# Software：PyCharm
"""
河图智弈 FastAPI 应用入口

本文件作为 ASGI 入口，FastAPI 应用实例通过 ``main:app`` 暴露。
启动方式：``uv run uvicorn main:app --reload``（在 backend/ 目录下执行）

功能:
- 初始化 Tortoise ORM 数据库连接
- 注册各业务域路由
- 注册全局异常处理器
- 健康检查 + 服务信息端点
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from hetu.config import init_db, close_db
from hetu.core.exceptions import register_exception_handlers
from hetu.core.response import json_ok
from hetu.modules.project.router import (
    members_router,
    modules_router,
    projects_router,
)
from hetu.modules.rbac.router import (
    permissions_router,
    roles_router,
    router as auth_router,
    users_router,
)
from hetu.modules.testcase.router import (
    ai_generate_router,
    executions_router,
    requirements_router,
    suites_router,
    testcase_router,
)
from hetu.modules.ai_chat.router import ai_router
from hetu.settings import settings


# ===================================应用生命周期=============================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理：启动时初始化数据库，关闭时清理连接。"""
    await init_db()
    yield
    await close_db()


# ==================创建 FastAPI 应用实例=================
app = FastAPI(
    title="河图智弈 API",
    description="企业级 AI 智能体测试平台",
    version="v1.0.0",
    lifespan=lifespan,
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境替换为实际前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册全局异常处理器
register_exception_handlers(app)

# 注册路由（统一前缀 /api/v1）
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(roles_router, prefix="/api/v1")
app.include_router(permissions_router, prefix="/api/v1")
app.include_router(projects_router, prefix="/api/v1")
app.include_router(modules_router, prefix="/api/v1")
app.include_router(members_router, prefix="/api/v1")
app.include_router(testcase_router, prefix="/api/v1")
app.include_router(suites_router, prefix="/api/v1")
app.include_router(requirements_router, prefix="/api/v1")
app.include_router(executions_router, prefix="/api/v1")
app.include_router(ai_generate_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")


# 健康检查
@app.get("/health", tags=["系统"])
async def health_check():
    return json_ok({"status": "ok", "service": "hetu-api", "version": "v1.0.0"})


@app.get("/", tags=["系统"])
async def root():
    return json_ok({"message": "河图智弈 API 服务", "version": "v1.0.0"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
    )
