from app.schemas.architecture import SecurityFinding


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

