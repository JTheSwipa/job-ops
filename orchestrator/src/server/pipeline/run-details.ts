import {
  createLocationIntentFromLegacyInputs,
  planLocationSources,
} from "@shared/location-domain.js";
import { formatCountryLabel } from "@shared/location-support.js";
import { parseSearchCitiesSetting } from "@shared/search-cities.js";
import type {
  AppSettings,
  PipelineConfig,
  PipelineRunEffectiveConfig,
  PipelineRunExecutionStage,
  PipelineRunRequestedConfig,
  PipelineRunResultSummary,
  PipelineRunSavedDetails,
} from "@shared/types";
import { getEffectiveSettings } from "../services/settings";

type SnapshotLocationIntent = NonNullable<PipelineConfig["locationIntent"]>;

function resolveLocationIntentSnapshot(args: {
  config: PipelineConfig;
  settings: AppSettings;
}): SnapshotLocationIntent {
  return (
    args.config.locationIntent ??
    createLocationIntentFromLegacyInputs({
      country: args.settings.jobspyCountryIndeed.value,
      searchCities: parseSearchCitiesSetting(args.settings.searchCities.value),
      workplaceTypes: args.settings.workplaceTypes.value,
      searchScope: args.settings.locationSearchScope.value,
      matchStrictness: args.settings.locationMatchStrictness.value,
    })
  );
}

export function buildRequestedConfigSnapshot(
  config: PipelineConfig,
): PipelineRunRequestedConfig {
  return {
    topN: config.topN,
    minSuitabilityScore: config.minSuitabilityScore,
    sources: [...config.sources],
    enableCrawling: config.enableCrawling !== false,
    enableScoring: config.enableScoring !== false,
    enableImporting: config.enableImporting !== false,
    enableAutoTailoring: config.enableAutoTailoring !== false,
  };
}

function buildEffectiveConfigSnapshot(args: {
  requestedConfig: PipelineRunRequestedConfig;
  settings: AppSettings;
  locationIntent: SnapshotLocationIntent;
  countries?: string[];
}): PipelineRunEffectiveConfig {
  const sourcePlans = planLocationSources({
    intent: args.locationIntent,
    sources: args.requestedConfig.sources,
  });
  const compatibleSources = args.requestedConfig.sources.filter((source) =>
    sourcePlans.compatibleSources.includes(source),
  );
  const country = args.locationIntent.selectedCountry;
  const countryLabel = country ? formatCountryLabel(country) || country : null;
  const countries = args.countries && args.countries.length > 0 ? args.countries : (country ? [country] : []);
  const countryLabels = countries.map((c) => formatCountryLabel(c) || c);

  return {
    country,
    countryLabel,
    countries,
    countryLabels,
    searchCities: [...args.locationIntent.cityLocations],
    searchTermsCount: args.settings.searchTerms.value.length,
    workplaceTypes: [...args.locationIntent.workplaceTypes],
    locationSearchScope: args.locationIntent.searchScope,
    locationMatchStrictness: args.locationIntent.matchStrictness,
    compatibleSources,
    skippedSources: args.requestedConfig.sources
      .filter((source) => !compatibleSources.includes(source))
      .map((source) => ({
        source,
        reason:
          sourcePlans.plans
            .find((plan) => plan.source === source)
            ?.reasons.join(" ") || "Not available for the selected location",
      })),
    blockedCompanyKeywordsCount:
      args.settings.blockedCompanyKeywords.value.length,
    sourceLimits: {
      ukvisajobsMaxJobs: args.settings.ukvisajobsMaxJobs.value,
      adzunaMaxJobsPerTerm: args.settings.adzunaMaxJobsPerTerm.value,
      gradcrackerMaxJobsPerTerm: args.settings.gradcrackerMaxJobsPerTerm.value,
      startupjobsMaxJobsPerTerm: args.settings.startupjobsMaxJobsPerTerm.value,
      jobindexMaxJobsPerTerm: args.settings.jobindexMaxJobsPerTerm.value,
      naukriMaxJobsPerTerm: args.settings.naukriMaxJobsPerTerm.value,
      jobspyResultsWanted: args.settings.jobspyResultsWanted.value,
    },
    autoSkipScoreThreshold: args.settings.autoSkipScoreThreshold.value,
    pdfRenderer: args.settings.pdfRenderer.value,
    models: {
      scorer: args.settings.modelScorer.value,
      tailoring: args.settings.modelTailoring.value,
      projectSelection: args.settings.modelProjectSelection.value,
    },
    resumeProjects: {
      maxProjects: args.settings.resumeProjects.value.maxProjects,
      lockedProjectCount:
        args.settings.resumeProjects.value.lockedProjectIds.length,
      aiSelectableProjectCount:
        args.settings.resumeProjects.value.aiSelectableProjectIds.length,
    },
  };
}

export async function buildPipelineRunSavedDetails(
  config: PipelineConfig,
  countries?: string[],
): Promise<PipelineRunSavedDetails> {
  const requestedConfig = buildRequestedConfigSnapshot(config);
  const settings = await getEffectiveSettings();
  const locationIntent = resolveLocationIntentSnapshot({ config, settings });

  return {
    requestedConfig,
    effectiveConfig: buildEffectiveConfigSnapshot({
      requestedConfig,
      settings,
      locationIntent,
      countries,
    }),
    resultSummary: createPipelineRunResultSummary(),
  };
}

export function createPipelineRunResultSummary(
  overrides: Partial<PipelineRunResultSummary> = {},
): PipelineRunResultSummary {
  return {
    stage: "started",
    jobsScored: null,
    jobsSelected: null,
    sourceErrors: [],
    ...overrides,
  };
}

export function updatePipelineRunResultSummary(
  current: PipelineRunResultSummary | null | undefined,
  update: Partial<PipelineRunResultSummary> & {
    stage?: PipelineRunExecutionStage;
  },
): PipelineRunResultSummary {
  return {
    ...createPipelineRunResultSummary(),
    ...(current ?? {}),
    ...update,
  };
}
