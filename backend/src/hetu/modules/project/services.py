# Project ：backend
# File    ：services.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
项目域业务逻辑服务层

包含：项目 CRUD、模块树管理、成员管理、项目概览统计。
"""
from datetime import datetime
from typing import Any

from loguru import logger
from tortoise.expressions import Q

from hetu.core.exceptions import (
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from hetu.core.rbac import apply_data_scope_filter, get_data_scope, get_user_project_ids
from hetu.modules.project.models import Project, ProjectMember, ProjectModule
from hetu.modules.testcase.models import TestCase, TestExecution
from hetu.shared.enums import DataScope


# ===================================项目服务==================================
async def get_project_by_id(project_id: int) -> Project | None:
    """根据 ID 获取项目"""
    return await Project.get_or_none(id=project_id, is_deleted=False)


async def get_project_by_code(code: str) -> Project | None:
    """根据编号获取项目"""
    return await Project.get_or_none(code=code, is_deleted=False)


async def create_project(
    code: str,
    name: str,
    owner_id: int,
    status: str = "planning",
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    description: str | None = None,
) -> Project:
    """创建项目"""
    existing = await get_project_by_code(code)
    if existing:
        raise ConflictError(f"项目编号 '{code}' 已存在")

    project = await Project.create(
        code=code,
        name=name,
        owner_id=owner_id,
        status=status,
        start_date=start_date,
        end_date=end_date,
        description=description,
    )

    # 创建者为项目负责人
    await ProjectMember.create(
        project_id=project.id,
        user_id=owner_id,
        project_role="owner",
    )

    logger.info(f"创建项目: {code}")
    return project


async def update_project(project_id: int, **kwargs) -> Project:
    """更新项目"""
    project = await get_project_by_id(project_id)
    if not project:
        raise NotFoundError("项目不存在")

    # 归档项目只读，不允许修改
    if project.status == "archived":
        raise BusinessRuleError("已归档项目只读，不可修改")

    if "code" in kwargs and kwargs["code"] != project.code:
        existing = await get_project_by_code(kwargs["code"])
        if existing:
            raise ConflictError(f"项目编号 '{kwargs['code']}' 已存在")

    for key, value in kwargs.items():
        if hasattr(project, key):
            setattr(project, key, value)

    await project.save()
    logger.info(f"更新项目: {project.code}")
    return project


async def archive_project(project_id: int) -> Project:
    """归档项目"""
    project = await get_project_by_id(project_id)
    if not project:
        raise NotFoundError("项目不存在")
    project.status = "archived"
    await project.save(update_fields=["status"])
    logger.info(f"归档项目: {project.code}")
    return project


async def delete_project(project_id: int) -> None:
    """删除项目（软删除）"""
    project = await get_project_by_id(project_id)
    if not project:
        raise NotFoundError("项目不存在")
    await project.soft_delete()
    logger.info(f"删除项目: {project.code}")


async def list_projects(
    page: int = 1,
    page_size: int = 20,
    keyword: str | None = None,
    status: str | None = None,
    user: dict | None = None,
) -> dict:
    """分页查询项目列表"""
    qs = Project.filter(is_deleted=False)

    # 数据权限过滤：项目以 owner_id / 成员关系关联
    if user:
        scope = await get_data_scope(user)
        if scope == DataScope.SELF:
            qs = qs.filter(owner_id=user["user_id"])
        elif scope == DataScope.PROJECT:
            project_ids = await get_user_project_ids(user["user_id"])
            if project_ids:
                qs = qs.filter(id__in=project_ids)
            else:
                return {"items": [], "total": 0, "page": page, "page_size": page_size}

    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(code__icontains=keyword))
    if status:
        qs = qs.filter(status=status)

    total = await qs.count()
    offset = (page - 1) * page_size
    projects = await qs.offset(offset).limit(page_size).all()

    items = []
    for p in projects:
        owner = await p.owner
        member_count = await p.members.all().count()
        testcase_count = await p.testcases.all().count()
        items.append({
            "id": p.id,
            "code": p.code,
            "name": p.name,
            "owner_id": p.owner_id,
            "owner_name": owner.real_name if owner else "",
            "status": p.status,
            "start_date": p.start_date.isoformat() if p.start_date else None,
            "end_date": p.end_date.isoformat() if p.end_date else None,
            "description": p.description,
            "member_count": member_count,
            "testcase_count": testcase_count,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def get_project_overview(project_id: int, user: dict | None = None) -> dict:
    """项目概览统计"""
    project = await get_project_by_id(project_id)
    if not project:
        raise NotFoundError("项目不存在")

    # 数据权限校验：确保用户有权限访问该项目
    if user:
        scope = await get_data_scope(user)
        if scope == DataScope.SELF and project.owner_id != user["user_id"]:
            raise NotFoundError("项目不存在")
        elif scope == DataScope.PROJECT:
            member_projects = await get_user_project_ids(user["user_id"])
            if project_id not in member_projects:
                raise NotFoundError("项目不存在")

    testcases = await TestCase.filter(project_id=project_id, is_deleted=False)
    total = len(testcases)
    passed = sum(1 for tc in testcases if tc.status == "approved")
    pass_rate = (passed / total * 100) if total > 0 else 0.0

    member_count = await project.members.all().count()
    suite_count = await project.suites.filter(is_deleted=False).count()

    # 最近执行记录
    executions = await TestExecution.filter(
        testcase__project_id=project_id
    ).order_by("-executed_at").limit(10).prefetch_related("testcase", "executed_by")
    recent = []
    for ex in executions:
        recent.append({
            "id": ex.id,
            "testcase_id": ex.testcase_id,
            "testcase_title": ex.testcase.title if ex.testcase else "",
            "result": ex.result,
            "executed_by": ex.executed_by.real_name if ex.executed_by else "",
            "executed_at": ex.executed_at.isoformat(),
        })

    return {
        "id": project.id,
        "code": project.code,
        "name": project.name,
        "testcase_total": total,
        "testcase_passed": passed,
        "testcase_failed": total - passed,
        "testcase_pass_rate": round(pass_rate, 1),
        "member_count": member_count,
        "suite_count": suite_count,
        "recent_executions": recent,
    }


# ===================================模块服务==================================
async def get_module_by_id(module_id: int) -> ProjectModule | None:
    """根据 ID 获取模块"""
    return await ProjectModule.get_or_none(id=module_id)


async def create_module(project_id: int, name: str, parent_id: int | None = None) -> ProjectModule:
    """创建模块"""
    project = await get_project_by_id(project_id)
    if not project:
        raise NotFoundError("项目不存在")

    if project.status == "archived":
        raise BusinessRuleError("已归档项目不可添加模块")

    module = await ProjectModule.create(
        project_id=project_id,
        name=name,
        parent_id=parent_id,
    )
    logger.info(f"创建模块: {name} (项目: {project.code})")
    return module


async def update_module(module_id: int, **kwargs) -> ProjectModule:
    """更新模块"""
    module = await get_module_by_id(module_id)
    if not module:
        raise NotFoundError("模块不存在")

    for key, value in kwargs.items():
        if hasattr(module, key):
            setattr(module, key, value)

    await module.save()
    return module


async def delete_module(module_id: int) -> None:
    """删除模块"""
    module = await get_module_by_id(module_id)
    if not module:
        raise NotFoundError("模块不存在")

    # 检查是否有子模块
    children = await ProjectModule.filter(parent_id=module_id).count()
    if children > 0:
        raise BusinessRuleError("该模块下有子模块，无法删除")

    # 检查是否有用例关联
    case_count = await module.testcases.all().count()
    if case_count > 0:
        raise BusinessRuleError(f"该模块下有 {case_count} 个用例，无法删除")

    await module.delete()
    logger.info(f"删除模块: {module.name}")


async def list_modules(project_id: int, user: dict | None = None) -> list[dict]:
    """获取项目模块树"""
    # 数据权限：检查用户是否有权访问该项目
    if user:
        scope = await get_data_scope(user)
        project = await get_project_by_id(project_id)
        if not project:
            return []
        if scope == DataScope.SELF and project.owner_id != user["user_id"]:
            return []
        elif scope == DataScope.PROJECT:
            member_projects = await get_user_project_ids(user["user_id"])
            if project_id not in member_projects:
                return []

    modules = await ProjectModule.filter(project_id=project_id).all()
    mod_map: dict[int, dict] = {}
    roots: list[dict] = []

    for m in modules:
        case_count = await m.testcases.all().count()
        mod_map[m.id] = {
            "id": m.id,
            "project_id": m.project_id,
            "parent_id": m.parent_id,
            "name": m.name,
            "sort": m.sort,
            "testcase_count": case_count,
            "children": [],
        }

    for m in modules:
        node = mod_map[m.id]
        if m.parent_id and m.parent_id in mod_map:
            mod_map[m.parent_id]["children"].append(node)
        else:
            roots.append(node)

    return roots


# ===================================成员服务==================================
async def add_member(project_id: int, user_id: int, project_role: str) -> ProjectMember:
    """添加项目成员"""
    project = await get_project_by_id(project_id)
    if not project:
        raise NotFoundError("项目不存在")

    # 检查是否已是成员
    existing = await ProjectMember.get_or_none(project_id=project_id, user_id=user_id)
    if existing:
        raise ConflictError("该用户已是项目成员")

    member = await ProjectMember.create(
        project_id=project_id,
        user_id=user_id,
        project_role=project_role,
    )
    logger.info(f"添加成员: user_id={user_id} -> project_id={project_id}, role={project_role}")
    return member


async def update_member(project_id: int, user_id: int, project_role: str) -> ProjectMember:
    """更新成员角色"""
    member = await ProjectMember.get_or_none(project_id=project_id, user_id=user_id)
    if not member:
        raise NotFoundError("成员不存在")

    member.project_role = project_role
    await member.save(update_fields=["project_role"])
    return member


async def remove_member(project_id: int, user_id: int) -> None:
    """移除项目成员"""
    member = await ProjectMember.get_or_none(project_id=project_id, user_id=user_id)
    if not member:
        raise NotFoundError("成员不存在")

    # 负责人不可移除
    project = await get_project_by_id(project_id)
    if project and project.owner_id == user_id:
        raise BusinessRuleError("项目负责人不可移除，请先转移项目所有权")

    await member.delete()
    logger.info(f"移除成员: user_id={user_id} -> project_id={project_id}")


async def list_members(project_id: int) -> list[dict]:
    """获取项目成员列表"""
    members = await ProjectMember.filter(project_id=project_id).all().prefetch_related("user")
    result = []
    for m in members:
        result.append({
            "id": m.id,
            "project_id": m.project_id,
            "user_id": m.user_id,
            "username": m.user.username if m.user else "",
            "real_name": m.user.real_name if m.user else "",
            "avatar": m.user.avatar if m.user else None,
            "project_role": m.project_role,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })
    return result
