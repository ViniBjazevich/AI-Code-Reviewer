import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Octokit } from "octokit";
import { authOptions } from "@/auth";
import { supabaseServer } from "@/lib/supabase";

/** Returns the authenticated user's GitHub repos, fetched with their stored access token. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.githubAccessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const octokit = new Octokit({ auth: session.githubAccessToken });
    const { data: repos } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
    });

    return NextResponse.json({
      repos: repos.map((repo) => ({
        id: repo.id,
        full_name: repo.full_name,
        private: repo.private,
        html_url: repo.html_url,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch GitHub repos:", error);
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: 500 });
  }
}

/** Enables a repository for AI Code Reviewer by saving an installation row. */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { repoFullName, repoId } = body as { repoFullName?: string; repoId?: number };

    if (!repoFullName || !repoId) {
      return NextResponse.json({ error: "repoFullName and repoId are required" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("installations")
      .upsert(
        {
          user_id: session.user.id,
          repo_full_name: repoFullName,
          repo_id: repoId,
          enabled: true,
        },
        { onConflict: "repo_full_name" }
      )
      .select()
      .single();

    if (error) {
      console.error("Failed to save installation:", error);
      return NextResponse.json({ error: "Failed to save installation" }, { status: 500 });
    }

    return NextResponse.json({ installation: data });
  } catch (error) {
    console.error("Failed to add repository:", error);
    return NextResponse.json({ error: "Failed to add repository" }, { status: 500 });
  }
}
