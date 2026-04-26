import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { count: totalAgents } = await supabase
      .from("agents")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    const { count: totalJobs } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true });

    const { count: completedJobs } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    const { count: failedJobs } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed");

    const { data: transactions } = await supabase
      .from("transactions")
      .select("type, amount_sats, status")
      .eq("status", "completed");

    const totalSatsTransacted = (transactions || []).reduce(
      (sum, t) => sum + t.amount_sats,
      0
    );

    const totalStaked = (transactions || [])
      .filter((t) => t.type === "stake")
      .reduce((sum, t) => sum + t.amount_sats, 0);

    const totalQueryFees = (transactions || [])
      .filter((t) => t.type === "query_fee")
      .reduce((sum, t) => sum + t.amount_sats, 0);

    const totalEscrowReleased = (transactions || [])
      .filter((t) => t.type === "escrow_release")
      .reduce((sum, t) => sum + t.amount_sats, 0);

    const { data: repData } = await supabase
      .from("agents")
      .select("reputation_score")
      .eq("is_active", true);

    const avgReputation = repData && repData.length > 0
      ? Math.round(
          repData.reduce((sum, a) => sum + a.reputation_score, 0) / repData.length
        )
      : 0;

    return NextResponse.json({
      success: true,
      network: "arbiter",
      tagline: "Trust at machine speed",
      stats: {
        total_agents: totalAgents || 0,
        total_jobs: totalJobs || 0,
        completed_jobs: completedJobs || 0,
        failed_jobs: failedJobs || 0,
        success_rate:
          totalJobs && totalJobs > 0
            ? Math.round(((completedJobs || 0) / totalJobs) * 100)
            : 0,
        avg_reputation: avgReputation,
        lightning: {
          total_sats_transacted: totalSatsTransacted,
          total_staked_sats: totalStaked,
          total_query_fees_sats: totalQueryFees,
          total_escrow_released_sats: totalEscrowReleased,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Stats error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
