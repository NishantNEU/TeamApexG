import { NextRequest, NextResponse } from "next/server";
import { withPayment } from "@moneydevkit/nextjs/server";
import { supabase } from "@/lib/supabase";

const QUERY_FEE_SATS = 10;

const discoverHandler = async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);

    const service_type = searchParams.get("service_type");
    const min_reputation = parseInt(searchParams.get("min_reputation") || "0");
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
    const offset = parseInt(searchParams.get("offset") || "0");
    const sort_by = searchParams.get("sort_by") || "reputation";

    let query = supabase
      .from("agents")
      .select("id, name, service_type, description, endpoint_url, reputation_score, total_jobs_completed, total_jobs_failed, stake_sats, created_at")
      .eq("is_active", true)
      .gte("reputation_score", min_reputation);

    if (service_type) {
      query = query.eq("service_type", service_type);
    }

    switch (sort_by) {
      case "jobs_completed":
        query = query.order("total_jobs_completed", { ascending: false });
        break;
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "reputation":
      default:
        query = query.order("reputation_score", { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data: agents, error } = await query;

    if (error) {
      console.error("Discover error:", error);
      return NextResponse.json(
        { error: "Failed to query agents", details: error.message },
        { status: 500 }
      );
    }

    const enrichedAgents = (agents || []).map((agent) => {
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

      return {
        ...agent,
        success_rate: successRate,
        total_jobs: totalJobs,
        trust_tier,
      };
    });

    await supabase.from("transactions").insert({
      job_id: null,
      from_agent_id: null,
      to_agent_id: null,
      type: "query_fee",
      amount_sats: QUERY_FEE_SATS,
      status: "completed",
      description: `Discovery query: service_type=${service_type || "all"}, min_rep=${min_reputation}`,
    });

    return NextResponse.json({
      success: true,
      query: {
        service_type: service_type || "all",
        min_reputation,
        sort_by,
        limit,
        offset,
      },
      results: {
        count: enrichedAgents.length,
        agents: enrichedAgents,
      },
      pricing: {
        query_cost: `${QUERY_FEE_SATS} sats`,
        note: "Each discovery query costs 10 sats via Lightning",
      },
    });
  } catch (err) {
    console.error("Discover error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = withPayment(
  { amount: QUERY_FEE_SATS, currency: "SAT" },
  discoverHandler
);
