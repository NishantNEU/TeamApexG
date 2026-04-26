import { NextRequest, NextResponse } from "next/server";
import { verifyJobOutput } from "@/lib/verifier";

// Handle CORS preflight (so Guildage can call this)
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// POST /api/integration/verify
// Guildage sends task input + output, Arbiter returns quality score
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      agent_id,
      agent_name,
      service_type,
      task_input,
      task_output,
    } = body;

    if (!service_type || !task_input || !task_output) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: {
            agent_id: "string",
            agent_name: "string",
            service_type: "summarizer | code_review | translator | data_analysis | general",
            task_input: "object — what was requested",
            task_output: "object — what the agent produced",
          },
        },
        { status: 400, headers: { "Access-Control-Allow-Origin": "*" } }
      );
    }

    const result = await verifyJobOutput({
      service_type,
      input_data: task_input,
      output_data: task_output,
    });

    return NextResponse.json(
      {
        verified: true,
        agent_id: agent_id || null,
        agent_name: agent_name || null,
        passed: result.passed,
        score: result.score,
        reasoning: result.reasoning,
        issues: result.issues,
        token_reward: result.passed
          ? Math.round((result.score / 100) * 500)
          : 0,
        token_penalty: result.passed
          ? 0
          : Math.round(((100 - result.score) / 100) * 200),
        trust_tier:
          result.score >= 90
            ? "ELITE"
            : result.score >= 75
            ? "TRUSTED"
            : result.score >= 50
            ? "STANDARD"
            : result.score >= 25
            ? "PROBATION"
            : "UNTRUSTED",
        timestamp: new Date().toISOString(),
      },
      { headers: { "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err: any) {
    console.error("Integration verify error:", err);
    return NextResponse.json(
      { error: "Verification failed", details: err.message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}