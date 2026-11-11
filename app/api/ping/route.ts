import { NextResponse } from "next/server";
import { isCloudConfigured, supabase } from "@/lib/supabase";

// Never cached: the point is to reach the database, so a static response would
// defeat it.
export const dynamic = "force-dynamic";

/**
 * Keeps the free Supabase project from being paused for inactivity.
 *
 * Supabase pauses a free project after a week without a request, which would
 * leave the desk unreachable until somebody opened the dashboard and restored
 * it. Vercel Cron calls this once a day. The query is deliberately meaningless
 * — it reads a recovery blob for an address that cannot exist, so it returns no
 * rows and reveals nothing, but it does hit Postgres.
 *
 * Delete this route and the `crons` entry in vercel.json if the project is ever
 * moved to a paid plan, where pausing does not happen.
 */
export async function GET() {
  if (!isCloudConfigured) {
    return NextResponse.json({ ok: false, reason: "no-server" });
  }

  const { error } = await supabase.rpc("vault_recovery_blob", {
    p_email: "keepalive@invalid.local",
  });

  return NextResponse.json({
    ok: !error,
    ...(error ? { reason: error.message } : {}),
    at: new Date().toISOString(),
  });
}
