import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// ─── CORS ────────────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ─── Types ───────────────────────────────────────────────────────────────────
type SyncEvent =
  | "agent_registered"
  | "swap_completed"
  | "borrow_completed"
  | "task_completed";

interface AgentRegisteredData {
  agent_id: string;
  name: string;
  owner_name?: string;
  skills?: string[];
  token_balance?: number;
  deposit_sats?: number;
}

interface SwapCompletedData {
  swap_id: string;
  requester_agent_id: string;
  provider_agent_id: string;
  skill_requested: string;
}

interface BorrowCompletedData {
  borrow_id: string;
  borrower_agent_id: string;
  provider_agent_id: string;
  skill_requested: string;
  tokens_paid: number;
}

interface TaskCompletedData {
  agent_id: string;
  task_id: string;
  description: string;
  tokens_earned: number;
  verification?: {
    passed: boolean;
    score: number;
    trust_tier: string;
    reasoning?: string;
  };
}

// ─── CORS preflight ──────────────────────────────────────────────────────────
export async function OPTIONS() {
  return new Response(null, { status: 200, headers: CORS });
}

// ─── POST /api/integration/sync ──────────────────────────────────────────────
// Guildage sends events → Arbiter stores them for dashboard + analytics
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, data } = body as { event: SyncEvent; data: Record<string, any> };

    if (!event) {
      return NextResponse.json(
        { error: "Missing required field: event" },
        { status: 400, headers: CORS }
      );
    }

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        { error: "Missing required field: data (must be an object)" },
        { status: 400, headers: CORS }
      );
    }

    console.log(`[Arbiter Sync] ${event}: ${JSON.stringify(data).slice(0, 200)}`);

    switch (event) {
      case "agent_registered":
        await handleAgentRegistered(data as AgentRegisteredData);
        break;

      case "swap_completed":
        await handleGuildageEvent("swap", data as SwapCompletedData);
        break;

      case "borrow_completed":
        await handleGuildageEvent("borrow", data as BorrowCompletedData);
        break;

      case "task_completed":
        await handleTaskCompleted(data as TaskCompletedData);
        break;

      default:
        return NextResponse.json(
          {
            error: `Unknown event type: ${event}`,
            valid_events: ["agent_registered", "swap_completed", "borrow_completed", "task_completed"],
          },
          { status: 400, headers: CORS }
        );
    }

    return NextResponse.json(
      { success: true, event, message: `Event '${event}' synced to Arbiter` },
      { headers: CORS }
    );
  } catch (err: any) {
    console.error("[Arbiter Sync] Error:", err.message);
    return NextResponse.json(
      { error: "Sync failed", details: err.message },
      { status: 500, headers: CORS }
    );
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function handleAgentRegistered(data: AgentRegisteredData) {
  if (!data.agent_id || !data.name) {
    console.warn("[Arbiter Sync] agent_registered missing agent_id or name");
    return;
  }

  const { error } = await supabase.from("guildage_agents").upsert(
    {
      id: data.agent_id,
      name: data.name,
      owner_name: data.owner_name ?? null,
      skills: data.skills ?? [],
      token_balance: data.token_balance ?? 0,
      deposit_sats: data.deposit_sats ?? 0,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[Arbiter Sync] guildage_agents upsert error:", error.message);
  }
}

async function handleGuildageEvent(event_type: string, data: Record<string, any>) {
  const { error } = await supabase.from("guildage_events").insert({
    event_type,
    data,
    source: "guildage",
  });

  if (error) {
    console.error(`[Arbiter Sync] guildage_events insert error (${event_type}):`, error.message);
  }
}

async function handleTaskCompleted(data: TaskCompletedData) {
  // Insert into guildage_events
  const { error: evtErr } = await supabase.from("guildage_events").insert({
    event_type: "task",
    data,
    source: "guildage",
  });

  if (evtErr) {
    console.error("[Arbiter Sync] guildage_events insert error (task):", evtErr.message);
  }

  // If verification score present, also log to integration_logs
  if (data.verification?.score !== undefined) {
    const v = data.verification;
    const trust_tier =
      v.score >= 90 ? "ELITE"
      : v.score >= 75 ? "TRUSTED"
      : v.score >= 50 ? "STANDARD"
      : v.score >= 25 ? "PROBATION"
      : "UNTRUSTED";

    const { error: logErr } = await supabase.from("integration_logs").insert({
      agent_id: data.agent_id ?? null,
      agent_name: null,
      service_type: "task",
      score: v.score,
      passed: v.passed ?? v.score >= 60,
      trust_tier: v.trust_tier ?? trust_tier,
      source: "guildage",
    });

    if (logErr) {
      console.error("[Arbiter Sync] integration_logs insert error:", logErr.message);
    }
  }
}
