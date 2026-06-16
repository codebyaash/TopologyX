from app.schemas.architecture import CostEstimate, CostLineItem
from app.services.architecture.catalog import infer_workload


def estimate_cost(prompt: str, services: list[dict[str, str]]) -> CostEstimate:
    workload = infer_workload(prompt)
    multiplier = 1.7 if workload.high_scale else 2.1 if workload.multi_region else 1
    base_items = [
        ("Azure Front Door + WAF", "Standard/Premium ingress with managed WAF policy", 290),
        ("API Management", "Standard v2 baseline API gateway", 690),
        ("Azure Functions", "Premium plan with two warm instances", 420),
        ("Service Bus", "Premium messaging unit" if workload.high_scale else "Standard brokered messaging", 780 if workload.high_scale else 80),
        ("Azure SQL", "Business Critical primary plus geo-replica" if workload.multi_region else "General Purpose production database", 1800 if workload.multi_region else 620),
        ("Storage", "1 TB hot ZRS storage with lifecycle policies", 110),
        ("Monitor", "100 GB/month log and trace ingestion", 280),
        ("Key Vault", "Standard secrets and key operations", 25),
    ]

    ai_items = [(service["name"], f"{service['tier']} pilot workload", 250 if "Search" in service["name"] else 180) for service in services if "AI" in service["name"]]
    items = [CostLineItem(service=name, assumption=assumption, monthlyUsd=round(cost * multiplier)) for name, assumption, cost in [*base_items, *ai_items]]

    return CostEstimate(
        monthlyUsd=sum(item.monthlyUsd for item in items),
        items=items,
        disclaimer="Static portfolio estimate only. Validate production pricing with the Azure Pricing Calculator before committing spend.",
    )

