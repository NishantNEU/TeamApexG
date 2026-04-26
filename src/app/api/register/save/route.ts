import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

const STAKE_AMOUNT_SATS = 500;

const ALLOWED_SERVICES = [
  "summarizer",
  "code_review",
  "image_gen",
  "translator",
  "data_analysis",
  "verifier",
  "general",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, service_type, description, endpoint_url } = body;

    if (!name || !service_type) {
      return NextResponse.json(
        { error: "Missing required fields: name, service_type" },
        { status: 400 }
      );
    }

    if (!ALLOWED_SERVICES.includes(service_type)) {
      return NextResponse.json(
        { error: `Invalid service_type` },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from("agents")
      .select("id")
      .eq("name", name)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "An agent with this name already exists" },
        { status: 409 }
      );
    }

    const agentId = uuidv4();

    const { data: agent, error: dbError } = await supabase
      .from("agents")
      .insert({
        id: agentId,
        name,
        service_type,
        description: description || null,
        endpoint_url: endpoint_url || null,
        reputation_score: 50,
        total_jobs_completed: 0,
        total_jobs_failed: 0,
        stake_sats: STAKE_AMOUNT_SATS,
        is_active: true,
      })
      .select()
      .single();

    if (dbError) {
      console.error("DB Error:", dbError);
      return NextResponse.json(
        { error: "Failed to register agent" },
        { status: 500 }
      );
    }

    await supabase.from("transactions").insert({
      job_id: null,
      from_agent_id: agentId,
      to_agent_id: null,
      type: "stake",
      amount_sats: STAKE_AMOUNT_SATS,
      status: "completed",
      description: `Registration stake for agent: ${name}`,
    });

    await supabase.from("reputation_logs").insert({
      agent_id: agentId,
      job_id: null,
      old_score: 0,
      new_score: 50,
      change_amount: 50,
      reason: "initial_registration",
    });

    return NextResponse.json(
      {
        success: true,
        agent: {
          id: agent.id,
          name: agent.name,
          service_type: agent.service_type,
          reputation_score: agent.reputation_score,
          stake_sats: agent.stake_sats,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Save error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
