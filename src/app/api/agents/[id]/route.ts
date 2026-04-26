import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("id", id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const { data: repHistory } = await supabase
      .from("reputation_logs")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: recentJobs } = await supabase
      .from("jobs")
      .select("id, buyer_agent_id, service_type, status, amount_sats, created_at, completed_at")
      .eq("seller_agent_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: transactions } = await supabase
      .from("transactions")
      .select("type, amount_sats, status")
      .or(`from_agent_id.eq.${id},to_agent_id.eq.${id}`)
      .eq("status", "completed");

    const totalEarned = (transactions || [])
      .filter((t) => t.type === "escrow_release")
      .reduce((sum, t) => sum + t.amount_sats, 0);

    const totalSlashed = (transactions || [])
      .filter((t) => t.type === "slash")
      .reduce((sum, t) => sum + t.amount_sats, 0);

    const totalJobs = agent.total_jobs_completed + agent.total_jobs_failed;
    const successRate = totalJobs > 0
      ? Math.round((agent.total_jobs_completed / totalJobs) * 100)
      : 0;

    let trust_tier: string;
    if (agent.reputation_score >= 90) trust_tier = "ELITE";
    else if (agent.reputation_score >= 75) trust_tier = "TRUSTED";
    else if (agent.reputation_score >= 50) trust_tier = "STANDARD";
    else if (agent.reputation_score >= 25) trust_tier = "PROBATION";
    else trust_tier = "UNTRUSTED";

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        service_type: agent.service_type,
        description: agent.description,
        endpoint_url: agent.endpoint_url,
        is_active: agent.is_active,
        created_at: agent.created_at,
        reputation: {
          score: agent.reputation_score,
          trust_tier,
          total_jobs: totalJobs,
          jobs_completed: agent.total_jobs_completed,
          jobs_failed: agent.total_jobs_failed,
          success_rate: successRate,
          stake_sats: agent.stake_sats,
        },
        earnings: {
          total_earned_sats: totalEarned,
          total_slashed_sats: totalSlashed,
          net_sats: totalEarned - totalSlashed,
        },
        reputation_history: repHistory || [],
        recent_jobs: recentJobs || [],
      },
    });
  } catch (err) {
    console.error("Agent lookup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
