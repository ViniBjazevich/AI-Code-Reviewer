import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: DefaultSession["user"] & {
      id?: string;
    };
    githubAccessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    supabaseUserId?: string;
    githubAccessToken?: string;
  }
}
