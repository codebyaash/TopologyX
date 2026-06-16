import type {
  ArchitectureOutput,
  CostLineItem,
  ObservabilityDepth,
  RecommendationKey,
  RunContext,
  ServiceRecommendation,
  TrafficProfile
} from "@/lib/types";

export type RecommendationProfile = {
  key: RecommendationKey;
  label: string;
  description: string;
  services: ServiceRecommendation[];
  totalMonthlyUsd: number;
};

export function buildRecommendationProfiles(output: ArchitectureOutput): RecommendationProfile[] {
  const baseTotal = output.services.reduce((sum, service) => sum + service.estimatedMonthlyUsd, 0);
  const multiplier = baseTotal > 0 ? output.costEstimate.monthlyUsd / baseTotal : 1;
  const scaledCost = (value: number) => Math.round(value * multiplier);

  return [
    {
      key: "recommendation1",
      label: "Recommendation 1",
      description: "Balanced default for the current workload.",
      services: output.services.map((service) => ({
        ...service,
        estimatedMonthlyUsd: scaledCost(service.estimatedMonthlyUsd)
      })),
      totalMonthlyUsd: output.costEstimate.monthlyUsd
    },
    {
      key: "recommendation2",
      label: "Recommendation 2",
      description: "Cost-leaning alternative using the first substitute where available.",
      services: output.services.map((service) => {
        const option = service.alternatives[0];
        return option
          ? {
              ...service,
              name: option.name,
              tier: option.tier,
              justification: option.justification,
              estimatedMonthlyUsd: scaledCost(option.estimatedMonthlyUsd)
            }
          : {
              ...service,
              estimatedMonthlyUsd: scaledCost(service.estimatedMonthlyUsd)
            };
      }),
      totalMonthlyUsd: output.services.reduce((sum, service) => sum + scaledCost(service.alternatives[0]?.estimatedMonthlyUsd ?? service.estimatedMonthlyUsd), 0)
    },
    {
      key: "recommendation3",
      label: "Recommendation 3",
      description: "Second alternative path with a different operational tradeoff profile.",
      services: output.services.map((service) => {
        const option = service.alternatives[1];
        return option
          ? {
              ...service,
              name: option.name,
              tier: option.tier,
              justification: option.justification,
              estimatedMonthlyUsd: scaledCost(option.estimatedMonthlyUsd)
            }
          : {
              ...service,
              estimatedMonthlyUsd: scaledCost(service.estimatedMonthlyUsd)
            };
      }),
      totalMonthlyUsd: output.services.reduce((sum, service) => sum + scaledCost(service.alternatives[1]?.estimatedMonthlyUsd ?? service.estimatedMonthlyUsd), 0)
    }
  ];
}

export function serviceMultiplier(
  service: string,
  trafficProfile: TrafficProfile,
  regionCount: number,
  observabilityDepth: ObservabilityDepth
) {
  const normalized = service.toLowerCase();
  let multiplier = 1;

  if (normalized.includes("front door") || normalized.includes("api") || normalized.includes("functions") || normalized.includes("service bus")) {
    multiplier *= trafficProfile === "burst" ? 1.45 : trafficProfile === "growth" ? 1.2 : 1;
  }

  if (normalized.includes("sql") || normalized.includes("storage") || normalized.includes("private endpoint") || normalized.includes("virtual network")) {
    multiplier *= 1 + (regionCount - 1) * 0.32;
  }

  if (normalized.includes("monitor") || normalized.includes("insights")) {
    multiplier *= observabilityDepth === "deep" ? 1.7 : observabilityDepth === "standard" ? 1.15 : 0.8;
  }

  if (normalized.includes("defender")) {
    multiplier *= regionCount > 1 ? 1.15 : 1;
  }

  return multiplier;
}

export function buildAdjustedCostItems(profile: RecommendationProfile, context: RunContext): CostLineItem[] {
  return profile.services.map((service) => ({
    service: service.name,
    assumption: `${service.tier} selected in ${profile.label.toLowerCase()}`,
    monthlyUsd: Math.round(service.estimatedMonthlyUsd * serviceMultiplier(service.name, context.trafficProfile, context.regionCount, context.observabilityDepth))
  }));
}

export function resolveRunContext(runContext?: RunContext | null): RunContext {
  return (
    runContext ?? {
      recommendationKey: "recommendation1",
      recommendationLabel: "Recommendation 1",
      recommendationDescription: "Balanced default for the current workload.",
      trafficProfile: "steady",
      regionCount: 1,
      observabilityDepth: "standard"
    }
  );
}

export function formatTrafficProfileLabel(trafficProfile: TrafficProfile) {
  return trafficProfile === "burst" ? "Burst / Peak" : trafficProfile === "growth" ? "Growth" : "Steady";
}

export function formatObservabilityDepthLabel(observabilityDepth: ObservabilityDepth) {
  return observabilityDepth === "deep" ? "Deep retention" : observabilityDepth === "lean" ? "Lean" : "Standard";
}
