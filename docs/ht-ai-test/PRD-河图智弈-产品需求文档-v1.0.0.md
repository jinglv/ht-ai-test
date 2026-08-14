# 河图智弈 · 企业级 AI 智能体测试平台 — 产品需求文档（PRD）

> 循河图数理，以智弈控测

| 项目 | 内容 |
| ---- | ---- |
| 对外品牌名 | 河图智弈 |
| 主项目工程名 | `ht_ai_test`（后端目录 `backend/`） |
| 后端导入包名 | `hetu`（src 布局，源码位于 `backend/src/hetu/`，`uv pip install -e .` 安装） |
| 智能体核心服务名 | `hetu_agent`（即 `agents/` 编排包） |
| 技能服务模块名 | `skills/`（SKILL.md 资源库，FilesystemBackend 加载） |
| 文档版本 | v1.2 |
| 文档状态 | 评审稿（结构对齐版） |
| 最后更新 | 2026-07-03 |
| 关联文档 | `登录页面设计.md`、`视觉页面设计.md` |

---

## 一、产品概述

### 1.1 产品定位

河图智弈是一款**企业级 AI 驱动的测试管理平台**，以「河图数理逻辑」承载「现代 AI 智能体调度算力」，面向企业测试团队，实现从需求理解、用例生成、任务编排到结果分析的一站式智能测试体验。

核心品牌释义：**河图为上古算法数理图腾，弈为智能体调度、任务博弈、自动化执行**。

### 1.2 核心业务目标

实现 **「自然语言提问 → 自然语言信息分析 → 智能可视化展示」** 的一站式对话式体验：测试人员通过对话即可完成需求检索、用例生成、数据分析等复杂测试任务，降低操作门槛、提升测试效率。

### 1.3 目标用户

| 角色         | 典型场景                                               | 关注点                       |
| ------------ | ------------------------------------------------------ | ---------------------------- |
| 系统管理员   | 配置用户、角色、权限，维护平台基础数据                 | 权限安全、可控性             |
| 测试经理     | 管理测试项目、分配成员、把控进度与质量                 | 项目视图、协作、可视化报表   |
| 测试工程师   | 检索需求、生成/维护用例、组织测试套件、对话式数据分析  | 效率、智能化、易用性         |
| 需求/产品人员| 查看测试覆盖情况、需求与用例映射                       | 覆盖率、可追溯               |

### 1.4 产品价值

1. **降本增效**：AI 自动解析需求文档并生成测试用例，减少人工编写工作量。
2. **智能分析**：自然语言对话完成数据查询与分析，无需编写 SQL 或报表。
3. **协作规范**：RBAC 权限体系 + 项目成员协作，保障多角色规范化管理。
4. **可视洞察**：智能可视化展示测试数据，辅助质量决策。

---

## 二、技术架构（硬性约束）

### 2.1 技术选型（已确定，不可更改）

| 层级 | 技术选型 |
| ---- | -------- |
| 大模型 | DeepSeek 在线大模型（文本生成） |
| 关系型数据库 | PostgreSQL（驱动 asyncpg） |
| 后端框架 | FastAPI + Tortoise-ORM（全异步） |
| 数据库迁移 | Tortoise 内置迁移（`tortoise makemigrations`，不使用 Aerich） |
| AI 智能体框架 | LangChain 生态的 DeepAgents |
| 技能机制 | Agent Skills 规范（SKILL.md + FilesystemBackend，渐进式加载） |
| 前端框架 | React + Next.js（脚手架搭建） |
| 工程工具链 | uv（依赖/虚拟环境）+ ruff（lint） |
| 部署方式 | 前后端均在本地开发环境直接运行（暂不容器化/云端） |

### 2.2 系统分层架构

```
┌─────────────────────────────────────────────────────────┐
│  前端层  React + Next.js（登录 / 管理后台 / 对话式分析）     │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP/JSON (REST) + SSE(流式对话)
┌───────────────────────────┴─────────────────────────────┐
│  后端服务层  FastAPI (async)                               │
│  ┌──────────┬──────────┬──────────┬──────────────────┐   │
│  │ 认证鉴权  │ 业务API   │ AI 网关   │  文件/文档服务    │   │
│  │ (RBAC)   │ (CRUD)   │ (对话/分析)│  (需求文档检索)   │   │
│  └──────────┴──────────┴─────┬────┴──────────────────┘   │
└───────────────────────────────┼─────────────────────────┘
              ┌─────────────────┼─────────────────┐
     ┌────────┴────────┐ ┌──────┴───────┐ ┌───────┴────────┐
     │  Tortoise-ORM   │ │ hetu_agent   │ │  DeepSeek API   │
     │  PostgreSQL     │ │ (DeepAgents) │ │  (在线大模型)    │
     └─────────────────┘ │ ht_agent_skill│ └────────────────┘
                         └──────────────┘
```

### 2.3 后端工程结构

采用「模块化单体」：`modules/` 按业务域垂直切片（多功能），`agents/` 按智能体纵向切（多 agent），`skills/` 为 SKILL.md 资源库（被多 agent 复用），`core/` 兜底横切关注点。仍是单进程单库，非微服务。

采用 **src 布局 + 命名包 `hetu`**：所有可导入的 Python 代码收入 `backend/src/hetu/`，导入根为该命名包（而非 `backend/` 本身）。这样给 `config`/`core`/`modules` 等通用名加上命名空间前缀（`from hetu.config import …`），避免顶层撞名；并强制经 `uv pip install -e .` 安装后方可导入，从而拿到 src 布局的「测试已安装包而非当前目录树」隔离收益。`skills/`、`migrations/` 是路径资源（由 `FilesystemBackend`/Tortoise 按文件系统路径加载，从不 `import`），故留在 `backend/` 根而非进 `src/`。

```
backend/                        # 后端工程根（非导入根）
├── pyproject.toml              # uv 依赖 + ruff + [tool.tortoise]；name="hetu"，src 布局
├── .env / .env.example         # DB URL / DeepSeek Key / JWT Secret
├── src/                        # ★ src 布局：可编辑安装后导入根为 src/hetu
│   └── hetu/                   #   命名包 hetu（所有导入从此解析，如 hetu.config）
│       ├── __init__.py
│       ├── main.py             #   FastAPI 入口 + lifespan 初始化 Tortoise + 挂载各域 router
│       ├── config.py          #   TORTOISE_ORM 配置（含 migrations 键，路径指向 backend/migrations）
│       ├── settings.py        #   pydantic-settings（环境变量；skills_root 指向 backend/skills）
│       ├── core/              #   横切关注点（不属任何业务域）
│       │   ├── security.py    #     JWT / bcrypt
│       │   ├── rbac.py         #     require_permission / get_data_scope
│       │   ├── deps.py         #     get_current_user / 分页依赖
│       │   ├── response.py     #     统一 {code,message,data}
│       │   ├── exceptions.py  #     业务异常 + 全局 handler
│       │   └── middleware.py
│       ├── modules/            #   业务域（每域 router/service/schemas/models 四件套）
│       │   ├── auth/           #     认证：登录/验证码/登出
│       │   ├── rbac/           #     用户/角色/权限（含 data_scope）
│       │   ├── project/        #     项目/模块/成员
│       │   ├── testcase/       #     用例/套件/执行记录/需求文档
│       │   └── ai_chat/        #     对话会话/消息（SSE 入口）
│       ├── agents/             #   多智能体编排（Python 代码）
│       │   ├── base.py         #     BaseAgent 抽象
│       │   ├── registry.py     #     agent 注册表 + 按意图路由
│       │   ├── orchestrator.py #     意图识别 → 分发
│       │   ├── llm.py          #     DeepSeek 客户端（共享：超时/重试/计费）
│       │   ├── context.py      #     会话 + 数据权限上下文
│       │   └── factory.py      #     create_deep_agent 装配（skills 路径 + backend）
│       └── shared/             #   跨域共享（enums / pagination）
├── migrations/                 # Tortoise 内置迁移（tortoise makemigrations 生成，非 Aerich）— 路径资源
├── skills/                     # ★ SKILL.md 技能库（资源，FilesystemBackend 加载）— 路径资源
│   ├── shared/                 #   所有 agent 共享
│   │   ├── requirement-analysis/
│   │   └── testcase-generation/
│   └── analysis/               #   仅 analysis_agent 可见（数据权限敏感）
│       ├── nl2sql/
│       └── visualization/
└── tests/                      # 含 test_skills_valid.py（校验 SKILL.md frontmatter）
```

设计原则：

1. **垂直切片**：`modules/<域>/` 自包含 router+service+schemas+models，理解一个功能只需看一个文件夹。
2. **智能体与技能正交分离**：`agents/` 管编排与多 agent，`skills/` 管可复用原子能力（SKILL.md），一个技能可被多 agent 复用。
3. **开闭原则**：加 agent 注册到 registry、加技能建文件夹，orchestrator 零改动。
4. **单一 app 命名空间**：所有域 models 注册到同一个 `models` app，跨域外键 `ForeignKeyField('models.Project')` 照常可用。
5. **代码与资源分层**：可导入代码进 `src/hetu/`（享安装隔离），路径资源 `skills/`·`migrations/` 留 `backend/` 根（按文件系统路径加载，进 src 反增摩擦）。

#### 2.3.1 数据库迁移与配置

使用 Tortoise 内置迁移（官方已将 Aerich 列为遗留方案），不引入 aerich 依赖：

```python
# src/hetu/config.py
TORTOISE_ORM = {
    "connections": {"default": "postgres://user:pass@localhost:5432/ht_ai_test"},
    "apps": {
        "models": {
            "models": [
                "hetu.modules.rbac.models",
                "hetu.modules.project.models",
                "hetu.modules.testcase.models",
                "hetu.modules.ai_chat.models",
            ],
            "default_connection": "default",
            "migrations": "migrations",   # 相对 backend/ 的迁移包路径（资源，不在 src 内）
        }
    },
}
```

日常命令（配置解析支持 `-c`/`--config-file` 或 `pyproject.toml` 的 `[tool.tortoise]`）：

```bash
uv pip install -e .       # src 布局：先以可编辑模式安装 hetu 包，导入根方可解析
tortoise init            # 建迁移包
tortoise makemigrations  # 自动 diff 模型变更 → 生成迁移文件
tortoise migrate         # 应用迁移
tortoise sqlmigrate models 0001_initial   # 预览 SQL 不执行
```

> 上述命令均在 `backend/` 目录下执行：`tortoise` 的 `migrations` 路径相对此处解析；模型按已安装的 `hetu.modules.*` 命名空间导入。

> 注：`generate_schemas()` 仅用于开发期建表（`CREATE TABLE IF NOT EXISTS`，不做增量 ALTER），生产用内置迁移。

#### 2.3.2 技能管理（SKILL.md）

技能遵循 [Agent Skills 规范](https://agentskills.io/specification)，是 `skills/<name>/SKILL.md` 目录（YAML frontmatter `name`/`description` + markdown 指令，可附 `scripts/`·`references/`·`assets/`），`name` 必须与目录名一致且用连字符（如 `requirement-analysis`）。

**三级渐进式加载**：启动时只把每个技能的 `name`+`description` 注入系统提示词 → 任务命中才读 `SKILL.md` 全文 → 指令引用才读附属文件，避免上下文膨胀。

**管理模型**：

| 原则 | 落地 |
| ---- | ---- |
| 目录即清单 | `skills/**/SKILL.md` 每个文件夹即一个技能，`SkillsMiddleware` 自动扫描 frontmatter，无需手写注册表 |
| 按访问域分层 | `skills/shared/`（全员）+ `skills/analysis/`（仅分析 agent），factory 给每个 agent 传不同路径列表；后者覆盖前者 |
| 配置驱动映射 | `src/hetu/agents/factory.py` 的 `AGENT_SKILL_SOURCES = {agent: [paths]}` 是 agent↔技能关系的单一事实来源 |
| 改技能=改 markdown | 直接编辑 `SKILL.md`，git 版本化、可 code review，无需重新发版 |
| CI 校验 | `skills-ref` 工具 + `tests/test_skills_valid.py` 断言 `name`==目录名、frontmatter 合法 |
| 沙箱按需 | 仅当技能带 `scripts/` 需执行时配 sandbox backend + 传输中间件；纯指令类技能零沙箱 |

factory 装配示例：

```python
# src/hetu/agents/factory.py
AGENT_SKILL_SOURCES = {
    "requirement": ["skills/shared/"],
    "testcase":     ["skills/shared/"],
    "analysis":     ["skills/shared/", "skills/analysis/"],  # 叠加：共享 + 分析专属
}
# 注：skills/ 位于 backend/ 根（路径资源，不在 src/hetu 内）；
# factory 以 settings.backend_root 为基准解析上述相对路径。
```

> 沙箱澄清：技能**加载**靠 `FilesystemBackend`（所有技能都需要，但无需沙箱）；**沙箱执行**仅用于技能 `scripts/` 中需 agent 运行的脚本。`nl2sql` 建议改为指示 agent 调用后端 `run_readonly_sql` 工具（叠加数据权限过滤），从而无需沙箱。

---

## 三、功能模块需求

平台包含三大核心业务模块，均采用「顶部导航 + 左侧一级菜单 + 内容区 Tab 二级页签 + 主体内容区」的企业级后台布局。

### 3.1 模块一：权限与用户管理（RBAC）

#### 3.1.1 模块目标

基于 **RBAC（Role-Based Access Control）** 实现用户、角色、权限三层解耦的访问控制。

#### 3.1.2 功能清单

| 子功能     | 说明                                                                 |
| ---------- | -------------------------------------------------------------------- |
| 用户管理   | 用户增删改查、启用/禁用、重置密码、分配角色、账号信息维护            |
| 角色管理   | 角色增删改查、为角色绑定权限点、角色描述维护                        |
| 权限管理   | 权限点（菜单权限 + 操作权限 + 数据权限）维护，树形结构展示           |
| 登录认证   | 账号密码登录、验证码校验、记住密码、忘记密码、JWT 会话管理           |
| 个人中心   | 修改个人信息、修改密码、查看所属角色                                |

#### 3.1.3 权限模型

- **用户 (User)** ── N:M ── **角色 (Role)** ── N:M ── **权限 (Permission)**
- 权限类型：
  - **菜单权限**：控制左侧菜单/Tab 可见性
  - **操作权限**：控制按钮级操作（增/删/改/导出等），格式如 `testcase:create`、`user:delete`
  - **数据权限**：控制数据行的可见范围（本人/本项目/全部），详见 3.1.4
- 后端通过 FastAPI 依赖注入 `require_permission("xxx")` 做接口级鉴权。

#### 3.1.4 数据权限（数据行级访问控制）

数据权限用于控制用户在**业务数据（项目、需求文档、测试用例、套件、执行记录等）** 上的可见与可操作范围，与「菜单/操作权限」正交叠加：先判断能否访问接口，再过滤能看到哪些数据行。

##### 数据权限范围（三级）

| 范围码       | 名称     | 说明                                                             | 典型角色       |
| ------------ | -------- | ---------------------------------------------------------------- | -------------- |
| `SELF`       | 仅本人   | 只能查看/操作自己创建或负责（owner/creator）的数据               | 测试工程师     |
| `PROJECT`    | 本项目   | 只能查看/操作自己作为成员所在项目内的数据                        | 测试经理       |
| `ALL`        | 全部     | 可查看/操作全平台所有数据，不做数据过滤                          | 系统管理员     |

##### 生效规则

1. 数据权限范围**绑定在角色上**（`role.data_scope`）；用户拥有多个角色时，取**最大范围**（`ALL > PROJECT > SELF`）。
2. 后端在业务查询层统一注入数据过滤条件：
   - `ALL`：不加过滤。
   - `PROJECT`：追加 `project_id IN (当前用户所属项目集合)`。
   - `SELF`：追加 `creator_id = 当前用户` 或 `owner_id = 当前用户`。
3. 通过 FastAPI 依赖统一下发数据范围上下文（如 `get_data_scope()`），Service 层据此拼装 Tortoise-ORM 查询条件，避免各接口重复实现。
4. **AI 数据查询（nl2sql）必须叠加同一数据权限过滤**，保证对话式分析不越权（详见 4.4）。
5. 超级管理员固定为 `ALL`，不受约束。

##### 数据模型影响

- `role` 表新增字段 `data_scope`（枚举：`SELF` / `PROJECT` / `ALL`，默认 `SELF`）。
- 业务主表统一保留 `creator_id`、`project_id`（用例/文档等）字段，作为过滤依据。

#### 3.1.5 核心业务规则

1. 内置「超级管理员」角色，拥有全部权限，数据权限固定为 `ALL`，不可删除。
2. 删除角色前需校验是否有用户占用，占用时禁止删除并提示。
3. 用户禁用后立即失效登录态（下次请求校验失败）。
4. 密码使用 bcrypt 哈希存储，禁止明文。
5. 数据权限与操作权限叠加校验：接口鉴权通过后仍需按数据范围过滤数据行。

---

### 3.2 模块二：测试项目管理

#### 3.2.1 模块目标

管理测试项目全生命周期，支持模块划分与成员协作。

#### 3.2.2 功能清单

| 子功能       | 说明                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| 项目基本信息 | 项目创建/编辑/归档/删除，含项目名称、编号、负责人、起止时间、状态、描述   |
| 模块划分     | 项目下树形模块（功能模块/子模块）维护，用例归属到具体模块                 |
| 成员协作管理 | 为项目添加成员并指定项目内角色（负责人/测试/只读），成员范围内数据可见   |
| 项目概览     | 项目维度统计：用例总数、执行进度、通过率、成员数等（结合可视化）          |

#### 3.2.3 核心业务规则

1. 项目状态：`规划中 / 进行中 / 已完成 / 已归档`，归档项目只读。
2. 项目编号全局唯一。
3. 项目成员与平台用户关联，非成员默认不可访问该项目数据（数据权限）。
4. 删除项目为软删除，保留数据可追溯。

---

### 3.3 模块三：测试用例管理（AI 核心模块）

#### 3.3.1 模块目标

支持**需求文档检索与智能分析**，AI 辅助**生成并管理测试用例与测试套件**。

#### 3.3.2 功能清单

| 子功能           | 说明                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| 需求文档管理     | 上传需求文档（Markdown/Word/PDF/文本），解析入库，支持全文检索                          |
| 需求智能分析     | 对话式提问需求内容，AI 提炼功能点、边界、异常场景                                        |
| AI 用例生成      | 基于需求文档/功能点，一键生成结构化测试用例（可编辑、批量入库）                          |
| 用例管理         | 用例增删改查、按模块/优先级/状态筛选、批量操作、导入导出（Excel）                        |
| 测试套件管理     | 将用例组合为测试套件，支持套件复用与排序                                                 |
| 用例执行记录     | 记录执行结果（通过/失败/阻塞/跳过）、备注、缺陷关联，作为分析数据源                     |

> **页面组织（与原型一致）**：上述子功能在前端统一归入「用例管理」一级菜单，以 **4 个 Tab** 承载——`用例列表` / `测试套件` / `需求文档` / `执行记录`；「用例列表」Tab 采用左侧模块树 + 右侧用例表格双栏，AI 生成入口（鎏金 AI 徽标）置于表格头操作区。

#### 3.3.3 测试用例数据结构

单条用例字段：
- 用例编号、标题、所属项目、所属模块
- 前置条件、测试步骤（有序列表）、预期结果
- 优先级（P0/P1/P2/P3）、用例类型（功能/接口/性能/兼容等）
- 状态（草稿/评审中/已通过/已废弃）、维护人、AI 生成标记

#### 3.3.4 AI 用例生成流程

```
需求文档 → 文本切分/入库 → 用户提问或选择功能点
        → hetu_agent 调用 requirement_analysis Skill 提炼功能点
        → testcase_generation Skill 生成结构化用例(JSON)
        → 前端预览/编辑 → 确认批量入库
```

#### 3.3.5 核心业务规则

1. AI 生成的用例默认状态为「草稿」，需人工确认后转正式。
2. AI 生成用例标记 `is_ai_generated = true`，可追溯来源需求。
3. 用例编号在项目内唯一，自动生成（如 `TC-项目编号-序号`）。

---

## 四、AI 智能体能力需求（贯穿全平台）

### 4.1 核心能力：对话式智能分析

实现 **自然语言提问 → 自然语言信息分析 → 智能可视化展示** 闭环。

```
用户自然语言提问
   │
   ▼
意图识别（hetu_agent）
   ├── 需求分析类  → requirement_analysis Skill → 文本结论
   ├── 用例生成类  → testcase_generation Skill → 结构化用例
   ├── 数据查询类  → nl2sql Skill → 安全查询 PostgreSQL
   └── 可视化类    → visualization Skill → 图表配置(JSON)
   │
   ▼
结果组合：自然语言总结 + 数据表格 + 智能图表
   │
   ▼
前端流式渲染（SSE 打字机效果 + 动态图表）
```

### 4.2 智能体 Skill 技能库（`ht_agent_skill`）

| 技能                    | 输入                     | 输出                       | 说明                                   |
| ----------------------- | ------------------------ | -------------------------- | -------------------------------------- |
| `requirement_analysis`  | 需求文档/片段            | 功能点、场景、边界（文本） | 需求理解与分析                         |
| `testcase_generation`   | 功能点/需求              | 结构化用例 JSON            | 自动生成测试用例                       |
| `nl2sql`                | 自然语言问题             | 安全 SELECT + 结果集       | 自然语言转数据查询（仅读、白名单表）   |
| `visualization`         | 数据结果集 + 问题        | 图表类型 + 配置 JSON       | 智能推荐并生成可视化配置               |

### 4.3 智能可视化展示

- 图表类型：柱状图、折线图、饼图、环形图、指标卡、数据表格
- AI 根据数据特征与问题意图**自动推荐最合适的图表类型**
- 图表配色遵循视觉规范：**科技青蓝 + 鎏金点缀**，线条干净、层级清晰
- 支持图表与表格联动、导出

### 4.4 AI 安全与约束

1. **只读查询**：`nl2sql` 仅允许 `SELECT`，禁止写操作，走白名单表 + 字段。
2. **数据权限过滤**：AI 查询结果需叠加当前用户的项目数据权限。
3. **流式响应**：对话接口使用 SSE 流式返回，前端打字机渲染。
4. **DeepSeek 调用**：统一封装于 `hetu.agents.llm`（`src/hetu/agents/llm.py`），含超时、重试、错误兜底与 Token 用量记录。
5. **敏感信息**：DeepSeek API Key 存于后端环境变量/配置，禁止下发前端。

---

## 五、数据模型设计（PostgreSQL / Tortoise-ORM）

### 5.1 核心数据表

| 表名                | 说明             | 关键字段                                                        |
| ------------------- | ---------------- | --------------------------------------------------------------- |
| `user`              | 用户             | id, username, password_hash, real_name, email, is_active        |
| `role`              | 角色             | id, name, code, description, is_builtin, data_scope(SELF/PROJECT/ALL) |
| `permission`        | 权限点           | id, name, code, type(menu/action/data), parent_id               |
| `user_role`         | 用户-角色关联    | user_id, role_id                                                |
| `role_permission`   | 角色-权限关联    | role_id, permission_id                                          |
| `project`           | 测试项目         | id, code, name, owner_id, status, start_date, end_date, desc    |
| `project_module`    | 项目模块         | id, project_id, parent_id, name, sort                           |
| `project_member`    | 项目成员         | id, project_id, user_id, project_role                           |
| `requirement_doc`   | 需求文档         | id, project_id, title, content, file_type, uploaded_by          |
| `testcase`          | 测试用例         | id, code, project_id, module_id, title, precondition, steps(JSON), expected, priority, type, status, is_ai_generated, source_doc_id |
| `testsuite`         | 测试套件         | id, project_id, name, description                               |
| `testsuite_case`    | 套件-用例关联    | suite_id, testcase_id, sort                                     |
| `test_execution`    | 用例执行记录     | id, testcase_id, result, remark, executed_by, executed_at       |
| `ai_conversation`   | AI 对话会话      | id, user_id, title, created_at                                  |
| `ai_message`        | AI 对话消息      | id, conversation_id, role, content, chart_config(JSON)          |

### 5.2 关系约束

- 所有表含 `created_at` / `updated_at`；业务主表支持软删除 `is_deleted`。
- 外键关联维护，删除采用软删除优先，保障可追溯。

---

## 六、接口设计概要（RESTful）

> 统一前缀 `/api/v1`，认证使用 `Authorization: Bearer <JWT>`，响应统一 `{code, message, data}` 结构。

| 模块     | 方法/路径                                     | 说明                     |
| -------- | --------------------------------------------- | ------------------------ |
| 认证     | `POST /auth/login`                            | 登录（含验证码）         |
| 认证     | `POST /auth/logout`                           | 退出                     |
| 认证     | `GET  /auth/captcha`                           | 获取验证码图             |
| 用户     | `GET/POST/PUT/DELETE /users`                  | 用户管理                 |
| 角色     | `GET/POST/PUT/DELETE /roles`                  | 角色管理及授权           |
| 权限     | `GET /permissions/tree`                       | 权限树                   |
| 项目     | `GET/POST/PUT/DELETE /projects`               | 项目管理                 |
| 模块     | `GET/POST/PUT/DELETE /projects/{id}/modules`  | 模块管理                 |
| 成员     | `GET/POST/DELETE /projects/{id}/members`      | 成员协作                 |
| 需求     | `POST /requirements/upload` `GET /requirements/search` | 上传/检索需求文档 |
| 用例     | `GET/POST/PUT/DELETE /testcases`              | 用例管理                 |
| 用例     | `POST /testcases/ai-generate`                 | AI 生成用例              |
| 套件     | `GET/POST/PUT/DELETE /testsuites`             | 套件管理                 |
| AI 对话  | `POST /ai/chat` (SSE)                          | 对话式分析（流式）       |
| AI 对话  | `GET /ai/conversations`                       | 会话历史                 |

---

## 七、前端页面与视觉规范

> 完整规范见 `视觉页面设计.md` 与 `登录页面设计.md`，本节为落地要点。

### 7.1 整体风格

**明亮极简科技风 + 轻量化新中式**：明亮通透、数理秩序、智能博弈、轻奢国风、硬核科技、企业极简。禁止厚重古风/水墨/暗色调、禁止卡通/浮夸渐变/高饱和。

### 7.2 标准色值（前端直接复用）

| 用途                     | 色值      |
| ------------------------ | --------- |
| 科技青蓝（主品牌色）     | `#2A76C9` |
| 主按钮 hover 加深        | `#2362B0` |
| 雅白（全局背景）         | `#F8FAFD` |
| 轻奢鎏金（国风点缀）     | `#D4B86A` |
| 黛青（标题/正文/表头文字） | `#23344D` |
| 浅烟青（边框/分割线）    | `#D7E2F0` |
| 占位/次要文字            | `#8A99B0` |
| 成功绿                   | `#36B37E` |
| 警告橙                   | `#FF8C38` |
| 危险红                   | `#E54C4C` |

> 顶栏 / 侧边栏 / 表头 / 登录品牌区均以**深海蓝渐变**呈现（非纯黛青实色），渐变断点见 `视觉页面设计.md` 第 2.4 节；主按钮、链接柱体使用青蓝渐变（亮端 #3D88E0/#5A96E5）。

### 7.3 全局 UI 规范

- **字体**：品牌标题=思源宋体粗体；正文/按钮/表格=思源黑体/Inter。字号：大标题 28–36px、模块标题 20–24px、正文 14px、辅助 12px。
- **圆角**：按钮/输入框/标签 8px；卡片/弹窗/模块 12px。禁止直角与超大圆角。
- **装饰**：河图点阵/线性云纹底纹（透明度 8%–12%）；细鎏金竖线/横线作国风识别；流线型算力光效点缀。
- **动效**：统一 0.2s 平滑过渡；Tab/页面切换淡入淡出；智能体拓扑连线轻微流动；仅氛围动效。

### 7.4 核心页面清单

> 统一框架：顶部深海蓝渐变导航栏（`#0E2A3E→#1A4966→#235A7D` + 鎏金下沿，LOGO+系统名+折叠按钮+面包屑+消息/设置/退出+用户区）+ 左侧 220px 深海蓝渐变侧边栏（可折叠为 64px，一级菜单：首页、项目管理、用例管理、AI对话分析、系统管理[用户/角色/权限]）+ 内容区 Tab 二级页签 + 主体区。

| 页面           | 布局要点                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------- |
| 登录页         | 左右分栏（左 56% 沉浸式品牌区 + 右 44% 玻璃拟态登录卡片）；旋转鎏金光环 LOGO + 124px 白盘；440px 卡片；见 `登录页面设计.md` |
| 首页工作台     | 欢迎横幅 + 4 统计卡（项目/用例/通过率/成员）+ 4 快捷入口 + 双列（最近项目 / 待办事项）       |
| 主框架         | 顶部深海蓝渐变导航栏 + 左侧 220px 深海蓝渐变侧边栏（可折叠）+ 内容区 Tab + 主体区           |
| 项目管理       | Tab（项目列表/模块管理/成员管理）；单卡片表格：名称/编号/负责人/状态/起止时间/成员/操作     |
| 用例管理       | Tab（用例列表/测试套件/需求文档/执行记录）；左模块树 + 右用例表格 + AI 生成入口（鎏金 AI 徽标）|
| AI 对话分析    | 左 260px 会话列表 + 右消息流（用户气泡 + AI 气泡内嵌柱状图/环形图）+ 快捷提示词 + 胶囊输入；SSE 打字机 |
| 用户管理       | 面包屑「系统管理 › 用户管理」+ Tab（用户列表/角色分配/账号设置）；表格 + 搜索/筛选/新增     |

### 7.5 组件规范

- **按钮**：主按钮（青蓝渐变底 `#2A76C9→#3D88E0` 白字/hover 上浮加深）、次按钮（白底蓝边蓝字）、文字按钮（蓝字无底）、危险按钮（红）。
- **表格**：表头深海蓝渐变底 + 白字 + 鎏金下沿、白底浅烟青分行、行 hover 浅青蓝；底部分页栏 sticky 白底。
- **弹窗/表单**：12px 圆角白底浅边框，标题顶部细鎏金装饰线，输入框聚焦变色、错误标红。
- **图表**：科技青蓝渐变柱 + 鎏金重点柱点缀，线条干净、层级清晰。
- **状态标签/进度条/统计卡/会话气泡** 等业务组件细则见 `视觉页面设计.md` 第 7.5 节。

### 7.6 适配

- PC 端：标准后台左右 + Tab 布局。
- 移动端：自动适配单列上下布局。
- 支持浅色默认模式 + 深色适配模式（LOGO 反白）。

---

## 八、非功能性需求

| 类别 | 要求 |
| ---- | ---- |
| 性能 | 常规接口响应 < 500ms；AI 对话首字返回 < 3s（流式）；列表分页默认 20 条 |
| 安全 | JWT 鉴权、RBAC 接口级校验、密码 bcrypt、SQL 注入防护、AI 查询只读白名单 |
| 异步 | 后端全异步（FastAPI + Tortoise-ORM），AI 调用非阻塞 |
| 可维护性 | 模块化单体（modules 垂直切片 + agents 多智能体 + skills 资源化）、统一异常/响应、pydantic-settings 配置、日志记录 |
| 兼容性 | 主流现代浏览器（Chrome/Edge/Firefox 最新版） |
| 本地部署 | 前后端本地直接运行；DB 连接/DeepSeek Key/JWT Secret 经 pydantic-settings 从环境变量注入；uv 管理依赖 |

---

## 九、里程碑规划（建议）

| 阶段    | 内容                                                         | 交付                       |
| ------- | ------------------------------------------------------------ | -------------------------- |
| M1 基建 | 项目脚手架、数据库设计、登录认证、RBAC 权限、主框架布局、首页工作台框架 | 可登录并进入后台主框架与首页工作台 |
| M2 项目 | 测试项目管理（信息/模块/成员）                              | 项目管理模块可用           |
| M3 用例 | 需求文档管理、用例/套件 CRUD、执行记录                      | 用例管理模块可用           |
| M4 智能 | hetu_agent 接入 DeepSeek，需求分析、AI 用例生成             | AI 用例生成可用            |
| M5 分析 | 对话式分析（nl2sql + 可视化），智能图表展示                | 一站式对话分析闭环         |
| M6 优化 | 视觉细节打磨、动效、深色模式、移动端适配、性能与安全加固    | 交付验收                   |

---

## 十、附录：术语表

| 术语        | 含义                                                       |
| ----------- | ---------------------------------------------------------- |
| RBAC        | 基于角色的访问控制                                         |
| DeepAgents  | LangChain 生态的智能体框架                                 |
| Skill       | 智能体可调用的原子能力单元（`ht_agent_skill`）             |
| NL2SQL      | 自然语言转数据库查询                                       |
| SSE         | Server-Sent Events，服务端流式推送                         |
| hetu_agent  | 河图智弈智能体核心服务                                     |
