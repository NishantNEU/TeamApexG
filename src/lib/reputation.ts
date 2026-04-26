// ============================================
// ARBITER REPUTATION ENGINE
// ============================================
// Formalizes trust scoring for the agent economy.
// Reputation is the currency of trust — it determines
// what agents can charge and who will hire them.

import { supabase } from "./supabase";

// ---- Trust Tier Definitions ----

export interface TrustTier {
  name: string;
  min_score: number;
  max_score: number;
  color: string;
  pricing_multiplier: number;
  description: string;
}

export const TRUST_TIERS: TrustTier[] = [
  {
    name: "UNTRUSTED",
    min_score: 0,
    max_score: 24,
    color: "#ef4444",
    pricing_multiplier: 0.5,
    description: "New or consistently failing agent. Reduced earning potential.",
  },
  {
    name: "PROBATION",
    min_score: 25,
    max_score: 49,
    color: "#f97316",
    pricing_multiplier: 0.75,
    description: "Below average track record. Building trust.",
  },
  {
    name: "STANDARD",
    min_score: 50,
    max_score: 74,
    color: "#eab308",
    pricing_multiplier: 1.0,
    description: "Average reliability. Default tier for new agents.",
  },
  {
    name: "TRUSTED",
    min_score: 75,
    max_score: 89,
    color: "#22c55e",
    pricing_multiplier: 1.5,
    description: "Proven track record. Premium earning potential.",
  },
  {
    name: "ELITE",
    min_score: 90,
    max_score: 100,
    color: "#a855f7",
    pricing_multiplier: 2.0,
    description: "Top-tier agent. Maximum earning potential and priority in discovery.",
  },
];

// ---- Core Functions ----

export function getTrustTier(score: number): TrustTier {
  const clamped = Math.min(100, Math.max(0, score));
  return (
    TRUST_TIERS.find(
      (tier) => clamped >= tier.min_score && clamped <= tier.max_score
    ) || TRUST_TIERS[0]
  );
}

export function getPricingMultiplier(score: number): number {
  return getTrustTier(score).pricing_multiplier;
}

// ---- Reputation Calculation ----

interface ReputationChangeParams {
  current_score: number;
  passed: boolean;
  verification_score: number;
  job_amount_sats: number;
  consecutive_successes: number;
  consecutive_failures: number;
}

export function calculateReputationChange(
  params: ReputationChangeParams
): { new_score: number; change: number; reason: string } {
  const {
    current_score,
    passed,
    verification_score,
    job_amount_sats,
    consecutive_successes,
    consecutive_failures,
  } = params;

  let change = 0;
  let reason = "";

  if (passed) {
    // Base increase: 3-8 points depending on verification quality
    let base = 3 + Math.round((verification_score / 100) * 5);

    // Job value bonus
    const valueBonus = job_amount_sats >= 5000 ? 2 : job_amount_sats >= 1000 ? 1 : 0;
    base += valueBonus;

    // Streak bonus
    let streakBonus = 0;
    if (consecutive_successes >= 10) {
      streakBonus = 3;
      reason = "job_completed_streak_10";
    } else if (consecutive_successes >= 5) {
      streakBonus = 2;
      reason = "job_completed_streak_5";
    } else if (consecutive_successes >= 3) {
      streakBonus = 1;
      reason = "job_completed_streak_3";
    } else {
      reason = "job_completed";
    }
    base += streakBonus;

    // Diminishing returns at high reputation
    if (current_score >= 90) {
      base = Math.ceil(base * 0.5);
    } else if (current_score >= 75) {
      base = Math.ceil(base * 0.75);
    }

    change = base;
  } else {
    // Base decrease: 5-15 points depending on how bad
    let base = 5 + Math.round(((100 - verification_score) / 100) * 10);

    // Streak penalty
    if (consecutive_failures >= 5) {
      base += 5;
      reason = "job_failed_streak_5";
    } else if (consecutive_failures >= 3) {
      base += 3;
      reason = "job_failed_streak_3";
    } else {
      reason = "job_failed";
    }

    // Higher reputation agents fall harder
    if (current_score >= 90) {
      base = Math.ceil(base * 1.5);
    }

    change = -base;
  }

  const new_score = Math.min(100, Math.max(0, current_score + change));

  return { new_score, change, reason };
}

// ---- Streak Calculator ----

export async function getAgentStreak(
  agentId: string
): Promise<{ successes: number; failures: number }> {
  const { data: recentJobs } = await supabase
    .from("jobs")
    .select("status")
    .eq("seller_agent_id", agentId)
    .in("status", ["completed", "failed"])
    .order("completed_at", { ascending: false })
    .limit(20);

  if (!recentJobs || recentJobs.length === 0) {
    return { successes: 0, failures: 0 };
  }

  let successes = 0;
  let failures = 0;

  for (const job of recentJobs) {
    if (job.status === "completed") {
      successes++;
    } else {
      break;
    }
  }

  if (successes === 0) {
    for (const job of recentJobs) {
      if (job.status === "failed") {
        failures++;
      } else {
        break;
      }
    }
  }

  return { successes, failures };
}

// ---- Reputation Decay ----

export async function applyReputationDecay(): Promise<{
  agents_decayed: number;
  details: Array<{ id: string; name: string; old_score: number; new_score: number }>;
}> {
  const DECAY_DAYS = 7;
  const DECAY_AMOUNT = 2;
  const MIN_SCORE_FOR_DECAY = 30;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - DECAY_DAYS);

  const { data: allAgents } = await supabase
    .from("agents")
    .select("id, name, reputation_score, updated_at")
    .eq("is_active", true)
    .gt("reputation_score", MIN_SCORE_FOR_DECAY);

  if (!allAgents || allAgents.length === 0) {
    return { agents_decayed: 0, details: [] };
  }

  const details: Array<{ id: string; name: string; old_score: number; new_score: number }> = [];

  for (const agent of allAgents) {
    const { data: lastJob } = await supabase
      .from("jobs")
      .select("completed_at")
      .eq("seller_agent_id", agent.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1);

    const lastActivity = lastJob?.[0]?.completed_at
      ? new Date(lastJob[0].completed_at)
      : new Date(agent.updated_at);

    if (lastActivity < cutoffDate) {
      const newScore = Math.max(
        MIN_SCORE_FOR_DECAY,
        agent.reputation_score - DECAY_AMOUNT
      );

      if (newScore < agent.reputation_score) {
        await supabase
          .from("agents")
          .update({
            reputation_score: newScore,
            updated_at: new Date().toISOString(),
          })
          .eq("id", agent.id);

        await supabase.from("reputation_logs").insert({
          agent_id: agent.id,
          job_id: null,
          old_score: agent.reputation_score,
          new_score: newScore,
          change_amount: -(agent.reputation_score - newScore),
          reason: "inactivity_decay",
        });

        details.push({
          id: agent.id,
          name: agent.name,
          old_score: agent.reputation_score,
          new_score: newScore,
        });
      }
    }
  }

  return { agents_decayed: details.length, details };
}

// ---- Agent Stats Calculator ----

export interface AgentStats {
  id: string;
  name: string;
  service_type: string;
  reputation_score: number;
  trust_tier: TrustTier;
  pricing_multiplier: number;
  total_jobs: number;
  jobs_completed: number;
  jobs_failed: number;
  success_rate: number;
  current_streak: { successes: number; failures: number };
  total_earned_sats: number;
  total_slashed_sats: number;
  net_earnings_sats: number;
  stake_sats: number;
  rank: number;
}

export async function getAgentStats(agentId: string): Promise<AgentStats | null> {
  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (!agent) return null;

  const streak = await getAgentStreak(agentId);

  const { data: earnings } = await supabase
    .from("transactions")
    .select("type, amount_sats")
    .eq("to_agent_id", agentId)
    .eq("status", "completed")
    .eq("type", "escrow_release");

  const { data: slashes } = await supabase
    .from("transactions")
    .select("amount_sats")
    .eq("from_agent_id", agentId)
    .eq("status", "completed")
    .eq("type", "slash");

  const totalEarned = (earnings || []).reduce((s, t) => s + t.amount_sats, 0);
  const totalSlashed = (slashes || []).reduce((s, t) => s + t.amount_sats, 0);

  const { count: higherRankedCount } = await supabase
    .from("agents")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .gt("reputation_score", agent.reputation_score);

  const totalJobs = agent.total_jobs_completed + agent.total_jobs_failed;

  return {
    id: agent.id,
    name: agent.name,
    service_type: agent.service_type,
    reputation_score: agent.reputation_score,
    trust_tier: getTrustTier(agent.reputation_score),
    pricing_multiplier: getPricingMultiplier(agent.reputation_score),
    total_jobs: totalJobs,
    jobs_completed: agent.total_jobs_completed,
    jobs_failed: agent.total_jobs_failed,
    success_rate: totalJobs > 0 ? Math.round((agent.total_jobs_completed / totalJobs) * 100) : 0,
    current_streak: streak,
    total_earned_sats: totalEarned,
    total_slashed_sats: totalSlashed,
    net_earnings_sats: totalEarned - totalSlashed,
    stake_sats: agent.stake_sats,
    rank: (higherRankedCount || 0) + 1,
  };
}
