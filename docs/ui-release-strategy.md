# UI Release Strategy

## Source Of Truth

- The only frontend source of truth is `/workspace/_github/hexcarb-ai-command-center`.
- GitHub `main` is the branch Vercel deploys from.
- The live UI must always be verified against the build badge shown inside the app.

## Canonical Routes

- Founder dashboard: `/`
- Projects workspace: `/panel/projects`
- Low-level planning tool: `/panel/planning_api`

## Legacy Routes

These should never be used in new links or documentation:

- `/panel/company_planner`
- `/panel/planning`

They must only exist as redirects to `/panel/projects`.

## Navigation Policy

- New product surfaces must be registered in `src/lib/panels.ts`.
- Sidebar grouping must be driven by compartments, not ad hoc hardcoded lists.
- The home page is the founder cockpit, not a raw tool catalog.
- Raw tools and debug utilities belong under `Advanced`.

## UI Change Workflow

1. Make changes only in the GitHub-backed repo.
2. Keep routes canonical and add redirects for anything renamed.
3. Commit locally with a focused message.
4. Push to `main`.
5. Wait for GitHub Actions `Frontend Guard` to pass.
6. Let Vercel deploy the latest commit from `main`.
7. Verify the deployed app shows the expected build commit in the top bar.

## Pre-Deploy Checklist

- `npm run lint`
- `npm run build`
- Check `/` renders the founder dashboard.
- Check `/panel/projects` renders the Projects workspace.
- Check `/panel/planning_api` still works as the low-level planning surface.
- Check `/panel/company_planner` and `/panel/planning` redirect to `/panel/projects`.
- Check top bar build badge shows the expected commit and environment.

## Deployment Recovery

If Vercel shows an older failed commit:

1. Do not redeploy the failed commit.
2. Confirm `origin/main` points to the latest fix.
3. Trigger a new deployment from the latest commit on `main`.
4. If needed, create an empty commit to force a fresh deploy.

## Ownership Rule

- No UI change is considered complete until GitHub is updated, the validation workflow passes, and the deployed app is verified against the in-app build badge.
