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

The current architecture uses a hybrid generation model:

- deterministic rules engine as the reliable baseline
- optional OpenAI or Azure OpenAI refinement path
- schema validation of AI responses before returning them
- automatic fallback to deterministic output when AI is unavailable or invalid

This keeps the product demoable without paid credentials while still supporting a real AI-backed path.

## Azure Review Framework

Recommendations map to Azure Well-Architected pillars:

- Reliability
- Security
- Cost optimization
- Operational excellence
- Performance efficiency

## Persistence Plan

The SQLAlchemy models now back active persistence for:

- `users`
- `projects`
- `architecture_requests`
- `architecture_outputs`
- `diagram_nodes`
- `diagram_edges`
- `cost_estimates`
- `security_findings`
- `iac_templates`

Current persisted workflows:

- account registration and login
- per-user project ownership
- saved generation runs
- project history retrieval

## Current Gaps

Still intentionally lightweight:

- session auth is cookie-based and local-first, not production-hardened yet
- AI responses are validated structurally, but cost/security/IaC quality still depends on downstream heuristics
- diagram export, richer node/icon system, and deeper pricing/security engines are still upcoming
