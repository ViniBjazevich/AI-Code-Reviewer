# AI Code Reviewer

AI-powered GitHub code review assistant. Connect a repository and every pull request gets reviewed automatically — inline comments on bugs, security issues, performance problems, and a scorecard across security, performance, readability, and correctness.

## Tech Stack

- [Next.js 14](https://nextjs.org/) (App Router, TypeScript strict mode)
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) for data storage
- [NextAuth.js](https://next-auth.js.org/) with the GitHub provider for auth
- [Anthropic SDK](https://docs.anthropic.com/) (`claude-sonnet-4-6`) for the actual review
- [Inngest](https://www.inngest.com/) for background job processing
- [Octokit](https://github.com/octokit/octokit.js) for GitHub API calls

## How it works

1. A GitHub webhook fires on `pull_request` (`opened`, `synchronize`, `reopened`) and hits [`/api/webhooks/github`](app/api/webhooks/github/route.ts).
2. The webhook handler verifies the signature, checks the repo is an enabled installation, creates a `pending` row in `pull_requests`, and sends a `github/pr.opened` event to Inngest.
3. The [`review-pr`](lib/functions/review-pr.ts) Inngest function picks up the event: it fetches the changed files via Octokit, skips lockfiles/minified/build output, chunks each diff to stay under the model's context budget, and asks Claude to review each chunk.
4. Comments are aggregated, scored, and saved to `review_comments`; the `pull_requests` row is updated with per-category scores and marked `completed`.
5. The review is posted back to the PR on GitHub as inline comments plus a summary review.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Fill in `.env.local` (already present, gitignored via `.env*`):

| Variable | Required for | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Everything | Project URL from Supabase Project Settings → API |
| `SUPABASE_PUBLISHABLE_KEY` | Everything | The `anon`/"Publishable key" from the same page |
| `SUPABASE_SECRET_KEY` | Everything | The `service_role`/"Secret key" — bypasses RLS, server-only |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Sign-in | From a GitHub OAuth App (not a GitHub App) — see step 4 |
| `TOKEN_ENCRYPTION_KEY` | Sign-in | A 64-character hex string (32 bytes) used to encrypt stored GitHub access tokens, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NEXTAUTH_SECRET` | Sign-in | Any random string, e.g. `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Sign-in | `http://localhost:3000` for local dev |
| `ANTHROPIC_API_KEY` | AI reviews | From [console.anthropic.com](https://console.anthropic.com) |
| `GITHUB_WEBHOOK_SECRET` | Webhook-triggered reviews | Any random string, e.g. `openssl rand -hex 20` |
| `INNGEST_DEV` | Local background jobs | Set to `1` so the SDK runs in local dev mode instead of expecting cloud signing keys |

### 3. Set up the database

Run the migration in [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) against your Supabase project (SQL Editor → paste → Run). It creates `users`, `installations`, `pull_requests`, and `review_comments`, with row-level security enabled — all reads/writes go through the server using the secret key.

### 4. Create a GitHub OAuth App

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App:
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

Copy the Client ID into `GITHUB_CLIENT_ID`, generate a secret into `GITHUB_CLIENT_SECRET`.

### 5. Run the app

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000), click "Connect GitHub", and use the dashboard to connect a repo. This is enough to test sign-in and the dashboard end to end.

### 6. (Optional) Trigger real reviews from a live PR

To have an actual GitHub PR fire a review, three more processes need to run alongside `npm run dev`:

```bash
# Terminal 2 — runs the background job locally and gives you a dashboard at http://127.0.0.1:8288
npx inngest-cli@latest dev

# Terminal 3 — exposes localhost:3000 publicly so GitHub's webhook can reach it
ngrok http 3000
```

Then, on the repo you connected:
1. Settings → Webhooks → Add webhook
2. Payload URL: `https://<your-ngrok-id>.ngrok-free.dev/api/webhooks/github`
3. Content type: `application/json`
4. Secret: same value as `GITHUB_WEBHOOK_SECRET`
5. Events: at minimum "Pull requests"

Opening or pushing to a PR on that repo will now flow through the webhook → Inngest → Claude → back to GitHub as inline comments, and show up under "Recent pull requests" in the dashboard.

## Project Structure

```
app/
  page.tsx                       Landing page
  connect-github-button.tsx      Client button that kicks off the GitHub OAuth flow
  dashboard/                     Authenticated dashboard (repos + PR list)
  dashboard/pr/[id]/             PR detail page with scores + comments
  api/auth/[...nextauth]/        NextAuth route
  api/webhooks/github/           GitHub webhook receiver
  api/inngest/                   Inngest function handler
  api/repos/                     List/connect GitHub repos
  api/installations/[id]/        Enable/disable a connected repo
lib/
  supabase.ts                    Server-only Supabase client (secret key, bypasses RLS)
  inngest.ts                     Inngest client
  functions/review-pr.ts         The AI review background job
  score.ts                       Score-to-color helper
auth.ts                          NextAuth configuration
middleware.ts                    Protects /dashboard routes
types/index.ts                   Shared TypeScript types
supabase/migrations/             SQL schema
```

## Scoring

Each reviewed file gets a 0-100 score from Claude. The PR's overall score is the average file score minus 10 points per critical comment (floored at 0). Security/performance/readability/correctness scores are derived the same way, scoped to comments in that category.
