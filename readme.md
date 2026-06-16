# AI Architecture Copilot

Senior-level SaaS portfolio project: ChatGPT for Azure cloud architecture and IaC.

The MVP generates Azure architecture recommendations from natural language requirements, including a diagram, security review, monthly cost estimate, Bicep, Terraform, and scaling guidance. Reviews are framed around the Azure Well-Architected pillars: reliability, security, cost optimization, operational excellence, and performance efficiency.

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
uvicorn app.main:app --reload --port 8000
```

The web app works with its built-in deterministic engine. Set `NEXT_PUBLIC_API_URL=http://localhost:8000` to call the FastAPI backend.

## MVP Scenarios

- HIPAA-compliant EHR system
- Event-driven ecommerce platform
- Fintech payment processing platform
- Multi-region SaaS application
- IoT telemetry ingestion platform
- AI document processing platform

