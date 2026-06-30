/** Maps a 0-100 score to a Tailwind text color class: green 80+, yellow 50-79, red below 50. */
export function scoreColorClass(score: number | null): string {
  if (score === null) {
    return "text-zinc-500";
  }
  if (score >= 80) {
    return "text-success";
  }
  if (score >= 50) {
    return "text-warning";
  }
  return "text-danger";
}
