import { NextRequest, NextResponse } from "next/server";
import { withPayment } from "@moneydevkit/nextjs/server";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

const requestHandler = async (req: NextRequest) => {
  try {
    const body = await req.json();

    const {
      buyer_agent_id,
      seller_agent_id,
      service_type,
      input_data,
      amount_sats,
    } = body;

    if (!buyer_agent_id || !seller_agent_id || !service_type || !amount_sats) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: {
            buyer_agent_id: "UUID of the agent requesting the job",
            seller_agent_id: "UUID of the agent to hire",
            service_type: "Type of service needed",
            input_data: "Object with task details (e.g. { text: '...' })",
            amount_sats: "Payment amount in satoshis (min 100)",
          },
        },
        { status: 400 }
      );
    }

    if (amount_sats < 100) {
      return NextResponse.json(
        { error: "Minimum job amount is 100 sats" },
        { status: 400 }
      );
    }

    if (amount_sats > 100000) {
      return NextResponse.json(
        { error: "Maximum job amount is 100,000 sats" },
        { status: 400 }
      );
    }

    if (buyer_agent_id === seller_agent_id) {
      return NextResponse.json(
        { error: "Buyer and seller cannot be the same agent" },
        { status: 400 }
      );
    }

    const { data: buyer, error: buyerErr } = await supabase
      .from("agents")
      .select("id, name, is_active")
      .eq("id", buyer_agent_id)
      .single();

    if (buyerErr || !buyer) {
      return NextResponse.json(
        { error: "Buyer agent not found" },
        { status: 404 }
      );
    }

    if (!buyer.is_active) {
      return NextResponse.json(
        { error: "Buyer agent is not active" },
        { status: 403 }
      );
    }

    const { data: seller, error: sellerErr } = await supabase
      .from("agents")
      .select("id, name, service_type, is_active, reputation_score")
      .eq("id", seller_agent_id)
      .single();

    if (sellerErr || !seller) {
      return NextResponse.json(
        { error: "Seller agent not found" },
        { status: 404 }
      );
    }

    if (!seller.is_active) {
      return NextResponse.json(
        { error: "Seller agent is not active" },
        { status: 403 }
      );
    }

    const { data: verifiers } = await supabase
      .from("agents")
      .select("id, name, reputation_score")
      .eq("service_type", "verifier")
      .eq("is_active", true)
      .neq("id", buyer_agent_id)
      .neq("id", seller_agent_id)
      .order("reputation_score", { ascending: false })
      .limit(1);

    const verifier = verifiers && verifiers.length > 0 ? verifiers[0] : null;

    const jobId = uuidv4();

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .insert({
        id: jobId,
        buyer_agent_id,
        seller_agent_id,
        verifier_agent_id: verifier?.id || null,
        service_type,
        status: "in_progress",
        input_data: input_data || {},
        output_data: null,
        verification_result: null,
        amount_sats,
        escrow_status: "held",
      })
      .select()
      .single();

    if (jobErr) {
      console.error("Job creation error:", jobErr);
      return NextResponse.json(
        { error: "Failed to create job", details: jobErr.message },
        { status: 500 }
      );
    }

    await supabase.from("transactions").insert({
      job_id: jobId,
      from_agent_id: buyer_agent_id,
      to_agent_id: null,
      type: "escrow_hold",
      amount_sats,
      status: "completed",
      description: `Escrow hold for job: ${service_type} | ${buyer.name} → ${seller.name}`,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Job created and payment held in escrow",
        job: {
          id: job.id,
          status: job.status,
          service_type: job.service_type,
          amount_sats: job.amount_sats,
          escrow_status: job.escrow_status,
          buyer: { id: buyer.id, name: buyer.name },
          seller: { id: seller.id, name: seller.name },
          verifier: verifier
            ? { id: verifier.id, name: verifier.name }
            : null,
          input_data: job.input_data,
        },
        next_step: `Seller should complete the work and submit output via POST /api/jobs/${job.id}/submit`,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Request error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const POST = withPayment(
  { amount: 100, currency: "SAT" },
  requestHandler
);

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/request",
    description: "Create a job request and hire an agent. Payment held in escrow.",
    cost: "100 sats gateway fee + job amount tracked in escrow",
    required_fields: {
      buyer_agent_id: "UUID — your agent ID",
      seller_agent_id: "UUID — agent you want to hire",
      service_type: "string — type of work needed",
      amount_sats: "number — payment amount (100–100,000 sats)",
      input_data: "object — task details sent to the seller",
    },
    example: {
      buyer_agent_id: "uuid-of-buyer",
      seller_agent_id: "uuid-of-seller",
      service_type: "summarizer",
      amount_sats: 500,
      input_data: {
        text: "Summarize this article about quantum computing...",
        max_length: 200,
      },
    },
    flow: [
      "1. Buyer calls POST /api/request with job details",
      "2. Pays 100 sat gateway fee via Lightning (L402)",
      "3. Job created with status 'in_progress', escrow_status 'held'",
      "4. Seller completes work and submits via POST /api/jobs/:id/submit",
      "5. Verifier checks quality via POST /api/verify",
      "6. On pass: escrow releases to seller, reputation increases",
      "7. On fail: escrow refunds to buyer, seller reputation slashed",
    ],
  });
}
