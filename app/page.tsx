import Link from "next/link";
import ConnectGitHubButton from "./connect-github-button";

const FEATURES = [
  {
    title: "Inline Comments",
    description:
      "Get specific, line-level feedback on bugs, security issues, and performance problems — right where the code lives.",
  },
  {
    title: "Scorecard",
    description:
      "Every pull request gets scored on security, performance, readability, and correctness, so you can triage at a glance.",
  },
  {
    title: "Learns Your Codebase",
    description:
      "Reviews diffs in context, chunked intelligently, so feedback stays relevant even on large pull requests.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <header className="flex items-center justify-between px-8 py-6 border-b border-border">
        <span className="text-lg font-semibold tracking-tight">
          AI <span className="text-accent">Code Reviewer</span>
        </span>
        <ConnectGitHubButton className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors" />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="max-w-3xl text-4xl sm:text-5xl font-bold tracking-tight">
          AI-Powered Code Reviews, Automatically
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-zinc-400">
          AI Code Reviewer reviews every pull request like a senior engineer — catching bugs,
          security issues, and performance problems before they ship.
        </p>

        <ConnectGitHubButton className="mt-10 rounded-md bg-accent px-8 py-3 text-base font-semibold text-white hover:bg-accent/90 transition-colors" />

        <div className="mt-24 grid w-full max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-border bg-card p-6 text-left"
            >
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-8 py-6 text-center text-sm text-zinc-500">
        <Link href="/dashboard">Dashboard</Link>
      </footer>
    </div>
  );
}
