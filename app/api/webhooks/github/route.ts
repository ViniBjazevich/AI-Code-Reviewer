import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase";
import { inngest } from "@/lib/inngest";

const HANDLED_ACTIONS = new Set(["opened", "synchronize", "reopened"]);

/**
 * Verifies that the `x-hub-signature-256` header matches an HMAC-SHA256
 * digest of the raw request body, computed with the webhook secret.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) {
    return false;
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET ?? "";
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Receives GitHub `pull_request` webhook events, records a pending PR row,
 * and kicks off the async review job via Inngest.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");

    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = request.headers.get("x-github-event");
    const payload = JSON.parse(rawBody);

    if (event !== "pull_request" || !HANDLED_ACTIONS.has(payload.action)) {
      return NextResponse.json({ received: true });
    }

    const repoFullName: string = payload.repository.full_name;
    const githubPrNumber: number = payload.number;
    const headSha: string = payload.pull_request.head.sha;
    const prUrl: string = payload.pull_request.html_url;
    const title: string = payload.pull_request.title;
    const author: string = payload.pull_request.user.login;

    const { data: installation, error: installationError } = await supabaseServer
      .from("installations")
      .select("id, enabled")
      .eq("repo_full_name", repoFullName)
      .maybeSingle();

    if (installationError) {
      console.error("Failed to look up installation:", installationError);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }

    if (!installation || !installation.enabled) {
      return NextResponse.json({ received: true, skipped: "installation not enabled" });
    }

    const { data: pullRequest, error: insertError } = await supabaseServer
      .from("pull_requests")
      .insert({
        installation_id: installation.id,
        github_pr_number: githubPrNumber,
        title,
        author,
        head_sha: headSha,
        status: "pending",
        pr_url: prUrl,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert pull request:", insertError);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    await inngest.send({
      name: "github/pr.opened",
      data: {
        installationId: installation.id,
        repoFullName,
        githubPrNumber,
        headSha,
        prUrl,
        title,
        author,
        pullRequestId: pullRequest.id,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error handling GitHub webhook:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
