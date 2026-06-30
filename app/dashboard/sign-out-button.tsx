"use client";

import { signOut } from "next-auth/react";

/** Button that signs the current user out and returns them to the landing page. */
export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-zinc-300 hover:bg-card transition-colors"
    >
      Sign out
    </button>
  );
}
