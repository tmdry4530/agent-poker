# Branch Protection Rules

Recommended GitHub branch protection settings for the `master` branch.

## Required Settings

### Settings > Branches > Add branch protection rule

- **Branch name pattern**: `master`

### Protect matching branches

| Setting | Value |
|---------|-------|
| Require a pull request before merging | Yes |
| Require approvals | 1+ |
| Dismiss stale pull request approvals when new commits are pushed | Yes |
| Require status checks to pass before merging | Yes |
| Require branches to be up to date before merging | Yes |
| Status checks that are required | `ci` |
| Require conversation resolution before merging | Yes |
| Do not allow bypassing the above settings | Yes (recommended) |

### Additional recommendations

| Setting | Value |
|---------|-------|
| Restrict who can push to matching branches | Team members only |
| Allow force pushes | No |
| Allow deletions | No |

## Required Status Checks

The CI workflow (`ci.yml`) runs the following checks. All must pass before merge:

1. **Install** - `pnpm install --frozen-lockfile`
2. **Typecheck** - `pnpm typecheck` (recursive across all packages)
3. **Lint** - `pnpm lint` (recursive across all packages)
4. **Test** - `pnpm test` (recursive, runs `pnpm -r test` with vitest)
5. **Build** - `pnpm build` (recursive across all packages)
6. **E2E smoke test** - `pnpm demo` (20-hand integration test with chip conservation + replay verification)

The required status check name in GitHub is: **`ci`** (matches the job name in `ci.yml`).

## Setup via GitHub CLI

```bash
# Requires admin access to the repository
gh api repos/{owner}/{repo}/branches/master/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["ci"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null
```

## Deploy Workflow

The deploy workflow (`deploy.yml`) triggers automatically after CI succeeds on `master`. It builds and pushes Docker images to `ghcr.io`. No manual intervention is needed if branch protection is configured correctly.
