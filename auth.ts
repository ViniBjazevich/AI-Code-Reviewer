import type { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { supabaseServer } from "@/lib/supabase";
import { encryptSecret } from "@/lib/crypto";

/**
 * Shared NextAuth configuration. GitHub is the only provider — on sign in we
 * upsert the user into Supabase and stash their Supabase UUID + GitHub
 * access token on the JWT so it's available in the session.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          // NextAuth's default scope is read-only ("read:user user:email"); the
          // "repo" scope is required so the stored access token can list a
          // user's repos and post review comments/reviews back to GitHub.
          scope: "read:user user:email repo",
        },
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (!account || account.provider !== "github" || !profile) {
          return false;
        }

        const githubProfile = profile as { id?: number; login?: string; avatar_url?: string };

        const { error } = await supabaseServer.from("users").upsert(
          {
            github_id: githubProfile.id,
            github_username: githubProfile.login,
            github_access_token: account.access_token
              ? encryptSecret(account.access_token)
              : null,
            avatar_url: user.image ?? githubProfile.avatar_url,
          },
          { onConflict: "github_id" }
        );

        if (error) {
          console.error("Failed to upsert user during sign in:", error);
          return false;
        }

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },
    async jwt({ token, account, profile }) {
      try {
        if (account && profile) {
          const githubProfile = profile as { id?: number };

          const { data, error } = await supabaseServer
            .from("users")
            .select("id")
            .eq("github_id", githubProfile.id)
            .single();

          if (error || !data) {
            // Fail token issuance rather than returning a session with a
            // GitHub token but no linked Supabase user.
            throw new Error(`Failed to resolve user identity: ${error?.message}`);
          }

          token.supabaseUserId = data.id;
          token.githubAccessToken = account.access_token;
        }

        return token;
      } catch (error) {
        if (account && profile) {
          // Sign-in lookup failed — rethrow so NextAuth fails the sign-in
          // instead of issuing a token with no linked Supabase user.
          throw error;
        }
        console.error("Error in jwt callback:", error);
        return token;
      }
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.supabaseUserId as string | undefined;
      }
      session.githubAccessToken = token.githubAccessToken as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
};
