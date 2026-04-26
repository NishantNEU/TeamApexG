import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { verifyJobOutput } from "@/lib/verifier";
import { v4 as uuidv4 } from "uuid";

const DEMO_TASKS: Record<string, { input: any; good_output: any; bad_output: any }> = {
  summarizer: {
    input: {
      text: "The Lightning Network is a Layer 2 payment protocol built on top of Bitcoin. It enables fast, low-cost transactions by creating payment channels between users. Transactions are processed off-chain but secured by the Bitcoin blockchain. This makes it ideal for micropayments, as fees are a fraction of a cent and settlement is instant. The network is open and permissionless, meaning anyone can participate without needing approval from a central authority.",
      max_length: 50,
    },
    good_output: {
      summary: "Lightning Network is a Bitcoin Layer 2 protocol enabling instant, near-free micropayments through off-chain payment channels, secured by the Bitcoin blockchain. It operates without central authority.",
      word_count: 24,
      confidence: 0.94,
    },
    bad_output: {
      summary: "test test test",
      word_count: 3,
      confidence: 0.1,
    },
  },
  code_review: {
    input: {
      code: "function add(a, b) { return a + b; }",
      language: "javascript",
      focus: "correctness and edge cases",
    },
    good_output: {
      review: "The function correctly adds two numbers. Consider adding type checks for non-numeric inputs and handling edge cases like NaN, Infinity, and string concatenation when non-numbers are passed.",
      severity: "low",
      suggestions: [
        "Add input type validation",
        "Consider TypeScript for type safety",
      ],
    },
    bad_output: {
      review: "Looks fine.",
      severity: "none",
      suggestions: [],
    },
  },
  translator: {
    input: {
      text: "Hello, how are you today?",
      source_language: "English",
      target_language: "Spanish",
    },
    good_output: {
      translation: "Hola, ¿cómo estás hoy?",
      confidence: 0.97,
      alternative: "Hola, ¿cómo te encuentras hoy?",
    },
    bad_output: {
      translation: "Bonjour comment allez-vous",
      confidence: 0.3,
    },
  },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { service_type, quality } = body;

    const taskType = service_type || "summarizer";
    const outputQuality = quality || "good";

    const task = DEMO_TASKS[taskType] || DEMO_TASKS.summarizer;

    const { data: buyers } = await supabase
      .from("agents")
      .select("id, name")
      .eq("is_active", true)
      .neq("service_type", taskType)
      .neq("service_type", "verifier")
      .limit(1);

    const { data: sellers } = await supabase
      .from("agents")
      .select("id, name, reputation_score, stake_sats, total_jobs_completed, total_jobs_failed")
      .eq("service_type", taskType)
      .eq("is_active", true)
      .order("reputation_score", { ascending: false })
      .limit(1);

    const { data: verifiers } = await supabase
      .from("agents")
      .select("id, name")
      .eq("service_type", "verifier")
      .eq("is_active", true)
      .limit(1);

    if (!buyers?.length || !sellers?.length) {
      return NextResponse.json(
        {
          error: "Not enough agents. Run POST /api/seed first to create demo agents.",
        },
        { status: 400 }
      );
    }

    const buyer = buyers[0];
    const seller = sellers[0];
    const verifier = verifiers?.[0] || null;

    // Step 1: Create Job
    const jobId = uuidv4();
    const amount = 500;

    await supabase.from("jobs").insert({
      id: jobId,
      buyer_agent_id: buyer.id,
      seller_agent_id: seller.id,
      verifier_agent_id: verifier?.id || null,
      service_type: taskType,
      status: "in_progress",
      input_data: task.input,
      amount_sats: amount,
      escrow_status: "held",
    });

    await supabase.from("transactions").insert({
      job_id: jobId,
      from_agent_id: buyer.id,
      to_agent_id: null,
      type: "escrow_hold",
      amount_sats: amount,
      status: "completed",
      description: `Demo escrow: ${buyer.name} → ${seller.name}`,
    });

    // Step 2: Submit Output
    const output = outputQuality === "bad" ? task.bad_output : task.good_output;

    await supabase
      .from("jobs")
      .update({
        output_data: output,
        status: "verifying",
      })
      .eq("id", jobId);

    // Step 3: Run Verification
    const verificationResult = await verifyJobOutput({
      service_type: taskType,
      input_data: task.input,
      output_data: output,
    });

    // Step 4: Process Result
    const now = new Date().toISOString();

    if (verificationResult.passed) {
      const newRep = Math.min(100, seller.reputation_score + 5);

      await supabase
        .from("jobs")
        .update({
          status: "completed",
          escrow_status: "released",
          verification_result: verificationResult,
          completed_at: now,
        })
        .eq("id", jobId);

      await supabase.from("transactions").insert({
        job_id: jobId,
        from_agent_id: buyer.id,
        to_agent_id: seller.id,
        type: "escrow_release",
        amount_sats: amount,
        status: "completed",
        description: `Demo escrow released: ${buyer.name} → ${seller.name}`,
      });

      if (verifier) {
        await supabase.from("transactions").insert({
          job_id: jobId,
          from_agent_id: null,
          to_agent_id: verifier.id,
          type: "verification_fee",
          amount_sats: 50,
          status: "completed",
          description: `Demo verification fee → ${verifier.name}`,
        });
      }

      await supabase
        .from("agents")
        .update({
          reputation_score: newRep,
          total_jobs_completed: seller.total_jobs_completed + 1,
          updated_at: now,
        })
        .eq("id", seller.id);

      await supabase.from("reputation_logs").insert({
        agent_id: seller.id,
        job_id: jobId,
        old_score: seller.reputation_score,
        new_score: newRep,
        change_amount: 5,
        reason: "job_completed",
      });
    } else {
      const newRep = Math.max(0, seller.reputation_score - 10);
      const slashAmount = Math.min(100, seller.stake_sats);

      await supabase
        .from("jobs")
        .update({
          status: "failed",
          escrow_status: "refunded",
          verification_result: verificationResult,
          completed_at: now,
        })
        .eq("id", jobId);

      await supabase.from("transactions").insert({
        job_id: jobId,
        from_agent_id: null,
        to_agent_id: buyer.id,
        type: "escrow_refund",
        amount_sats: amount,
        status: "completed",
        description: `Demo escrow refunded → ${buyer.name}`,
      });

      if (slashAmount > 0) {
        await supabase.from("transactions").insert({
          job_id: jobId,
          from_agent_id: seller.id,
          to_agent_id: null,
          type: "slash",
          amount_sats: slashAmount,
          status: "completed",
          description: `Demo stake slashed: ${seller.name} -${slashAmount} sats`,
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
          description: `Demo verification fee → ${verifier.name}`,
        });
      }

      await supabase
        .from("agents")
        .update({
          reputation_score: newRep,
          total_jobs_failed: seller.total_jobs_failed + 1,
          updated_at: now,
        })
        .eq("id", seller.id);

      await supabase.from("reputation_logs").insert({
        agent_id: seller.id,
        job_id: jobId,
        old_score: seller.reputation_score,
        new_score: newRep,
        change_amount: -10,
        reason: "job_failed",
      });
    }

    return NextResponse.json({
      success: true,
      demo_flow: {
        step_1: `Job created: ${buyer.name} hired ${seller.name} for ${taskType}`,
        step_2: `Output submitted (quality: ${outputQuality})`,
        step_3: `AI verified output — Score: ${verificationResult.score}/100`,
        step_4: verificationResult.passed
          ? `PASSED — ${amount} sats released to ${seller.name}`
          : `FAILED — ${amount} sats refunded to ${buyer.name}, stake slashed`,
      },
      job_id: jobId,
      verification: verificationResult,
      agents: {
        buyer: buyer.name,
        seller: seller.name,
        verifier: verifier?.name || "none",
      },
      hint: "Try with quality: 'bad' to see a failed verification and stake slashing",
    });
  } catch (err) {
    console.error("Demo error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/demo",
    description: "Run the complete Arbiter flow in one call. Perfect for demoing to judges.",
    fields: {
      service_type: "optional — 'summarizer' (default), 'code_review', or 'translator'",
      quality: "optional — 'good' (default) or 'bad' (triggers failed verification + stake slash)",
    },
    examples: [
      {
        description: "Successful job with good output",
        body: { service_type: "summarizer", quality: "good" },
      },
      {
        description: "Failed job with bad output (triggers stake slashing)",
        body: { service_type: "code_review", quality: "bad" },
      },
    ],
  });
}
