import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const status = searchParams.get("status");
    const agent_id = searchParams.get("agent_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    let query = supabase
      .from("jobs")
      .select("id, buyer_agent_id, seller_agent_id, verifier_agent_id, service_type, status, amount_sats, escrow_status, created_at, completed_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    if (agent_id) {
      query = query.or(
        `buyer_agent_id.eq.${agent_id},seller_agent_id.eq.${agent_id}`
      );
    }

    const { data: jobs, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch jobs" },
        { status: 500 }
      );
    }

    const allAgentIds = new Set<string>();
    (jobs || []).forEach((j) => {
      if (j.buyer_agent_id) allAgentIds.add(j.buyer_agent_id);
      if (j.seller_agent_id) allAgentIds.add(j.seller_agent_id);
      if (j.verifier_agent_id) allAgentIds.add(j.verifier_agent_id);
    });

    const { data: agents } = await supabase
      .from("agents")
      .select("id, name")
      .in("id", Array.from(allAgentIds));

    const nameMap: Record<string, string> = {};
    (agents || []).forEach((a) => {
      nameMap[a.id] = a.name;
    });

    const enrichedJobs = (jobs || []).map((j) => ({
      ...j,
      buyer_name: nameMap[j.buyer_agent_id] || "Unknown",
      seller_name: nameMap[j.seller_agent_id] || "Unknown",
      verifier_name: j.verifier_agent_id
        ? nameMap[j.verifier_agent_id] || "Unknown"
        : null,
    }));

    return NextResponse.json({
      success: true,
      count: enrichedJobs.length,
      jobs: enrichedJobs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
