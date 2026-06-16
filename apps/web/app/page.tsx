import Link from "next/link";
import { ArrowRight, Braces, Network, ShieldCheck, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateArchitecture } from "@/lib/architecture-engine";
import { sampleScenarios } from "@/lib/samples";

const preview = generateArchitecture(sampleScenarios[0].prompt);

const capabilities = [
  {
    title: "Architecture review",
    description: "Maps recommendations to reliability, security, cost optimization, operational excellence, and performance efficiency.",
    icon: ShieldCheck
  },
  {
    title: "Cost and scaling",
    description: "Shows static monthly estimates, scaling levers, and service-by-service operational assumptions.",
    icon: WalletCards
  },
  {
    title: "Full IaC structure",
    description: "Builds Bicep and Terraform scaffolds for services, network, identities, connectors, and private access paths.",
    icon: Braces
  },
  {
    title: "Deployment topology",
    description: "Explains how ingress, compute, data, messaging, observability, and optional AI or IoT modules connect.",
    icon: Network
  }
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(12,148,136,0.12),_transparent_28%),linear-gradient(180deg,_#f7f5ef_0%,_#edf2ef_100%)]">
      <section className="border-b border-border/70">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="bg-background/70">Azure architecture copilot</Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-slate-900 sm:text-5xl">
                Turn architecture prompts into an Azure blueprint with review, cost, diagram, and full-stack IaC.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-700">
                The main flow starts with a requirement prompt and produces service recommendations, deployment structure, security findings, a React Flow diagram, and Bicep or Terraform covering the surrounding connectors and resource layout.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/generate"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Open Generator
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/projects"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200/80 bg-white/75 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Projects
              </Link>
            </div>
          </div>

          <Card className="border-slate-200/80 bg-white/85 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <CardHeader>
              <CardTitle>Overview Snapshot</CardTitle>
              <CardDescription>{preview.summary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Suggested services</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{preview.services.length}</p>
                </div>
                <div className="rounded-lg border bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Deployment modules</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{preview.deployment.length}</p>
                </div>
              </div>
              <div className="space-y-3">
                {preview.services.slice(0, 4).map((service) => (
                  <div key={service.name} className="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{service.reason}</p>
                    </div>
                    <Badge variant="secondary">{service.wellArchitectedPillar}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-normal text-slate-900">What the generator expands</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
              The landing page stays high level. The generator studio carries the deeper workflow, including editable prompt input, service map, structure tab, detailed IaC, and export actions.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {capabilities.map((item) => (
            <Card key={item.title} className="border-slate-200/80 bg-white/80">
              <CardHeader>
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <Card className="border-slate-200/80 bg-white/85">
          <CardHeader>
            <CardTitle>Example entry points</CardTitle>
            <CardDescription>Sample prompts now live on the generator page, but this gives a quick sense of the workload types the system is tuned for.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sampleScenarios.map((sample) => (
              <div key={sample.title} className="rounded-lg border bg-background p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-900">{sample.title}</p>
                  <Badge variant="outline">{sample.tag}</Badge>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{sample.prompt}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
