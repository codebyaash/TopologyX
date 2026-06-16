# Architecture

## Product Modules

- Auth
- Projects
- AI Architect Chat
- Architecture Generator
- Diagram Generator
- Cost Estimator
- Security Reviewer
- IaC Generator
- Export Center
- Dashboard

## MVP Engine

The current MVP uses a deterministic rules engine so the product is demoable without paid AI credentials. The API boundary is intentionally shaped around structured JSON so an OpenAI or Azure OpenAI orchestration layer can replace or augment the rules engine later.

## Azure Review Framework

Recommendations map to Azure Well-Architected pillars:

- Reliability
- Security
- Cost optimization
- Operational excellence
- Performance efficiency

## Persistence Plan

The SQLAlchemy models cover the planned tables:

- `users`
- `projects`
- `architecture_requests`
- `architecture_outputs`
- `diagram_nodes`
- `diagram_edges`
- `cost_estimates`
- `security_findings`
- `iac_templates`

