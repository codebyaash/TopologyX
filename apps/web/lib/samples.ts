import type { SampleScenario } from "@/lib/types";

export const sampleScenarios: SampleScenario[] = [
  {
    title: "HIPAA EHR",
    tag: "Healthcare",
    prompt: "Design a HIPAA-compliant EHR platform handling 1M requests/day with private patient records, audit logging, backups, and secure provider access."
  },
  {
    title: "Event Ecommerce",
    tag: "Retail",
    prompt: "Design an event-driven ecommerce platform for flash sales with inventory updates, checkout, fraud checks, and order fulfillment."
  },
  {
    title: "Fintech Payments",
    tag: "Finance",
    prompt: "Design a fintech payment processing platform with PCI-minded controls, ledger storage, event streaming, fraud monitoring, and high availability."
  },
  {
    title: "Multi-region SaaS",
    tag: "SaaS",
    prompt: "Design a multi-region B2B SaaS application with tenant isolation, SSO, analytics, automated backups, and low-latency APIs."
  },
  {
    title: "IoT Telemetry",
    tag: "IoT",
    prompt: "Design an IoT telemetry ingestion platform handling device messages, hot-path alerts, cold storage, dashboards, and fleet identity."
  },
  {
    title: "AI Documents",
    tag: "AI",
    prompt: "Design an AI document processing platform with file ingestion, OCR, vector search, human review, PII protection, and asynchronous workflows."
  },
  {
    title: "CRM Platform",
    tag: "CRM",
    prompt: "Design a CRM platform for sales and customer success with tenant isolation, lead ingestion, workflow automation, reporting dashboards, audit logs, and role-based access."
  },
  {
    title: "Insurance Claims",
    tag: "Insurance",
    prompt: "Design an insurance claims processing workflow with FNOL intake, document uploads, fraud checks, adjuster assignment, policy lookup, secure customer communications, and payout approvals."
  },
  {
    title: "Shop Operations",
    tag: "Commerce",
    prompt: "Design a shop operations platform connecting catalog, inventory sync, order orchestration, returns processing, warehouse updates, customer notifications, and finance reconciliation."
  }
];
