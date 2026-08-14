# Project ：backend
# File    ：schemas.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
项目域请求/响应 DTO
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from hetu.shared.enums import ProjectRole, ProjectStatus


# ===================================项目==================================
class ProjectCreateRequest(BaseModel):
    """创建项目"""

    code: str = Field(min_length=1, max_length=64, description="项目编号")
    name: str = Field(min_length=1, max_length=128, description="项目名称")
    owner_id: int = Field(description="负责人 ID")
    status: str = Field(default="planning", description="项目状态")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None


class ProjectUpdateRequest(BaseModel):
    """更新项目"""

    name: Optional[str] = Field(None, max_length=128)
    owner_id: Optional[int] = None
    status: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    """项目响应"""

    id: int
    code: str
    name: str
    owner_id: int
    owner_name: Optional[str] = None
    status: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    description: Optional[str] = None
    member_count: int = 0
    testcase_count: int = 0
    created_at: Optional[datetime] = None


class ProjectOverviewResponse(BaseModel):
    """项目概览统计"""

    id: int
    code: str
    name: str
    testcase_total: int = 0
    testcase_passed: int = 0
    testcase_failed: int = 0
    testcase_pass_rate: float = 0.0
    member_count: int = 0
    suite_count: int = 0
    recent_executions: list[dict] = []


# ===================================模块==================================
class ModuleCreateRequest(BaseModel):
    """创建模块"""

    name: str = Field(min_length=1, max_length=128, description="模块名称")
    parent_id: Optional[int] = None


class ModuleUpdateRequest(BaseModel):
    """更新模块"""

    name: Optional[str] = Field(None, max_length=128)
    parent_id: Optional[int] = None


class ModuleResponse(BaseModel):
    """模块响应"""

    id: int
    project_id: int
    parent_id: Optional[int] = None
    name: str
    sort: int = 0
    children: list["ModuleResponse"] = []
    testcase_count: int = 0


# ===================================成员==================================
class MemberCreateRequest(BaseModel):
    """添加成员"""

    user_id: int = Field(description="用户 ID")
    project_role: str = Field(description="项目角色: owner/tester/viewer")


class MemberUpdateRequest(BaseModel):
    """更新成员角色"""

    project_role: str = Field(description="项目角色: owner/tester/viewer")


class MemberResponse(BaseModel):
    """成员响应"""

    id: int
    project_id: int
    user_id: int
    username: str
    real_name: str
    avatar: Optional[str] = None
    project_role: str
    created_at: Optional[datetime] = None


ModuleResponse.model_rebuild()
