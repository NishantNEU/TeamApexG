import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { executeAgentTask } from "@/lib/agent-engine";
import { verifyJobOutput } from "@/lib/verifier";
import { calculateReputationChange, getAgentStreak } from "@/lib/reputation";
import { v4 as uuidv4 } from "uuid";

// ============================================
// POST /api/hire
// ============================================
// The REAL hire endpoint. Does everything in one flow:
// 1. Creates the job
// 2. Agent ACTUALLY does the work (calls Claude API)
// 3. Verifier checks quality
// 4. Escrow settles based on result
// 5. Reputation updates
//
// Returns the actual work output to the user.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { seller_agent_id, input_data, amount_sats } = body;

    // Validate
    if (!seller_agent_id || !input_data) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: {
            seller_agent_id: "UUID of the agent to hire",
            input_data: "Object with task details",
            amount_sats: "Payment amount (optional, default 500)",
          },
        },
        { status: 400 }
      );
    }

    const payment = amount_sats || 500;

    // Get seller agent
    const { data: seller } = await supabase
      .from("agents")
      .select("*")
      .eq("id", seller_agent_id)
      .eq("is_active", true)
      .single();

    if (!seller) {
      return NextResponse.json(
        { error: "Agent not found or inactive" },
        { status: 404 }
      );
    }

    // Get verifier
    const { data: verifiers } = await supabase
      .from("agents")
      .select("id, name, reputation_score")
      .eq("service_type", "verifier")
      .eq("is_active", true)
      .neq("id", seller_agent_id)
      .order("reputation_score", { ascending: false })
      .limit(1);

    const verifier = verifiers?.[0] || null;

    // Create job
    const jobId = uuidv4();

    await supabase.from("jobs").insert({
      id: jobId,
      buyer_agent_id: null, // human user, not an agent
      seller_agent_id: seller.id,
      verifier_agent_id: verifier?.id || null,
      service_type: seller.service_type,
      status: "in_progress",
      input_data,
      amount_sats: payment,
      escrow_status: "held",
    });

    // Log escrow hold
    await supabase.from("transactions").insert({
      job_id: jobId,
      from_agent_id: null,
      to_agent_id: null,
      type: "escrow_hold",
      amount_sats: payment,
      status: "completed",
      description: `User hired ${seller.name} for ${seller.service_type}`,
    });

    // ====== AGENT DOES REAL WORK ======
    const agentResult = await executeAgentTask({
      service_type: seller.service_type,
      input: input_data,
    });

    // Update job with output
    await supabase
      .from("jobs")
      .update({
        output_data: agentResult.output,
        status: "verifying",
      })
      .eq("id", jobId);

    // ====== VERIFY THE OUTPUT ======
    const verification = await verifyJobOutput({
      service_type: seller.service_type,
      input_data,
      output_data: agentResult.output,
    });

    // Update job with verification
    await supabase
      .from("jobs")
      .update({ verification_result: verification })
      .eq("id", jobId);

    // ====== SETTLE ESCROW + REPUTATION ======
    const streak = await getAgentStreak(seller.id);
    const now = new Date().toISOString();

    const repChange = calculateReputationChange({
      current_score: seller.reputation_score,
      passed: verification.passed,
      verification_score: verification.score,
      job_amount_sats: payment,
      consecutive_successes: verification.passed ? streak.successes + 1 : 0,
      consecutive_failures: verification.passed ? 0 : streak.failures + 1,
    });

    if (verification.passed) {
      // PASS — release escrow
      await supabase
        .from("jobs")
        .update({
          status: "completed",
          escrow_status: "released",
          completed_at: now,
        })
        .eq("id", jobId);

      await supabase.from("transactions").insert({
        job_id: jobId,
        from_agent_id: null,
        to_agent_id: seller.id,
        type: "escrow_release",
        amount_sats: payment,
        status: "completed",
        description: `Payment released to ${seller.name} | Quality: ${verification.score}/100`,
      });

      if (verifier) {
        await supabase.from("transactions").insert({
          job_id: jobId,
          from_agent_id: null,
          to_agent_id: verifier.id,
          type: "verification_fee",
          amount_sats: 50,
          status: "completed",
          description: `Verification fee → ${verifier.name}`,
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
        job_id: jobId,
        old_score: seller.reputation_score,
        new_score: repChange.new_score,
        change_amount: repChange.change,
        reason: repChange.reason,
      });
    } else {
      // FAIL — refund + slash
      await supabase
        .from("jobs")
        .update({
          status: "failed",
          escrow_status: "refunded",
          completed_at: now,
        })
        .eq("id", jobId);

      await supabase.from("transactions").insert({
        job_id: jobId,
        from_agent_id: null,
        to_agent_id: null,
        type: "escrow_refund",
        amount_sats: payment,
        status: "completed",
        description: `Refunded — ${seller.name} failed verification (${verification.score}/100)`,
      });

      const slashAmount = Math.min(100, seller.stake_sats);
      if (slashAmount > 0) {
        await supabase.from("transactions").insert({
          job_id: jobId,
          from_agent_id: seller.id,
          to_agent_id: null,
          type: "slash",
          amount_sats: slashAmount,
          status: "completed",
          description: `Stake slashed: ${seller.name} -${slashAmount} sats`,
        });

        await supabase
          .from("agents")
          .update({ stake_sats: Math.max(0, seller.stake_sats - slashAmount) })
          .eq("id", seller.id);
      }

      if (verifier) {
        await supabase.from("transactions").insert({
          job_id: jobId,
          from_agent_id: null,
          to_agent_id: verifier.id,
          type: "verification_fee",
          amount_sats: 50,
          status: "completed",
          description: `Verification fee → ${verifier.name}`,
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
        job_id: jobId,
        old_score: seller.reputation_score,
        new_score: repChange.new_score,
        change_amount: repChange.change,
        reason: repChange.reason,
      });
    }

    // ====== RETURN REAL RESULT TO USER ======
    return NextResponse.json({
      success: true,
      job_id: jobId,
      agent: {
        name: seller.name,
        service_type: seller.service_type,
        reputation_score: repChange.new_score,
        trust_tier:
          repChange.new_score >= 90
            ? "ELITE"
            : repChange.new_score >= 75
            ? "TRUSTED"
            : repChange.new_score >= 50
            ? "STANDARD"
            : repChange.new_score >= 25
            ? "PROBATION"
            : "UNTRUSTED",
      },
      work: {
        output: agentResult.output,
        processing_time_ms: agentResult.processing_time_ms,
        model_used: agentResult.model_used,
      },
      verification: {
        passed: verification.passed,
        score: verification.score,
        reasoning: verification.reasoning,
      },
      payment: {
        amount_sats: payment,
        escrow_status: verification.passed ? "released" : "refunded",
        verification_fee: 50,
        reputation_change: repChange.change,
      },
    });
  } catch (err: any) {
    console.error("Hire error:", err);
    return NextResponse.json(
      { error: "Failed to process hire request", details: err.message },
      { status: 500 }
    );
  }
}
