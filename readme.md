# AI Architecture Copilot

Senior-level SaaS portfolio project: ChatGPT for Azure cloud architecture and IaC.

The app generates Azure architecture recommendations from natural language requirements, including a diagram, security review, monthly cost estimate, Bicep, Terraform, and scaling guidance. Reviews are framed around the Azure Well-Architected pillars: reliability, security, cost optimization, operational excellence, and performance efficiency.

It now supports:

- overview and generator pages
- account registration and login
- per-user projects
- saved architecture runs and history
- deterministic local preview mode
- optional AI-enhanced generation through OpenAI or Azure OpenAI

## Apps

- `apps/web` - Next.js, TypeScript, Tailwind CSS, shadcn-style components, React Flow, Monaco Editor.
- `apps/api` - FastAPI service with modular architecture, security, cost, and IaC generators.

## Quick Start

```bash
npm install
npm run dev
```

In another terminal:

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

In `apps/web`, create a local env file when you want the web app to use the API:

```bash
cp .env.local.example .env.local
```

## Run Modes

### Preview mode

If `NEXT_PUBLIC_API_URL` is not set, the web app stays fully usable with the built-in deterministic engine.

- no login required
- no saved projects
- no history
- no AI provider calls

### API-backed mode

Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `apps/web/.env.local` to enable:

- register / login
- per-user projects
- saved architecture history
- API-backed generation
- optional AI-enhanced output

## AI Provider Configuration

AI generation is optional. Without provider credentials, the backend falls back to the deterministic engine.

Use one of these configurations in `apps/api/.env`:

### OpenAI

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

### Azure OpenAI

```bash
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_DEPLOYMENT=...
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

## Backend Tests

From `apps/api`:

```bash
python3 -m unittest discover -s tests
```

This currently covers:

- auth session flow
- project creation and ownership
- save-on-generate history flow
- deterministic generation
- AI success and AI fallback behavior

## Database Migrations

The API now includes Alembic migration scaffolding and an initial schema migration.

From `apps/api`:

```bash
alembic upgrade head
```

For quick local iteration, `.env.example` keeps `AUTO_CREATE_TABLES=true`, but migrations are the preferred path for managed environments.

## MVP Scenarios

- HIPAA-compliant EHR system
- Event-driven ecommerce platform
- Fintech payment processing platform
- Multi-region SaaS application
- IoT telemetry ingestion platform
- AI document processing platform
- CRM platform
- Insurance claims workflow
- Shop operations platform
