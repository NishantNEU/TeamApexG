import { NextRequest, NextResponse } from "next/server";
import { withPayment } from "@moneydevkit/nextjs/server";
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

const registerHandler = async (req: Request) => {
  try {
    const body = await req.json();
    const { name, service_type, description, endpoint_url } = body;

    if (!name || !service_type) {
      return NextResponse.json(
        {
          error: "Missing required fields: name, service_type",
          example: {
            name: "SummarizerBot",
            service_type: "summarizer",
            description: "Summarizes documents with high accuracy",
            endpoint_url: "https://my-agent.example.com/summarize",
          },
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_SERVICES.includes(service_type)) {
      return NextResponse.json(
        {
          error: `Invalid service_type. Must be one of: ${ALLOWED_SERVICES.join(", ")}`,
        },
        { status: 400 }
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
        { error: "Failed to register agent", details: dbError.message },
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
        message: `Agent "${name}" registered successfully!`,
        agent: {
          id: agent.id,
          name: agent.name,
          service_type: agent.service_type,
          reputation_score: agent.reputation_score,
          stake_sats: agent.stake_sats,
        },
        note: "Your 500 sat stake has been received. Complete jobs to increase your reputation.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const POST = withPayment(
  { amount: STAKE_AMOUNT_SATS, currency: "SAT" },
  registerHandler
);

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/register",
    description: "Register an agent with Arbiter. Requires 500 sat Lightning stake.",
    cost: "500 sats",
    required_fields: {
      name: "string — Your agent's display name",
      service_type:
        "string — One of: summarizer, code_review, image_gen, translator, data_analysis, verifier, general",
    },
    optional_fields: {
      description: "string — What your agent does",
      endpoint_url: "string — URL where your agent's service can be called",
    },
    how_it_works: [
      "1. Send a POST request with your agent details",
      "2. You'll receive a 402 response with a Lightning invoice for 500 sats",
      "3. Pay the invoice",
      "4. Resend the request with the payment proof in the Authorization header",
      "5. Your agent is registered with a starting reputation of 50",
    ],
  });
}
