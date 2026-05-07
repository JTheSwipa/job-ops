import { logger } from "@infra/logger";
import * as jobsRepo from "@server/repositories/jobs";
import { detectLanguageFromSample } from "@server/services/output-language";
import type { ChatStyleManualLanguage, CreateJobInput } from "@shared/types";
import { progressHelpers } from "../progress";

export async function importJobsStep(args: {
  discoveredJobs: CreateJobInput[];
  listingLanguageFilter?: ChatStyleManualLanguage | null;
}): Promise<{ created: number; skipped: number }> {
  let { discoveredJobs } = args;

  if (args.listingLanguageFilter) {
    const before = discoveredJobs.length;
    discoveredJobs = discoveredJobs.filter((job) => {
      const sample = `${job.title} ${job.jobDescription ?? ""}`.slice(0, 600);
      return detectLanguageFromSample(sample) === args.listingLanguageFilter;
    });
    const dropped = before - discoveredJobs.length;
    if (dropped > 0) {
      logger.info("Dropped non-matching language jobs", {
        dropped,
        language: args.listingLanguageFilter,
      });
    }
  }

  logger.info("Importing discovered jobs");
  const { created, skipped } = await jobsRepo.createJobs(discoveredJobs);
  logger.info("Import step complete", { created, skipped });

  progressHelpers.importComplete(created, skipped);

  return { created, skipped };
}
