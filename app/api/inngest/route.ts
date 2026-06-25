import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { reviewPr } from "@/lib/functions/review-pr";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [reviewPr],
});
