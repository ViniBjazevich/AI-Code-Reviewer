import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { supabaseServer } from "@/lib/supabase";
import { scoreColorClass } from "@/lib/score";
import type { Installation, PullRequest } from "@/types";
import SignOutButton from "./sign-out-button";
import RepoToggle from "./repo-toggle";
import AddRepoButton from "./add-repo-button";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  reviewing: "Reviewing",
  completed: "Completed",
  failed: "Failed",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const { data: installations } = await supabaseServer
    .from("installations")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  const installationIds = (installations ?? []).map((installation) => installation.id);

  const { data: pullRequests } = installationIds.length
    ? await supabaseServer
        .from("pull_requests")
        .select("*")
        .in("installation_id", installationIds)
        .order("created_at", { ascending: false })
        .limit(25)
    : { data: [] as PullRequest[] };

  const installationsById = new Map(
    (installations ?? []).map((installation: Installation) => [installation.id, installation])
  );

  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="flex items-center justify-between border-b border-border px-8 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          AI <span className="text-accent">Code Reviewer</span>
        </Link>

        <div className="flex items-center gap-3">
          {session.user.image && (
            <Image
              src={session.user.image}
              alt={session.user.name ?? "User avatar"}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <span className="text-sm text-zinc-300">{session.user.name}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1 px-8 py-8">
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Connected repositories</h2>
            <AddRepoButton />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-card">
            {(installations ?? []).length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-zinc-500">
                No repositories connected yet. Click &ldquo;Add Repository&rdquo; to get started.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {(installations ?? []).map((installation: Installation) => (
                  <li
                    key={installation.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span className="text-sm">{installation.repo_full_name}</span>
                    <RepoToggle
                      installationId={installation.id}
                      initialEnabled={installation.enabled}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Recent pull requests</h2>

          <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-zinc-500">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Repo</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {(pullRequests ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                      No pull requests reviewed yet.
                    </td>
                  </tr>
                ) : (
                  (pullRequests ?? []).map((pr: PullRequest) => {
                    const installation = installationsById.get(pr.installation_id);
                    return (
                      <tr key={pr.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/pr/${pr.id}`}
                            className="hover:text-accent transition-colors"
                          >
                            {pr.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {installation?.repo_full_name ?? "—"}
                        </td>
                        <td className={`px-4 py-3 font-medium ${scoreColorClass(pr.overall_score)}`}>
                          {pr.overall_score ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {STATUS_LABELS[pr.status] ?? pr.status}
                        </td>
                        <td className="px-4 py-3 text-zinc-400">
                          {new Date(pr.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
