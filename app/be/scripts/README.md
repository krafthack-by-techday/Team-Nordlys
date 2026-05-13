# Getting-started scripts

Helper scripts for developers. Each task is available in both `.sh` (macOS/Linux) and `.ps1` (Windows).

| Script | What it does |
|---|---|
| `setup` | First-time setup: checks Bun + Docker, runs `bun install`. |
| `dev-up` | Starts postgres + redis, runs DB migrations. You then run services directly with `bun` for hot iteration. |
| `stack-up` | Starts the full dockerized stack (all services). Pass `--rebuild` / `-Rebuild` after code changes. |
| `dev-down` | Stops containers (data is kept in volume). Works for both `dev-up` and `stack-up`. |
| `dev-reset` | Drops the DB schema, re-migrates. Use when schema changes from `main` have conflicts. |
| `check` | Typecheck + full bun:test suite across all workspaces. Run before committing. |
| `smoke` | Runs all three smoke tests end-to-end against a live stack (varde basic, mesh full flow, invite flow). |

## Typical flow for a new developer

```bash
# macOS / Linux
./scripts/setup.sh
./scripts/dev-up.sh
./scripts/check.sh
./scripts/smoke.sh
```

```powershell
# Windows
./scripts/setup.ps1
./scripts/dev-up.ps1
./scripts/check.ps1
./scripts/smoke.ps1
```

Services are run ad-hoc in terminals afterwards — see `app/be/README.md` for `bun services/<svc>/src/index.ts` commands with the correct env.
