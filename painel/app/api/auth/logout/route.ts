import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionFromCookie, logActivity } from "@/lib/auth";

export async function POST() {
  try {
    const session = await getSessionFromCookie();

    if (session) {
      await logActivity(session.sub, "LOGOUT", { username: session.username });
    }

    await clearSessionCookie();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[LOGOUT]", error);
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  }
}
