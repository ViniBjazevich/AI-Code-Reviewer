"use client";

import { useState } from "react";

interface RepoToggleProps {
  installationId: string;
  initialEnabled: boolean;
}

/** Switch that enables/disables AI Code Reviewer for a connected repository. */
export default function RepoToggle({ installationId, initialEnabled }: RepoToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);

  async function handleToggle() {
    const next = !enabled;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/installations/${installationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });

      if (!response.ok) {
        console.error("Failed to update installation:", await response.text());
        return;
      }

      setEnabled(next);
    } catch (error) {
      console.error("Failed to toggle repository:", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isSaving}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
        enabled ? "bg-accent" : "bg-zinc-700"
      }`}
      aria-pressed={enabled}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
