import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { supabaseServer } from "@/lib/supabase";

/** Toggles whether AI Code Reviewer is enabled for a connected repository. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled } = body as { enabled?: boolean };

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
    }

    const { data, error } = await supabaseServer
      .from("installations")
      .update({ enabled })
      .eq("id", params.id)
      .eq("user_id", session.user.id)
      .select();

    if (error) {
      console.error("Failed to update installation:", error);
      return NextResponse.json({ error: "Failed to update installation" }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Installation not found" }, { status: 404 });
    }

    return NextResponse.json({ enabled });
  } catch (error) {
    console.error("Failed to toggle installation:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
