# job-ops

AI-powered job search automation platform. Self-hosted, TypeScript monorepo.

## Stack

```
Language:     TypeScript (strict)
Runtime:      Node.js 22.22.1
Frontend:     React + Vite + Tailwind + Radix UI
Backend:      Express.js
ORM:          Drizzle ORM
Linter:       Biome
Monorepo:     npm workspaces
```

## Monorepo layout

```
job-ops/
├── orchestrator/        # Main app (Express backend + React frontend)
│   └── src/
│       ├── server/
│       │   ├── pipeline/        # Core pipeline engine + orchestrator
│       │   ├── api/routes/      # Express API routes
│       │   ├── repositories/    # DB queries (Drizzle)
│       │   └── services/        # LLM, PDF, language detection
│       └── client/
│           ├── pages/           # React pages
│           └── components/ui/   # Shared UI components
├── shared/              # Types, settings registry, extractors
├── extractors/          # Per-board scraping logic
└── docs-site/           # Documentation
```

## Commands

```bash
# Development (hot reload)
cd orchestrator && npm run dev

# Production (Docker)
docker compose up --build -d        # opens at http://localhost:3005
docker compose down

# Linting
npx biome check .
npx biome check --write .

# Type checking
npx tsc --noEmit
```

## Key conventions

- Drizzle ORM for all DB access — no raw SQL except in repositories layer
- Biome for formatting and linting (not ESLint/Prettier)
- All new settings go through `shared/src/settings-registry.ts`
- Pipeline steps live in `orchestrator/src/server/pipeline/steps/`
- React components use Radix UI primitives + Tailwind

## Custom extensions (uncommitted, working-tree only)

This fork adds 4 features on top of upstream DaKheera47/job-ops v0.5.0:

1. **Multi-country pipeline** — `resolveCountries()` loop in `orchestrator.ts`; `MultiSelectDropdown` UI in `AutomaticRunTab.tsx`; `selectedCountries` setting
2. **External link button** — `ExternalLink` icon in `JobRowContent.tsx` (line 75–86)
3. **Listing language filter** — `detectLanguageFromSample()` in `services/output-language.ts`; filter applied in `import-jobs.ts`; `listingLanguageFilter` setting
4. **Delete non-matching language jobs** — count + delete API endpoints in `routes/jobs.ts` (lines 1887–1941); UI in `ScoringSettingsSection.tsx`

Full PRD: `~/Desktop/Jobhunt/job-ops-PRD.md`

---

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`

### How to use gstack on this project

| Task | Command |
|---|---|
| Review a new feature before committing | `/review` |
| Plan a new pipeline feature | `/plan-eng-review` |
| Security audit a new API endpoint | `/cso` |
| QA the job list or settings UI | `/qa http://localhost:3005` |
| Investigate a pipeline bug | `/investigate` |
| Ship a PR | `/ship` |
| Refine a feature idea | `/office-hours` |
