import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { applyReputationDecay, getAgentStats, TRUST_TIERS } from "@/lib/reputation";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent_id");

  if (!agentId) {
    return NextResponse.json({
      success: true,
      trust_tiers: TRUST_TIERS,
      info: "Pass ?agent_id=UUID to get a specific agent's reputation details.",
    });
  }

  try {
    const stats = await getAgentStats(agentId);

    if (!stats) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const { data: history } = await supabase
      .from("reputation_logs")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(30);

    return NextResponse.json({
      success: true,
      agent: stats,
      reputation_history: history || [],
    });
  } catch (err) {
    console.error("Reputation error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "decay";

    if (action === "decay") {
      const result = await applyReputationDecay();

      return NextResponse.json({
        success: true,
        action: "reputation_decay",
        ...result,
        note: "In production, this runs automatically every 24 hours.",
      });
    }

    return NextResponse.json(
      { error: "Unknown action. Supported: 'decay'" },
      { status: 400 }
    );
  } catch (err) {
    console.error("Reputation action error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
