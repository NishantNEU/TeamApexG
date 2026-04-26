import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getTrustTier, getPricingMultiplier } from "@/lib/reputation";

export async function GET() {
  try {
    const { data: agents, error } = await supabase
      .from("agents")
      .select("id, name, service_type, reputation_score, total_jobs_completed, total_jobs_failed, stake_sats, created_at")
      .eq("is_active", true)
      .order("reputation_score", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch leaderboard" },
        { status: 500 }
      );
    }

    const { data: allEarnings } = await supabase
      .from("transactions")
      .select("to_agent_id, amount_sats")
      .eq("type", "escrow_release")
      .eq("status", "completed");

    const earningsMap: Record<string, number> = {};
    (allEarnings || []).forEach((t) => {
      if (t.to_agent_id) {
        earningsMap[t.to_agent_id] = (earningsMap[t.to_agent_id] || 0) + t.amount_sats;
      }
    });

    const leaderboard = (agents || []).map((agent, index) => {
      const totalJobs = agent.total_jobs_completed + agent.total_jobs_failed;
      const tier = getTrustTier(agent.reputation_score);

      return {
        rank: index + 1,
        id: agent.id,
        name: agent.name,
        service_type: agent.service_type,
        reputation_score: agent.reputation_score,
        trust_tier: tier.name,
        tier_color: tier.color,
        pricing_multiplier: getPricingMultiplier(agent.reputation_score),
        total_jobs: totalJobs,
        jobs_completed: agent.total_jobs_completed,
        jobs_failed: agent.total_jobs_failed,
        success_rate: totalJobs > 0
          ? Math.round((agent.total_jobs_completed / totalJobs) * 100)
          : 0,
        total_earned_sats: earningsMap[agent.id] || 0,
        stake_sats: agent.stake_sats,
      };
    });

    const totalAgents = leaderboard.length;
    const tierCounts: Record<string, number> = {};
    leaderboard.forEach((a) => {
      tierCounts[a.trust_tier] = (tierCounts[a.trust_tier] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      leaderboard,
      summary: {
        total_agents: totalAgents,
        tier_distribution: tierCounts,
        total_sats_earned: Object.values(earningsMap).reduce((a, b) => a + b, 0),
      },
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
