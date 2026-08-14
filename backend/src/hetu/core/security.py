# Project ：backend
# File    ：security.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
JWT 安全工具

功能:
- JWT token 创建与验证
- bcrypt 密码哈希与校验
"""
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from hetu.settings import settings


def hash_password(password: str) -> str:
    """使用 bcrypt 对密码进行哈希"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """校验密码与 bcrypt 哈希是否匹配"""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(
    user_id: int,
    username: str,
    is_super: bool = False,
    expires_delta: timedelta | None = None,
) -> str:
    """
    创建 JWT access token

    :param user_id: 用户 ID
    :param username: 用户名
    :param is_super: 是否超级管理员
    :param expires_delta: 过期时间增量，默认 7 天；remember=True 时传 30 天
    :return: JWT token 字符串
    """
    if expires_delta is None:
        expires_delta = timedelta(days=7)

    expire = datetime.now(timezone.utc) + expires_delta
    payload = {
        "sub": str(user_id),
        "username": username,
        "is_super": is_super,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    """
    解码 JWT token

    :param token: JWT 字符串
    :return: payload dict 或 None（过期/无效）
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        return None
