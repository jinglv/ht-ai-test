# Project ：backend
# File    ：response.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
统一响应结构

所有接口统一返回 {code, message, data} 格式。
"""
from typing import Any

from fastapi.responses import JSONResponse


def success(data: Any = None, message: str = "success") -> dict:
    """成功响应"""
    return {"code": 0, "message": message, "data": data}


def fail(code: int, message: str, data: Any = None) -> dict:
    """失败响应"""
    return {"code": code, "message": message, "data": data}


def json_ok(data: Any = None, message: str = "success", status_code: int = 200) -> JSONResponse:
    """FastAPI JSONResponse 成功"""
    return JSONResponse(content=success(data, message), status_code=status_code)


def json_fail(code: int, message: str, data: Any = None, status_code: int = 400) -> JSONResponse:
    """FastAPI JSONResponse 失败"""
    return JSONResponse(content=fail(code, message, data), status_code=status_code)


def paginated(items: list, total: int, page: int, page_size: int) -> dict:
    """分页列表响应"""
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
