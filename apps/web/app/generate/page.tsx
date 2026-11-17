import { Suspense } from "react";
import { ArchitectureCopilot } from "@/components/ArchitectureCopilot";

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" aria-label="Loading architecture workspace" />}>
      <ArchitectureCopilot />
    </Suspense>
  );
}
