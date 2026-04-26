import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyJobOutput } from "@/lib/verifier";

const VERIFICATION_FEE_SATS = 50;
const REP_INCREASE_ON_PASS = 5;
const REP_DECREASE_ON_FAIL = 10;
const STAKE_SLASH_AMOUNT = 100;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { job_id } = body;

    if (!job_id) {
      return NextResponse.json(
        { error: "Missing required field: job_id" },
        { status: 400 }
      );
    }

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.status !== "verifying") {
      return NextResponse.json(
        {
          error: `Job is not ready for verification. Current status: ${job.status}`,
          hint: job.status === "in_progress"
            ? "Seller needs to submit output first via POST /api/jobs/:id/submit"
            : "This job has already been verified.",
        },
        { status: 409 }
      );
    }

    if (!job.output_data) {
      return NextResponse.json(
        { error: "Job has no output data to verify" },
        { status: 400 }
      );
    }

    const { data: seller } = await supabase
      .from("agents")
      .select("id, name, reputation_score, stake_sats, total_jobs_completed, total_jobs_failed")
      .eq("id", job.seller_agent_id)
      .single();

    const { data: buyer } = await supabase
      .from("agents")
      .select("id, name")
      .eq("id", job.buyer_agent_id)
      .single();

    const { data: verifierAgent } = job.verifier_agent_id
      ? await supabase
          .from("agents")
          .select("id, name")
          .eq("id", job.verifier_agent_id)
          .single()
      : { data: null };

    if (!seller || !buyer) {
      return NextResponse.json(
        { error: "Could not find buyer or seller agent" },
        { status: 500 }
      );
    }

    const verificationResult = await verifyJobOutput({
      service_type: job.service_type,
      input_data: job.input_data,
      output_data: job.output_data,
    });

    if (verificationResult.passed) {
      await processPass(job, seller, buyer, verifierAgent, verificationResult);
    } else {
      await processFail(job, seller, buyer, verifierAgent, verificationResult);
    }

    const { data: updatedJob } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    const { data: updatedSeller } = await supabase
      .from("agents")
      .select("id, name, reputation_score, stake_sats")
      .eq("id", job.seller_agent_id)
      .single();

    return NextResponse.json({
      success: true,
      verification: {
        passed: verificationResult.passed,
        score: verificationResult.score,
        reasoning: verificationResult.reasoning,
        issues: verificationResult.issues,
      },
      job: {
        id: updatedJob?.id,
        status: updatedJob?.status,
        escrow_status: updatedJob?.escrow_status,
        amount_sats: updatedJob?.amount_sats,
        completed_at: updatedJob?.completed_at,
      },
      seller_update: {
        name: updatedSeller?.name,
        reputation_score: updatedSeller?.reputation_score,
        stake_sats: updatedSeller?.stake_sats,
        change: verificationResult.passed
          ? `+${REP_INCREASE_ON_PASS} reputation`
          : `-${REP_DECREASE_ON_FAIL} reputation, -${STAKE_SLASH_AMOUNT} sats stake slashed`,
      },
      summary: verificationResult.passed
        ? `✅ PASSED — ${job.amount_sats} sats released to ${seller.name}. Reputation increased.`
        : `❌ FAILED — ${job.amount_sats} sats refunded to ${buyer.name}. ${seller.name}'s reputation decreased and stake slashed.`,
    });
  } catch (err) {
    console.error("Verification error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function processPass(
  job: any,
  seller: any,
  buyer: any,
  verifierAgent: any,
  result: any
) {
  const now = new Date().toISOString();

  const { calculateReputationChange, getAgentStreak } = await import("@/lib/reputation");

  const streak = await getAgentStreak(seller.id);
  const repChange = calculateReputationChange({
    current_score: seller.reputation_score,
    passed: true,
    verification_score: result.score,
    job_amount_sats: job.amount_sats,
    consecutive_successes: streak.successes + 1,
    consecutive_failures: 0,
  });

  await supabase
    .from("jobs")
    .update({
      status: "completed",
      escrow_status: "released",
      verification_result: result,
      completed_at: now,
    })
    .eq("id", job.id);

  await supabase.from("transactions").insert({
    job_id: job.id,
    from_agent_id: job.buyer_agent_id,
    to_agent_id: job.seller_agent_id,
    type: "escrow_release",
    amount_sats: job.amount_sats,
    status: "completed",
    description: `Escrow released: ${buyer.name} → ${seller.name} | Score: ${result.score}/100`,
  });

  if (verifierAgent) {
    await supabase.from("transactions").insert({
      job_id: job.id,
      from_agent_id: null,
      to_agent_id: verifierAgent.id,
      type: "verification_fee",
      amount_sats: VERIFICATION_FEE_SATS,
      status: "completed",
      description: `Verification fee for job ${job.id} | Result: PASS`,
    });
  }

  await supabase
    .from("agents")
    .update({
      reputation_score: repChange.new_score,
      total_jobs_completed: seller.total_jobs_completed + 1,
      updated_at: now,
    })
    .eq("id", seller.id);

  await supabase.from("reputation_logs").insert({
    agent_id: seller.id,
    job_id: job.id,
    old_score: seller.reputation_score,
    new_score: repChange.new_score,
    change_amount: repChange.change,
    reason: repChange.reason,
  });
}

async function processFail(
  job: any,
  seller: any,
  buyer: any,
  verifierAgent: any,
  result: any
) {
  const now = new Date().toISOString();

  const { calculateReputationChange, getAgentStreak } = await import("@/lib/reputation");

  const streak = await getAgentStreak(seller.id);
  const repChange = calculateReputationChange({
    current_score: seller.reputation_score,
    passed: false,
    verification_score: result.score,
    job_amount_sats: job.amount_sats,
    consecutive_successes: 0,
    consecutive_failures: streak.failures + 1,
  });

  await supabase
    .from("jobs")
    .update({
      status: "failed",
      escrow_status: "refunded",
      verification_result: result,
      completed_at: now,
    })
    .eq("id", job.id);

  await supabase.from("transactions").insert({
    job_id: job.id,
    from_agent_id: null,
    to_agent_id: job.buyer_agent_id,
    type: "escrow_refund",
    amount_sats: job.amount_sats,
    status: "completed",
    description: `Escrow refunded to ${buyer.name} | Score: ${result.score}/100`,
  });

  const slashAmount = Math.min(STAKE_SLASH_AMOUNT, seller.stake_sats);

  if (slashAmount > 0) {
    await supabase.from("transactions").insert({
      job_id: job.id,
      from_agent_id: seller.id,
      to_agent_id: null,
      type: "slash",
      amount_sats: slashAmount,
      status: "completed",
      description: `Stake slashed: ${seller.name} -${slashAmount} sats`,
    });

    await supabase
      .from("agents")
      .update({
        stake_sats: Math.max(0, seller.stake_sats - slashAmount),
      })
      .eq("id", seller.id);
  }

  if (verifierAgent) {
    await supabase.from("transactions").insert({
      job_id: job.id,
      from_agent_id: null,
      to_agent_id: verifierAgent.id,
      type: "verification_fee",
      amount_sats: VERIFICATION_FEE_SATS,
      status: "completed",
      description: `Verification fee for job ${job.id} | Result: FAIL`,
    });
  }

  await supabase
    .from("agents")
    .update({
      reputation_score: repChange.new_score,
      total_jobs_failed: seller.total_jobs_failed + 1,
      updated_at: now,
    })
    .eq("id", seller.id);

  await supabase.from("reputation_logs").insert({
    agent_id: seller.id,
    job_id: job.id,
    old_score: seller.reputation_score,
    new_score: repChange.new_score,
    change_amount: repChange.change,
    reason: repChange.reason,
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/verify",
    description: "Trigger AI-powered verification for a job in 'verifying' status.",
    required_fields: {
      job_id: "UUID of the job to verify",
    },
    how_it_works: [
      "1. Send POST with job_id",
      "2. AI verifier assesses the seller's output quality",
      "3. Score 60+ = PASS, below 60 = FAIL",
      "4. PASS: escrow releases to seller, reputation +5",
      "5. FAIL: escrow refunds to buyer, reputation -10, stake slashed 100 sats",
      "6. Verifier agent earns 50 sats regardless of outcome",
    ],
  });
}
