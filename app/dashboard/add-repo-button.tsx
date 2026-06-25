"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GitHubRepo } from "@/types";

/** Button that opens a panel to pick one of the user's GitHub repos and connect it. */
export default function AddRepoButton() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState<number | null>(null);

  async function openPanel() {
    setIsOpen(true);
    setIsLoading(true);

    try {
      const response = await fetch("/api/repos");
      const data = await response.json();
      setRepos(data.repos ?? []);
    } catch (error) {
      console.error("Failed to fetch repos:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function connectRepo(repo: GitHubRepo) {
    setIsConnecting(repo.id);

    try {
      const response = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: repo.full_name, repoId: repo.id }),
      });

      if (!response.ok) {
        console.error("Failed to connect repo:", await response.text());
        return;
      }

      setIsOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to connect repo:", error);
    } finally {
      setIsConnecting(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={openPanel}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors"
      >
        Add Repository
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-medium">Your repositories</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              ✕
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {isLoading && <p className="px-4 py-3 text-sm text-zinc-500">Loading repos…</p>}

            {!isLoading && repos.length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-500">No repositories found.</p>
            )}

            {repos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => connectRepo(repo)}
                disabled={isConnecting === repo.id}
                className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-background disabled:opacity-50"
              >
                <span className="truncate">{repo.full_name}</span>
                <span className="ml-2 text-xs text-zinc-500">
                  {isConnecting === repo.id ? "Connecting…" : "Connect"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
