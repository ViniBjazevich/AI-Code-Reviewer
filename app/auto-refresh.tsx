"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  enabled: boolean;
  intervalMs?: number;
}

/** Periodically re-fetches the current server-rendered route while `enabled` is true. */
export default function AutoRefresh({ enabled, intervalMs = 4000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
