from app.schemas.architecture import SecurityFinding, SecurityProfile
from app.services.architecture.catalog import infer_workload


def review_security(prompt: str, services: list[dict[str, str]]) -> list[SecurityFinding]:
    service_names = " ".join(service["name"].lower() for service in services)
    text = prompt.lower()
    findings: list[SecurityFinding] = []

    checks = [
        ("key vault", "High", "Missing Key Vault", "Secrets require centralized storage and access policies.", "Use Key Vault with managed identities and rotation policies."),
        ("private endpoints", "High", "Public data plane exposure", "Databases and storage should not be reachable from the public internet.", "Add private endpoints and disable public network access."),
        ("waf", "Medium", "No WAF/API gateway", "Public APIs need managed edge filtering and request policy enforcement.", "Add Front Door WAF and API Management policies."),
        ("monitor", "Medium", "No monitoring strategy", "The architecture needs health, audit, and incident telemetry.", "Send app and platform logs to Log Analytics with alerts."),
    ]

    for needle, severity, title, detail, remediation in checks:
        if needle not in service_names:
            findings.append(SecurityFinding(severity=severity, title=title, detail=detail, remediation=remediation))

    if "backup" not in text and "restore" not in text:
        findings.append(SecurityFinding(severity="Medium", title="Backup strategy needs proof", detail="The requirement does not mention recovery point or recovery time objectives.", remediation="Define RPO/RTO, enable PITR, and run restore drills."))
    if "rbac" not in text and "managed identity" not in text:
        findings.append(SecurityFinding(severity="Low", title="RBAC assumptions should be explicit", detail="Least-privilege identity boundaries should be documented.", remediation="Use Azure RBAC, managed identities, and privileged access review."))
    if "encrypt" not in text:
        findings.append(SecurityFinding(severity="Low", title="Encryption requirements implicit", detail="Azure services encrypt by default, but regulated workloads need explicit key ownership decisions.", remediation="Document encryption at rest, TLS, and when customer-managed keys are required."))

    return findings


def build_security_profile(prompt: str, services: list[dict[str, str]]) -> SecurityProfile:
    workload = infer_workload(prompt)
    packs: list[str] = []
    policy_recommendations = [
        "Enforce private endpoints, approved regions, and diagnostic settings with Azure Policy initiatives.",
        "Require managed identities over shared secrets for service-to-service access.",
        "Deny public network access on data services unless a documented exception exists.",
    ]

    if workload.healthcare:
        packs.extend(["HIPAA", "PHI Handling"])
        policy_recommendations.extend(
            [
                "Apply policies for audit log retention, customer-managed key review, and backup evidence collection.",
                "Require restore-drill evidence and access review on patient-data paths.",
            ]
        )
    if workload.finance:
        packs.extend(["PCI-minded Controls", "Financial Audit"])
        policy_recommendations.extend(
            [
                "Require stronger API policy enforcement, WAF logging, and privileged access review for payment paths.",
                "Audit database and message-path encryption ownership decisions before production rollout.",
            ]
        )
    if not packs and ("insurance" in prompt.lower() or "claims" in prompt.lower() or "customer" in prompt.lower()):
        packs.extend(["PII Handling", "Operational Audit"])
        policy_recommendations.extend(
            [
                "Apply retention, masking, and secure document-handling controls for claim and customer evidence.",
                "Enforce secure communication workflows and approval-bound payout actions with audit traces.",
            ]
        )
    if workload.ai:
        packs.append("PII Review for AI Pipelines")
        policy_recommendations.append("Require private AI endpoints, content traceability, and document access boundaries for AI ingestion stages.")
    if workload.iot:
        packs.append("Device Identity")
        policy_recommendations.append("Require per-device identity controls, rotation policy, and telemetry ingress monitoring.")

    defender_present = any("defender" in service["name"].lower() for service in services)
    identity_strategy = (
        "Managed identities with RBAC, privileged access review, and centralized posture management."
        if defender_present
        else "Managed identities with RBAC and explicit least-privilege boundaries across compute, data, and messaging."
    )
    network_boundary = (
        "Private ingress-to-data paths with segmented subnets, private endpoints, and policy-enforced public access exceptions only."
    )

    return SecurityProfile(
        compliancePacks=packs or ["Azure Baseline Security"],
        identityStrategy=identity_strategy,
        networkBoundary=network_boundary,
        policyRecommendations=policy_recommendations,
    )
