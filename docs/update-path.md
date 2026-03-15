# Update Path

The single frontend source of truth is `/workspace/_github/hexcarb-ai-command-center`.

## Release Flow

1. Make frontend changes locally in the GitHub-backed repo.
2. Commit the changes to `main`.
3. Push `main` to `origin`.
4. Wait for the `Frontend Guard` GitHub Action to pass.
5. Let Vercel deploy from GitHub.

## Verify In The UI

- Check the top bar for the `environment • commit` build badge.
- Check the top bar for the masked gateway host badge.
- Check the founder dashboard header for the build time and last refresh time.
- If the UI looks stale, compare the commit badge in the app against `git log --oneline -1`.

## Canonical Routes

- Founder dashboard: `/`
- Projects workspace: `/panel/projects`
- Low-level planning tool: `/panel/planning_api`

Legacy routes `/panel/company_planner` and `/panel/planning` now redirect to `/panel/projects`.
