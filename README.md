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

Copy `.env.local` (already present with empty placeholders) and fill in:

| Variable | Description |
| --- | --- |
| `GITHUB_APP_ID` | GitHub App ID (if using a GitHub App for installation-based access) |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App private key |
| `GITHUB_WEBHOOK_SECRET` | Shared secret used to verify `x-hub-signature-256` on incoming webhooks |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth App credentials, used by NextAuth for sign-in |
| `ANTHROPIC_API_KEY` | API key for Claude |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` | Supabase project credentials |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Inngest credentials |
| `NEXTAUTH_SECRET` | Random secret for NextAuth session encryption |
| `NEXTAUTH_URL` | Base URL of the app, e.g. `http://localhost:3000` |

None of these are committed — `.env*` is gitignored.

### 3. Set up the database

Run the migration in [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) against your Supabase project (via the SQL editor or the Supabase CLI). It creates `users`, `installations`, `pull_requests`, and `review_comments`, with row-level security enabled — all reads/writes go through the server using the service role key.

### 4. Run the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 5. Wire up the GitHub webhook

Point your GitHub App/OAuth App's webhook at `/api/webhooks/github` (use a tool like `ngrok` or the Inngest dev server for local testing), and set the Inngest app's serve endpoint to `/api/inngest`.

## Project Structure

```
app/
  page.tsx                       Landing page
  dashboard/                     Authenticated dashboard (repos + PR list)
  dashboard/pr/[id]/             PR detail page with scores + comments
  api/auth/[...nextauth]/        NextAuth route
  api/webhooks/github/           GitHub webhook receiver
  api/inngest/                   Inngest function handler
  api/repos/                     List/connect GitHub repos
  api/installations/[id]/        Enable/disable a connected repo
lib/
  supabase.ts                    Browser + server Supabase clients
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
