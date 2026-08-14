# Project ：backend
# File    ：exceptions.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
业务异常类与全局异常处理器

定义统一的业务异常，并通过 FastAPI exception_handler 注册为全局处理。
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from hetu.core.response import fail


class BusinessException(Exception):
    """业务异常基类"""

    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# 常见业务异常快捷构造
class UnauthorizedError(BusinessException):
    """未认证"""

    def __init__(self, message: str = "未登录或 Token 失效"):
        super().__init__(1002, message)


class ForbiddenError(BusinessException):
    """无权限"""

    def __init__(self, message: str = "无操作权限"):
        super().__init__(1003, message)


class NotFoundError(BusinessException):
    """资源不存在"""

    def __init__(self, message: str = "资源不存在"):
        super().__init__(1004, message)


class ConflictError(BusinessException):
    """资源冲突"""

    def __init__(self, message: str = "资源冲突"):
        super().__init__(1005, message)


class BusinessRuleError(BusinessException):
    """业务规则校验失败"""

    def __init__(self, message: str = "业务规则校验失败"):
        super().__init__(1006, message)


class ValidationError(BusinessException):
    """参数校验失败"""

    def __init__(self, message: str = "参数校验失败"):
        super().__init__(1001, message)


class CaptchaError(BusinessException):
    """验证码错误"""

    def __init__(self, message: str = "验证码错误或已过期"):
        super().__init__(2001, message)


class BadCredentialError(BusinessException):
    """用户名密码错误"""

    def __init__(self, message: str = "用户名或密码错误"):
        super().__init__(2002, message)


class AccountDisabledError(BusinessException):
    """账号已禁用"""

    def __init__(self, message: str = "账号已禁用"):
        super().__init__(2003, message)


class AIError(BusinessException):
    """AI 调用失败"""

    def __init__(self, message: str = "AI 调用失败"):
        super().__init__(3001, message)


def register_exception_handlers(app: FastAPI) -> None:
    """注册全局异常处理器"""

    @app.exception_handler(BusinessException)
    async def business_exception_handler(request: Request, exc: BusinessException):
        return JSONResponse(content=fail(exc.code, exc.message), status_code=200)

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        from loguru import logger
        logger.exception("未捕获的异常: {}", exc)
        return JSONResponse(content=fail(5000, "服务器内部错误"), status_code=500)
