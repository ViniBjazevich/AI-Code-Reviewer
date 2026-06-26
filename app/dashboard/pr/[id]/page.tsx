import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { supabaseServer } from "@/lib/supabase";
import { scoreColorClass } from "@/lib/score";
import type { PullRequest, ReviewComment, Severity } from "@/types";
import AutoRefresh from "../../../auto-refresh";

const SEVERITY_ORDER: Severity[] = ["critical", "warning", "suggestion"];

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  suggestion: "Suggestion",
};

interface ScoreBoxProps {
  label: string;
  score: number | null;
}

function ScoreBox({ label, score }: ScoreBoxProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${scoreColorClass(score)}`}>{score ?? "—"}</p>
    </div>
  );
}

export default async function PullRequestDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const { data: pullRequest } = await supabaseServer
    .from("pull_requests")
    .select("*")
    .eq("id", params.id)
    .maybeSingle<PullRequest>();

  if (!pullRequest) {
    notFound();
  }

  const { data: comments } = await supabaseServer
    .from("review_comments")
    .select("*")
    .eq("pull_request_id", params.id)
    .order("created_at", { ascending: true });

  const commentsBySeverity = SEVERITY_ORDER.map((severity) => ({
    severity,
    items: ((comments ?? []) as ReviewComment[]).filter((c) => c.severity === severity),
  }));

  const isInProgress = pullRequest.status === "pending" || pullRequest.status === "reviewing";

  return (
    <div className="flex flex-col flex-1 bg-background">
      <AutoRefresh enabled={isInProgress} />
      <header className="border-b border-border px-8 py-4">
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-300">
          ← Back to dashboard
        </Link>
      </header>

      <main className="flex-1 px-8 py-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{pullRequest.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              #{pullRequest.github_pr_number} opened by {pullRequest.author}
            </p>
          </div>
          <a
            href={pullRequest.pr_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-card transition-colors"
          >
            View on GitHub
          </a>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <ScoreBox label="Overall" score={pullRequest.overall_score} />
          <ScoreBox label="Security" score={pullRequest.security_score} />
          <ScoreBox label="Performance" score={pullRequest.performance_score} />
          <ScoreBox label="Readability" score={pullRequest.readability_score} />
          <ScoreBox label="Correctness" score={pullRequest.correctness_score} />
        </div>

        <div className="mt-10 space-y-8">
          {commentsBySeverity.map(({ severity, items }) =>
            items.length === 0 ? null : (
              <div key={severity}>
                <h2 className="text-lg font-semibold">
                  {SEVERITY_LABELS[severity]} ({items.length})
                </h2>
                <div className="mt-3 space-y-3">
                  {items.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-border bg-card p-4"
                    >
                      <p className="text-xs text-zinc-500">
                        {comment.filename}
                        {comment.line_number ? `:${comment.line_number}` : ""} ·{" "}
                        <span className="uppercase">{comment.category}</span>
                      </p>
                      <p className="mt-2 text-sm">{comment.comment}</p>
                      {comment.suggestion && (
                        <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs">
                          <code>{comment.suggestion}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {(comments ?? []).length === 0 && (
            <p className="text-sm text-zinc-500">No comments for this pull request.</p>
          )}
        </div>
      </main>
    </div>
  );
}
