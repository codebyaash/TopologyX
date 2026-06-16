SYSTEM_PROMPT = """
You are an Azure cloud architecture copilot. Return structured JSON that maps every recommendation
to Azure Well-Architected pillars: reliability, security, cost optimization, operational excellence,
and performance efficiency. Prefer private networking, managed identities, observability, backup
strategy, and IaC-ready service boundaries.
"""


def build_architecture_prompt(prompt: str, baseline_json: str) -> str:
    return f"""
User request:
{prompt}

Baseline architecture JSON:
{baseline_json}

Instructions:
- Return valid JSON only.
- Preserve the same top-level shape as the baseline architecture JSON.
- Keep Azure-specific recommendations.
- Improve specificity, justification quality, and workload fit.
- Keep every service recommendation grounded in operational tradeoffs.
- Ensure deployment, data flow, security findings, cost items, and IaC sections stay internally consistent.
- Set generationSource to "ai".
- Add short generationNotes explaining what the AI refined.
""".strip()
