import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data: agents, error } = await supabase
      .from("agents")
      .select("service_type, reputation_score")
      .eq("is_active", true);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch services" },
        { status: 500 }
      );
    }

    const serviceMap: Record<string, { count: number; avg_reputation: number; scores: number[] }> = {};

    (agents || []).forEach((agent) => {
      if (!serviceMap[agent.service_type]) {
        serviceMap[agent.service_type] = { count: 0, avg_reputation: 0, scores: [] };
      }
      serviceMap[agent.service_type].count++;
      serviceMap[agent.service_type].scores.push(agent.reputation_score);
    });

    const services = Object.entries(serviceMap).map(([type, data]) => ({
      service_type: type,
      agent_count: data.count,
      avg_reputation: Math.round(
        data.scores.reduce((a, b) => a + b, 0) / data.scores.length
      ),
    }));

    services.sort((a, b) => b.agent_count - a.agent_count);

    return NextResponse.json({
      success: true,
      total_active_agents: agents?.length || 0,
      services,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
