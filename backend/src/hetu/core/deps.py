# Project ：backend
# File    ：deps.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
FastAPI 依赖注入

提供当前用户、分页参数等常用依赖。
"""
from typing import Optional

from fastapi import Depends, HTTPException, Query, Request

from hetu.core.exceptions import UnauthorizedError
from hetu.core.rbac import get_current_user


async def current_user(request: Request):
    """
    获取当前登录用户（FastAPI 依赖）。

    使用方式:
        async def get_users(user = Depends(current_user)):
            ...
    """
    user = await get_current_user(request)
    return user


def pagination(
    page: int = Query(1, ge=1, description="页码，从1开始"),
    page_size: int = Query(20, ge=1, le=100, description="每页条数"),
):
    """分页参数依赖"""
    return {"page": page, "page_size": page_size}


def ordering(
    ordering: Optional[str] = Query(None, description="排序字段，逗号分隔，前缀 - 表示降序"),
):
    """排序参数依赖"""
    if not ordering:
        return []
    fields = [f.strip() for f in ordering.split(",") if f.strip()]
    return fields
