# Project ：backend
# File    ：router.py
# Author  ：jinglv
# Date    ：2026/8/14
# Software：PyCharm
"""
项目域路由

包含：项目管理、模块管理、成员管理
"""
from fastapi import APIRouter, Depends, Query, Request

from hetu.core.deps import current_user, pagination
from hetu.core.exceptions import NotFoundError
from hetu.core.rbac import require_permission
from hetu.core.response import json_ok, paginated
from hetu.modules.project.models import Project, ProjectModule, ProjectMember
from hetu.modules.project.schemas import (
    MemberCreateRequest,
    MemberResponse,
    MemberUpdateRequest,
    ModuleCreateRequest,
    ModuleResponse,
    ModuleUpdateRequest,
    ProjectCreateRequest,
    ProjectOverviewResponse,
    ProjectResponse,
    ProjectUpdateRequest,
)
from hetu.modules.project.services import (
    add_member,
    archive_project,
    create_module,
    create_project,
    delete_module,
    delete_project,
    get_project_by_id,
    get_project_overview,
    list_members,
    list_modules,
    list_projects,
    remove_member,
    update_member,
    update_module,
    update_project,
)

projects_router = APIRouter(prefix="/projects", tags=["项目管理"])


# ===================================项目管理==================================
@projects_router.get("", summary="项目列表")
async def list_projects_api(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: str | None = Query(None),
    status: str | None = Query(None),
    user: dict = Depends(require_permission("project:view")),
):
    """分页查询项目列表"""
    result = await list_projects(page, page_size, keyword, status, user=user)
    return json_ok(paginated(result["items"], result["total"], result["page"], result["page_size"]))


@projects_router.get("/{project_id}", summary="项目详情")
async def get_project_detail(
    request: Request,
    project_id: int,
    user: dict = Depends(require_permission("project:view")),
):
    """获取项目详情"""
    project = await get_project_by_id(project_id)
    if not project:
        raise NotFoundError("项目不存在")

    owner = await project.owner
    return json_ok({
        "id": project.id,
        "code": project.code,
        "name": project.name,
        "owner_id": project.owner_id,
        "owner_name": owner.real_name if owner else "",
        "status": project.status,
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "end_date": project.end_date.isoformat() if project.end_date else None,
        "description": project.description,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    })


@projects_router.get("/{project_id}/overview", summary="项目概览")
async def get_project_overview_api(
    request: Request,
    project_id: int,
    user: dict = Depends(require_permission("project:view")),
):
    """项目概览统计"""
    data = await get_project_overview(project_id, user=user)
    return json_ok(data)


@projects_router.post("", summary="创建项目")
async def create_project_api(
    request: Request,
    body: ProjectCreateRequest,
    user: dict = Depends(require_permission("project:create")),
):
    """创建项目"""
    project = await create_project(
        code=body.code,
        name=body.name,
        owner_id=body.owner_id,
        status=body.status,
        start_date=body.start_date,
        end_date=body.end_date,
        description=body.description,
    )
    return json_ok({"id": project.id, "code": project.code}, "创建成功")


@projects_router.put("/{project_id}", summary="更新项目")
async def update_project_api(
    request: Request,
    project_id: int,
    body: ProjectUpdateRequest,
    user: dict = Depends(require_permission("project:create")),
):
    """更新项目"""
    update_data = body.model_dump(exclude_none=True)
    project = await update_project(project_id, **update_data)
    return json_ok({"id": project.id}, "更新成功")


@projects_router.delete("/{project_id}", summary="删除项目")
async def delete_project_api(
    request: Request,
    project_id: int,
    user: dict = Depends(require_permission("project:create")),
):
    """删除项目（软删除）"""
    await delete_project(project_id)
    return json_ok(message="删除成功")


@projects_router.patch("/{project_id}/archive", summary="归档项目")
async def archive_project_api(
    request: Request,
    project_id: int,
    user: dict = Depends(require_permission("project:create")),
):
    """归档项目（变为只读）"""
    project = await archive_project(project_id)
    return json_ok({"id": project.id, "status": project.status}, "归档成功")


# ===================================模块管理==================================
modules_router = APIRouter(prefix="/projects/{project_id}/modules", tags=["模块管理"])


@modules_router.get("", summary="项目模块列表（树形）")
async def list_modules_api(
    request: Request,
    project_id: int,
    user: dict = Depends(require_permission("project:view")),
):
    """获取项目模块树"""
    tree = await list_modules(project_id, user=user)
    return json_ok(tree)


@modules_router.post("", summary="创建模块")
async def create_module_api(
    request: Request,
    project_id: int,
    body: ModuleCreateRequest,
    user: dict = Depends(require_permission("project:create")),
):
    """创建模块"""
    module = await create_module(project_id, body.name, body.parent_id)
    return json_ok({"id": module.id}, "创建成功")


@modules_router.put("/{module_id}", summary="更新模块")
async def update_module_api(
    request: Request,
    project_id: int,
    module_id: int,
    body: ModuleUpdateRequest,
    user: dict = Depends(require_permission("project:create")),
):
    """更新模块"""
    update_data = body.model_dump(exclude_none=True)
    module = await update_module(module_id, **update_data)
    return json_ok({"id": module.id}, "更新成功")


@modules_router.delete("/{module_id}", summary="删除模块")
async def delete_module_api(
    request: Request,
    project_id: int,
    module_id: int,
    user: dict = Depends(require_permission("project:create")),
):
    """删除模块"""
    await delete_module(module_id)
    return json_ok(message="删除成功")


# ===================================成员管理==================================
members_router = APIRouter(prefix="/projects/{project_id}/members", tags=["成员管理"])


@members_router.get("", summary="项目成员列表")
async def list_members_api(
    request: Request,
    project_id: int,
    user: dict = Depends(require_permission("project:view")),
):
    """获取项目成员列表"""
    members = await list_members(project_id)
    return json_ok(members)


@members_router.post("", summary="添加成员")
async def add_member_api(
    request: Request,
    project_id: int,
    body: MemberCreateRequest,
    user: dict = Depends(require_permission("project:create")),
):
    """添加项目成员"""
    member = await add_member(project_id, body.user_id, body.project_role)
    return json_ok({"id": member.id}, "添加成功")


@members_router.patch("/{member_id}", summary="更新成员角色")
async def update_member_api(
    request: Request,
    project_id: int,
    member_id: int,
    body: MemberUpdateRequest,
    user: dict = Depends(require_permission("project:create")),
):
    """更新成员角色"""
    member = await ProjectMember.get_or_none(id=member_id, project_id=project_id)
    if not member:
        raise NotFoundError("成员不存在")

    member = await update_member(project_id, member.user_id, body.project_role)
    return json_ok({"id": member.id}, "更新成功")


@members_router.delete("/{member_id}", summary="移除成员")
async def remove_member_api(
    request: Request,
    project_id: int,
    member_id: int,
    user: dict = Depends(require_permission("project:create")),
):
    """移除项目成员"""
    member = await ProjectMember.get_or_none(id=member_id, project_id=project_id)
    if not member:
        raise NotFoundError("成员不存在")

    await remove_member(project_id, member.user_id)
    return json_ok(message="移除成功")
