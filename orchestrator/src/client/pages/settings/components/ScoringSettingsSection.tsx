import * as api from "@client/api";
import { TokenizedInput } from "@client/pages/orchestrator/TokenizedInput";
import { SettingsInput } from "@client/pages/settings/components/SettingsInput";
import { SettingsSectionFrame } from "@client/pages/settings/components/SettingsSectionFrame";
import type { ScoringValues } from "@client/pages/settings/types";
import {
  CHAT_STYLE_MANUAL_LANGUAGE_LABELS,
  CHAT_STYLE_MANUAL_LANGUAGE_VALUES,
  type ChatStyleManualLanguage,
} from "@shared/types.js";
import type { UpdateSettingsInput } from "@shared/settings-schema.js";
import type React from "react";
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ScoringSettingsSectionProps = {
  values: ScoringValues;
  isLoading: boolean;
  isSaving: boolean;
  layoutMode?: "accordion" | "panel";
  onDeleteByLanguage?: (language: ChatStyleManualLanguage) => Promise<void>;
};

function parseTokenizedKeywordInput(input: string): string[] {
  return input
    .split(/[\n,]/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

export const ScoringSettingsSection: React.FC<ScoringSettingsSectionProps> = ({
  values,
  isLoading,
  isSaving,
  layoutMode,
  onDeleteByLanguage,
}) => {
  const {
    penalizeMissingSalary,
    missingSalaryPenalty,
    autoSkipScoreThreshold,
    blockedCompanyKeywords,
    scoringInstructions,
    listingLanguageFilter,
  } = values;
  const { control, watch, setValue } = useFormContext<UpdateSettingsInput>();
  const [blockedCompanyKeywordDraft, setBlockedCompanyKeywordDraft] =
    useState("");
  const [isDeletingByLanguage, setIsDeletingByLanguage] = useState(false);
  const [isCountingByLanguage, setIsCountingByLanguage] = useState(false);
  const [languageDeleteDialogOpen, setLanguageDeleteDialogOpen] = useState(false);
  const [nonMatchingCount, setNonMatchingCount] = useState<number | null>(null);

  const currentListingLanguageFilter =
    (watch("listingLanguageFilter") as ChatStyleManualLanguage | null | undefined) ??
    listingLanguageFilter.effective;

  // Watch the current form value to conditionally show/hide penalty input
  const currentPenalizeEnabled =
    watch("penalizeMissingSalary") ?? penalizeMissingSalary.default;

  // Watch auto-skip threshold to show current value
  const currentAutoSkipThreshold = watch("autoSkipScoreThreshold");
  const blockedCompanyKeywordValues =
    watch("blockedCompanyKeywords") ?? blockedCompanyKeywords.default;

  return (
    <SettingsSectionFrame
      mode={layoutMode}
      title="Scoring Settings"
      value="scoring"
    >
      <div className="space-y-4">
        {/* Enable penalty toggle */}
        <div className="flex items-start space-x-3">
          <Controller
            name="penalizeMissingSalary"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="penalizeMissingSalary"
                checked={field.value ?? penalizeMissingSalary.default}
                onCheckedChange={(checked) => {
                  field.onChange(
                    checked === "indeterminate" ? null : checked === true,
                  );
                }}
                disabled={isLoading || isSaving}
              />
            )}
          />
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="penalizeMissingSalary"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Penalize Missing Salary
            </label>
            <p className="text-xs text-muted-foreground">
              Reduce suitability scores for jobs that do not include salary
              information. Jobs with any salary text (including "Competitive")
              are not penalized.
            </p>
          </div>
        </div>

        {/* Penalty amount input - only shown when enabled */}
        {currentPenalizeEnabled && (
          <div className="pl-7">
            <Controller
              name="missingSalaryPenalty"
              control={control}
              render={({ field }) => (
                <SettingsInput
                  label="Penalty Amount"
                  type="number"
                  inputProps={{
                    ...field,
                    inputMode: "numeric",
                    min: 0,
                    max: 100,
                    step: 1,
                    value: field.value ?? missingSalaryPenalty.default,
                    onChange: (event) => {
                      const value = parseInt(event.target.value, 10);
                      if (Number.isNaN(value)) {
                        field.onChange(null);
                      } else {
                        field.onChange(Math.min(100, Math.max(0, value)));
                      }
                    },
                  }}
                  disabled={isLoading || isSaving}
                  helper={`Points to subtract from suitability score (0-100). Default: ${missingSalaryPenalty.default}.`}
                  current={`Effective: ${missingSalaryPenalty.effective} | Default: ${missingSalaryPenalty.default}`}
                />
              )}
            />
          </div>
        )}

        <Separator />

        {/* Auto-skip threshold input */}
        <div className="space-y-3">
          <Controller
            name="autoSkipScoreThreshold"
            control={control}
            render={({ field }) => (
              <SettingsInput
                label="Auto-skip Score Threshold"
                type="number"
                inputProps={{
                  ...field,
                  inputMode: "numeric",
                  min: 0,
                  max: 100,
                  step: 1,
                  value: field.value ?? "",
                  onChange: (event) => {
                    const value = event.target.value;
                    if (value === "" || value === null) {
                      field.onChange(null);
                    } else {
                      const parsed = parseInt(value, 10);
                      if (Number.isNaN(parsed)) {
                        field.onChange(null);
                      } else {
                        field.onChange(Math.min(100, Math.max(0, parsed)));
                      }
                    }
                  },
                  placeholder: "Disabled",
                }}
                disabled={isLoading || isSaving}
                helper="Jobs scoring below this threshold will be automatically skipped during scoring. Leave empty to disable auto-skip. (0-100)"
                current={`Effective: ${currentAutoSkipThreshold === null || currentAutoSkipThreshold === undefined ? "Disabled" : currentAutoSkipThreshold} | Default: ${autoSkipScoreThreshold.default ?? "Disabled"}`}
              />
            )}
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <label
            htmlFor="scoringInstructions"
            className="text-sm font-medium leading-none"
          >
            Scoring Instructions
          </label>
          <Controller
            name="scoringInstructions"
            control={control}
            render={({ field }) => (
              <div className="space-y-2">
                <Textarea
                  id="scoringInstructions"
                  value={field.value ?? scoringInstructions.default}
                  onChange={(event) => field.onChange(event.target.value)}
                  placeholder="Example: Open to relocating, so do not mark down for location discrepancies. Prioritize visa sponsorship and backend API work."
                  disabled={isLoading || isSaving}
                  maxLength={4000}
                />
                <div className="text-xs text-muted-foreground">
                  Optional guidance for the AI scorer about what to weigh more
                  or less. This only changes scoring, not Ghostwriter or
                  tailoring.
                </div>
                <div className="text-xs text-muted-foreground">
                  Current:{" "}
                  <span className="font-mono">
                    {scoringInstructions.effective || "—"}
                  </span>
                </div>
              </div>
            )}
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <label
            htmlFor="blocked-company-keywords"
            className="text-sm font-medium leading-none"
          >
            Blocked Company Keywords
          </label>
          <TokenizedInput
            id="blocked-company-keywords"
            values={blockedCompanyKeywordValues}
            draft={blockedCompanyKeywordDraft}
            parseInput={parseTokenizedKeywordInput}
            onDraftChange={setBlockedCompanyKeywordDraft}
            onValuesChange={(value) =>
              setValue("blockedCompanyKeywords", value, { shouldDirty: true })
            }
            placeholder='e.g. "recruitment", "staffing"'
            helperText="Jobs whose company name contains one of these keywords will be dropped during discovery."
            removeLabelPrefix="Remove blocked keyword"
            disabled={isLoading || isSaving}
          />
          <div className="break-words font-mono text-xs text-muted-foreground">
            Effective:{" "}
            {blockedCompanyKeywordValues.length > 0
              ? blockedCompanyKeywordValues.join(", ")
              : "None"}{" "}
            | Default:{" "}
            {blockedCompanyKeywords.default.length > 0
              ? blockedCompanyKeywords.default.join(", ")
              : "None"}
          </div>
        </div>

        <Separator />

        {/* Listing language filter */}
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium leading-none">
              Listing Language Filter
            </label>
            <p className="text-xs text-muted-foreground mt-1.5">
              Only import jobs whose listing is detected as this language. Jobs
              in other languages are dropped before scoring. Leave empty to
              import all languages.
            </p>
          </div>
          <Controller
            name="listingLanguageFilter"
            control={control}
            render={({ field }) => (
              <Select
                value={(field.value as string | null | undefined) ?? "none"}
                onValueChange={(val) =>
                  field.onChange(val === "none" ? null : val)
                }
                disabled={isLoading || isSaving}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="No filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No filter</SelectItem>
                  {CHAT_STYLE_MANUAL_LANGUAGE_VALUES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {CHAT_STYLE_MANUAL_LANGUAGE_LABELS[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {currentListingLanguageFilter && onDeleteByLanguage && (
            <>
              <Button
                variant="destructive"
                size="sm"
                disabled={isLoading || isSaving || isCountingByLanguage || isDeletingByLanguage}
                onClick={async () => {
                  setIsCountingByLanguage(true);
                  try {
                    const result = await api.countJobsByNonMatchingLanguage(currentListingLanguageFilter);
                    setNonMatchingCount(result.count);
                    setLanguageDeleteDialogOpen(true);
                  } catch {
                    setNonMatchingCount(null);
                    setLanguageDeleteDialogOpen(true);
                  } finally {
                    setIsCountingByLanguage(false);
                  }
                }}
              >
                {isCountingByLanguage
                  ? "Checking…"
                  : `Delete jobs not in ${CHAT_STYLE_MANUAL_LANGUAGE_LABELS[currentListingLanguageFilter]}`}
              </Button>

              <AlertDialog
                open={languageDeleteDialogOpen}
                onOpenChange={setLanguageDeleteDialogOpen}
              >
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete non-matching jobs?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        {nonMatchingCount !== null && (
                          <p className="text-sm font-medium">
                            Found{" "}
                            <span className="text-destructive font-bold">
                              {nonMatchingCount} job{nonMatchingCount !== 1 ? "s" : ""}
                            </span>{" "}
                            not detected as{" "}
                            <strong>
                              {CHAT_STYLE_MANUAL_LANGUAGE_LABELS[currentListingLanguageFilter]}
                            </strong>
                            .
                          </p>
                        )}
                        <p>
                          This will permanently delete{" "}
                          {nonMatchingCount !== null ? `all ${nonMatchingCount}` : "all non-matching"} jobs
                          (applied and in-progress jobs are always preserved).
                          This cannot be undone.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel
                      onClick={() => {
                        setLanguageDeleteDialogOpen(false);
                        setNonMatchingCount(null);
                      }}
                    >
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isDeletingByLanguage || nonMatchingCount === 0}
                      onClick={async () => {
                        setIsDeletingByLanguage(true);
                        try {
                          await onDeleteByLanguage(currentListingLanguageFilter);
                          setLanguageDeleteDialogOpen(false);
                          setNonMatchingCount(null);
                        } finally {
                          setIsDeletingByLanguage(false);
                        }
                      }}
                    >
                      {isDeletingByLanguage
                        ? "Deleting…"
                        : nonMatchingCount === 0
                          ? "Nothing to delete"
                          : `Delete ${nonMatchingCount ?? ""} jobs`}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>

        <Separator />

        {/* Effective/Default values display */}
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Penalty Enabled</div>
            <div className="break-words font-mono text-xs">
              Effective: {penalizeMissingSalary.effective ? "Yes" : "No"} |
              Default: {penalizeMissingSalary.default ? "Yes" : "No"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Penalty Amount</div>
            <div className="break-words font-mono text-xs">
              Effective: {missingSalaryPenalty.effective} | Default:{" "}
              {missingSalaryPenalty.default}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Auto-skip Threshold
            </div>
            <div className="break-words font-mono text-xs">
              Effective: {autoSkipScoreThreshold.effective ?? "Disabled"} |
              Default: {autoSkipScoreThreshold.default ?? "Disabled"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Scoring Instructions
            </div>
            <div className="break-words font-mono text-xs">
              Effective: {scoringInstructions.effective || "—"} | Default:{" "}
              {scoringInstructions.default || "—"}
            </div>
          </div>
        </div>
      </div>
    </SettingsSectionFrame>
  );
};
