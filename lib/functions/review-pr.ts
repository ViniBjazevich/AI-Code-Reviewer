import { Octokit } from "octokit";
import Anthropic from "@anthropic-ai/sdk";
import { inngest } from "@/lib/inngest";
import { supabaseServer } from "@/lib/supabase";
import type { AIReviewResult, Category, Severity } from "@/types";

const SKIPPED_FILE_PATTERNS = [
  /^package-lock\.json$/,
  /^yarn\.lock$/,
  /^pnpm-lock\.yaml$/,
  /\.min\.js$/,
  /\.map$/,
  /^dist\//,
  /^build\//,
];

const MAX_CHUNK_CHARS = 24000;

const SYSTEM_PROMPT =
  "You are a senior software engineer performing a thorough code review. Analyze the provided diff carefully and return ONLY valid JSON with no markdown, no explanation, just the raw JSON object.";

/** Returns true if a changed filename should be skipped from review. */
function shouldSkipFile(filename: string): boolean {
  return SKIPPED_FILE_PATTERNS.some((pattern) => pattern.test(filename));
}

/**
 * Splits a diff patch into chunks under MAX_CHUNK_CHARS, preferring to break
 * on "@@" hunk boundaries so each chunk stays a coherent set of hunks.
 */
function chunkDiff(patch: string): string[] {
  if (patch.length <= MAX_CHUNK_CHARS) {
    return [patch];
  }

  const hunks = patch.split(/(?=^@@)/m).filter((hunk) => hunk.length > 0);
  const chunks: string[] = [];
  let current = "";

  for (const hunk of hunks) {
    if (hunk.length > MAX_CHUNK_CHARS) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < hunk.length; i += MAX_CHUNK_CHARS) {
        chunks.push(hunk.slice(i, i + MAX_CHUNK_CHARS));
      }
      continue;
    }

    if (current.length + hunk.length > MAX_CHUNK_CHARS) {
      chunks.push(current);
      current = hunk;
    } else {
      current += hunk;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

/** Strips a ```json ... ``` (or bare ```) markdown code fence Claude sometimes wraps its JSON in. */
function stripMarkdownCodeFence(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : text;
}

function buildUserPrompt(filename: string, chunk: string): string {
  return `Review this code diff from the file ${filename}.

<diff>
${chunk}
</diff>

Return a JSON object with exactly this shape:
{
  "comments": [
    {
      "line": <integer line number from the diff>,
      "severity": "critical" | "warning" | "suggestion",
      "category": "security" | "performance" | "readability" | "correctness" | "testing",
      "comment": "<your specific feedback>",
      "suggestion": "<optional improved code snippet>"
    }
  ],
  "fileScore": <integer 0-100>
}

Focus on real issues: bugs, security vulnerabilities, performance problems, unclear logic. Skip nitpicks.`;
}

/** Calls Claude with a single diff chunk and parses the JSON review result. */
async function reviewChunk(
  anthropic: Anthropic,
  filename: string,
  chunk: string
): Promise<AIReviewResult> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(filename, chunk) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in Anthropic response");
    }

    return JSON.parse(stripMarkdownCodeFence(textBlock.text)) as AIReviewResult;
  } catch (error) {
    console.error(`Failed to review chunk for ${filename}:`, error);
    return { comments: [], fileScore: 100 };
  }
}

interface ScoredComment {
  filename: string;
  line: number;
  severity: Severity;
  category: Category;
  comment: string;
  suggestion?: string;
}

/**
 * Inngest function triggered by "github/pr.opened". Fetches the PR diff,
 * reviews it with Claude in chunks, persists results to Supabase, and posts
 * the review back to GitHub.
 */
export const reviewPr = inngest.createFunction(
  { id: "review-pr", retries: 2, triggers: [{ event: "github/pr.opened" }] },
  async ({ event, step }) => {
    const {
      repoFullName,
      githubPrNumber,
      headSha,
      pullRequestId,
      installationId,
    } = event.data;

    const [owner, repo] = repoFullName.split("/");

    const { data: installation, error: installationError } = await supabaseServer
      .from("installations")
      .select("user_id")
      .eq("id", installationId)
      .single();

    if (installationError || !installation) {
      throw new Error(`Failed to load installation ${installationId}: ${installationError?.message}`);
    }

    const { data: user, error: userError } = await supabaseServer
      .from("users")
      .select("github_access_token")
      .eq("id", installation.user_id)
      .single();

    if (userError || !user) {
      throw new Error(`Failed to load user for installation ${installationId}: ${userError?.message}`);
    }

    const octokit = new Octokit({ auth: user.github_access_token });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    await step.run("mark-reviewing", async () => {
      await supabaseServer
        .from("pull_requests")
        .update({ status: "reviewing" })
        .eq("id", pullRequestId);
    });

    const changedFiles = await step.run("fetch-changed-files", async () => {
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: githubPrNumber,
        per_page: 100,
      });

      return files
        .filter((file) => file.patch && !shouldSkipFile(file.filename))
        .map((file) => ({ filename: file.filename, patch: file.patch as string }));
    });

    const allComments: ScoredComment[] = [];
    const fileScores: number[] = [];

    for (const file of changedFiles) {
      const chunks = chunkDiff(file.patch);

      const fileResults = await step.run(`review-${file.filename}`, async () => {
        const results: AIReviewResult[] = [];
        for (const chunk of chunks) {
          results.push(await reviewChunk(anthropic, file.filename, chunk));
        }
        return results;
      });

      for (const result of fileResults) {
        fileScores.push(result.fileScore);
        for (const comment of result.comments) {
          allComments.push({ filename: file.filename, ...comment });
        }
      }
    }

    const criticalCount = allComments.filter((c) => c.severity === "critical").length;
    const baseScore =
      fileScores.length > 0
        ? Math.round(fileScores.reduce((sum, score) => sum + score, 0) / fileScores.length)
        : 100;
    const overallScore = Math.max(0, baseScore - criticalCount * 10);

    const categoryScore = (category: Category): number => {
      const categoryComments = allComments.filter((c) => c.category === category);
      const categoryCritical = categoryComments.filter((c) => c.severity === "critical").length;
      return Math.max(0, overallScore - categoryCritical * 5);
    };

    const securityScore = categoryScore("security");
    const performanceScore = categoryScore("performance");
    const readabilityScore = categoryScore("readability");
    const correctnessScore = categoryScore("correctness");

    await step.run("save-comments", async () => {
      if (allComments.length === 0) {
        return;
      }

      const rows = allComments.map((comment) => ({
        pull_request_id: pullRequestId,
        filename: comment.filename,
        line_number: comment.line,
        severity: comment.severity,
        category: comment.category,
        comment: comment.comment,
        suggestion: comment.suggestion ?? null,
      }));

      const { error } = await supabaseServer.from("review_comments").insert(rows);
      if (error) {
        throw new Error(`Failed to save review comments: ${error.message}`);
      }
    });

    await step.run("update-pull-request", async () => {
      const { error } = await supabaseServer
        .from("pull_requests")
        .update({
          status: "completed",
          overall_score: overallScore,
          security_score: securityScore,
          performance_score: performanceScore,
          readability_score: readabilityScore,
          correctness_score: correctnessScore,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", pullRequestId);

      if (error) {
        throw new Error(`Failed to update pull request: ${error.message}`);
      }
    });

    await step.run("post-to-github", async () => {
      try {
        const comments = allComments
          .filter((c) => c.line > 0)
          .map((c) => ({
            path: c.filename,
            line: c.line,
            body: `**[${c.severity.toUpperCase()} / ${c.category}]** ${c.comment}${
              c.suggestion ? `\n\n\`\`\`suggestion\n${c.suggestion}\n\`\`\`` : ""
            }`,
          }));

        const summary = `## AI Code Review

| Overall | Security | Performance | Readability | Correctness |
|---|---|---|---|---|
| ${overallScore} | ${securityScore} | ${performanceScore} | ${readabilityScore} | ${correctnessScore} |

Found ${allComments.length} comment(s) across ${changedFiles.length} file(s).`;

        await octokit.rest.pulls.createReview({
          owner,
          repo,
          pull_number: githubPrNumber,
          commit_id: headSha,
          body: summary,
          event: "COMMENT",
          comments,
        });
      } catch (error) {
        console.error("Failed to post review to GitHub:", error);
      }
    });

    return { overallScore, commentCount: allComments.length };
  }
);
