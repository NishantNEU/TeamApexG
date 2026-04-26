import { NextRequest, NextResponse } from "next/server";
import { verifyJobOutput } from "@/lib/verifier";
import { supabase } from "@/lib/supabase";

// ─── CORS headers ───────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Simple in-memory rate limiter ──────────────────────────────────────────
// Resets every 60s. Not perfect across serverless instances but enough for
// basic protection against runaway loops burning through the Anthropic key.
const rateLimit = { count: 0, resetAt: Date.now() + 60_000 };
const RATE_LIMIT = 30; // max requests per minute

function checkRateLimit(): boolean {
  const now = Date.now();
  if (now > rateLimit.resetAt) {
    rateLimit.count = 0;
    rateLimit.resetAt = now + 60_000;
  }
  rateLimit.count++;
  return rateLimit.count <= RATE_LIMIT;
}

// ─── CORS preflight ──────────────────────────────────────────────────────────
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

// ─── POST /api/integration/verify ────────────────────────────────────────────
// Guildage sends task input + output → Arbiter returns quality score
export async function POST(req: NextRequest) {
  // Rate limiting
  if (!checkRateLimit()) {
    console.warn("[Arbiter] Rate limit exceeded");
    return NextResponse.json(
      { error: "Too many requests. Limit: 30/minute." },
      { status: 429, headers: CORS }
    );
  }

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
            agent_id: "string (optional)",
            agent_name: "string (optional)",
            service_type: "summarizer | code_review | translator | data_analysis | general",
            task_input: "object — what was requested",
            task_output: "object — what the agent produced",
          },
        },
        { status: 400, headers: CORS }
      );
    }

    const result = await verifyJobOutput({
      service_type,
      input_data: task_input,
      output_data: task_output,
    });

    const token_reward = result.passed
      ? Math.round((result.score / 100) * 500)
      : 0;
    const token_penalty = result.passed
      ? 0
      : Math.round(((100 - result.score) / 100) * 200);
    const trust_tier =
      result.score >= 90
        ? "ELITE"
        : result.score >= 75
        ? "TRUSTED"
        : result.score >= 50
        ? "STANDARD"
        : result.score >= 25
        ? "PROBATION"
        : "UNTRUSTED";

    console.log(
      `[Arbiter] Verify request: agent=${agent_name ?? "unknown"}, service=${service_type}, score=${result.score}, tier=${trust_tier}`
    );

    // Fire-and-forget: log to Supabase integration_logs (don't block response)
    // SQL to create table if it doesn't exist:
    // CREATE TABLE IF NOT EXISTS integration_logs (
    //   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    //   agent_id TEXT,
    //   agent_name TEXT,
    //   service_type TEXT,
    //   score INTEGER,
    //   passed BOOLEAN,
    //   trust_tier TEXT,
    //   source TEXT DEFAULT 'guildage',
    //   created_at TIMESTAMPTZ DEFAULT NOW()
    // );
    supabase
      .from("integration_logs")
      .insert({
        agent_id: agent_id ?? null,
        agent_name: agent_name ?? null,
        service_type,
        score: result.score,
        passed: result.passed,
        trust_tier,
        source: "guildage",
      })
      .then(() => {}, () => {}); // silently ignore — table may not exist yet

    return NextResponse.json(
      {
        verified: true,
        agent_id: agent_id ?? null,
        agent_name: agent_name ?? null,
        passed: result.passed,
        score: result.score,
        reasoning: result.reasoning,
        issues: result.issues,
        token_reward,
        token_penalty,
        trust_tier,
        timestamp: new Date().toISOString(),
      },
      { headers: CORS }
    );
  } catch (err: any) {
    console.error("[Arbiter] Verify error:", err.message);
    return NextResponse.json(
      { error: "Verification failed", details: err.message },
      { status: 500, headers: CORS }
    );
  }
}
