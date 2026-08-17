# 河图智弈 - 企业级 AI 智能体测试平台

> 循河图数理，以智弈控测

## 技术栈

- **后端**: FastAPI + Tortoise-ORM + PostgreSQL + DeepAgents
- **前端**: Next.js 16 + React 19 + Tailwind CSS 4
- **工程工具**: uv + ruff

## 快速开始

```bash
# 安装依赖
uv pip install -e .

# 初始化数据库迁移
tortoise init
tortoise makemigrations
tortoise migrate

# 初始化种子数据
uv run python -m hetu.core.seed

# 启动服务
uv run uvicorn main:app --reload
```
