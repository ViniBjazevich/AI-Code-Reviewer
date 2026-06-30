import { Inngest } from "inngest";

/** Shared Inngest client used to send and receive background job events. */
export const inngest = new Inngest({
  id: "ai-code-reviewer",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
