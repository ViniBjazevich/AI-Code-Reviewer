"use client";

import { signIn } from "next-auth/react";

interface ConnectGitHubButtonProps {
  className: string;
}

/** Button that kicks off the GitHub OAuth sign-in flow directly. */
export default function ConnectGitHubButton({ className }: ConnectGitHubButtonProps) {
  return (
    <button onClick={() => signIn("github", { callbackUrl: "/dashboard" })} className={className}>
      Connect GitHub
    </button>
  );
}
