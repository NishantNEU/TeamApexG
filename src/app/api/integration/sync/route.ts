import { NextRequest, NextResponse } from "next/server";
import { v5 as uuidv5 } from "uuid";
import { supabase } from "@/lib/supabase";

// Fixed namespace for deterministic UUID generation from Guildage agent IDs
const GUILDAGE_NS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

// Convert any Guildage agent_id string → deterministic UUID
function toUUID(guildageId: string): string {
  return uuidv5(guildageId, GUILDAGE_NS);
}

// ─── CORS ────────────────────────────────────────────────────────────────────
const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };

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

// ─── Skill → service_type mapping ────────────────────────────────────────────
function mapSkillToServiceType(skill: string | undefined): string {
  const map: Record<string, string> = {
    Coder: "code_review",
    Analyst: "data_analysis",
    Accountant: "data_analysis",
    Translator: "translator",
    Writer: "general",
    Chef: "general",
    Florist: "general",
    Designer: "general",
    Researcher: "general",
    Lawyer: "general",
  };
  return map[skill || ""] || "general";
}

// ─── POST /api/integration/sync ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, data } = body;

    if (!event || !data) {
      return NextResponse.json(
        { error: "Missing event or data" },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    console.log(`[Arbiter Sync] ${event}:`, JSON.stringify(data).slice(0, 300));

    switch (event) {
      case "agent_registered": {
        await handleAgentRegistered(data);
        break;
      }
      case "task_completed": {
        await handleTaskCompleted(data);
        break;
      }
      case "swap_completed":
      case "borrow_completed": {
        console.log(`[Arbiter Sync] ${event} logged`);
        break;
      }
      default: {
        return NextResponse.json(
          { error: `Unknown event: ${event}` },
          { status: 400, headers: CORS_HEADERS }
        );
      }
    }

    return NextResponse.json(
      { success: true, event, message: `${event} processed` },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error("[Arbiter Sync] Error:", err);
    return NextResponse.json(
      { error: "Sync failed", details: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// ─── Handler: agent_registered ───────────────────────────────────────────────
async function handleAgentRegistered(data: {
  agent_id: string;
  name: string;
  owner_name?: string;
  skills?: string[];
  token_balance?: number;
  deposit_sats?: number;
}) {
  const agentUUID = toUUID(data.agent_id);

  const { error } = await supabase.from("agents").upsert(
    {
      id: agentUUID,
      name: data.name,
      service_type: mapSkillToServiceType(data.skills?.[0]),
      description: `Guildage agent owned by ${data.owner_name ?? "unknown"}. Skills: ${data.skills?.join(", ") ?? "none"}`,
      endpoint_url: data.agent_id, // store original Guildage ID for reference
      reputation_score: 50,
      total_jobs_completed: 0,
      total_jobs_failed: 0,
      stake_sats: data.deposit_sats || 100,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[Arbiter Sync] agents upsert error:", error.message);
    throw new Error(`Failed to register agent: ${error.message}`);
  }

  console.log(`[Arbiter Sync] Agent "${data.name}" upserted into marketplace`);
}

// ─── Handler: task_completed ──────────────────────────────────────────────────
async function handleTaskCompleted(data: {
  agent_id: string;
  task_id?: string;
  description?: string;
  tokens_earned?: number;
  verification?: {
    passed: boolean;
    score: number;
    trust_tier?: string;
    reasoning?: string;
  };
}) {
  if (!data.agent_id) {
    console.warn("[Arbiter Sync] task_completed missing agent_id");
    return;
  }

  const agentUUID = toUUID(data.agent_id);

  // Fetch current agent stats
  const { data: agent, error: fetchErr } = await supabase
    .from("agents")
    .select("reputation_score, total_jobs_completed, total_jobs_failed")
    .eq("id", agentUUID)
    .single();

  if (fetchErr || !agent) {
    console.warn(`[Arbiter Sync] Agent ${data.agent_id} not found — skipping`);
    return;
  }

  const v = data.verification;
  const currentScore: number = agent.reputation_score;
  let newScore: number;
  let scoreDelta: number;
  let updatePayload: Record<string, number | string>;

  if (v?.passed) {
    scoreDelta = Math.round(v.score / 20);
    newScore = Math.min(100, currentScore + scoreDelta);
    updatePayload = {
      total_jobs_completed: agent.total_jobs_completed + 1,
      reputation_score: newScore,
      updated_at: new Date().toISOString(),
    };
  } else {
    scoreDelta = -5;
    newScore = Math.max(0, currentScore + scoreDelta);
    updatePayload = {
      total_jobs_failed: agent.total_jobs_failed + 1,
      reputation_score: newScore,
      updated_at: new Date().toISOString(),
    };
  }

  const { error: updateErr } = await supabase
    .from("agents")
    .update(updatePayload)
    .eq("id", agentUUID);

  if (updateErr) {
    console.error("[Arbiter Sync] agents update error:", updateErr.message);
    throw new Error(`Failed to update agent stats: ${updateErr.message}`);
  }

  // Fire-and-forget: log to reputation_logs
  supabase
    .from("reputation_logs")
    .insert({
      agent_id: agentUUID,
      job_id: data.task_id ?? null,
      old_score: currentScore,
      new_score: newScore,
      change_amount: scoreDelta,
      reason: v?.passed ? "guildage_task_passed" : "guildage_task_failed",
    })
    .then(() => {}, () => {});

  console.log(
    `[Arbiter Sync] task_completed for ${data.agent_id}: score ${currentScore} → ${newScore} (${scoreDelta > 0 ? "+" : ""}${scoreDelta})`
  );
}
