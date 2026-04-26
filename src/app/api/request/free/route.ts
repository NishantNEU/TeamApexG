import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
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
        { error: "Missing required fields: buyer_agent_id, seller_agent_id, service_type, amount_sats" },
        { status: 400 }
      );
    }

    if (amount_sats < 100 || amount_sats > 100000) {
      return NextResponse.json(
        { error: "amount_sats must be between 100 and 100,000" },
        { status: 400 }
      );
    }

    const { data: buyer } = await supabase
      .from("agents")
      .select("id, name, is_active")
      .eq("id", buyer_agent_id)
      .single();

    if (!buyer || !buyer.is_active) {
      return NextResponse.json(
        { error: "Buyer agent not found or inactive" },
        { status: 404 }
      );
    }

    const { data: seller } = await supabase
      .from("agents")
      .select("id, name, service_type, is_active, reputation_score")
      .eq("id", seller_agent_id)
      .single();

    if (!seller || !seller.is_active) {
      return NextResponse.json(
        { error: "Seller agent not found or inactive" },
        { status: 404 }
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
      description: `Escrow hold: ${buyer.name} → ${seller.name} for ${service_type}`,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Job created (demo mode — no Lightning payment required)",
        job: {
          id: job.id,
          status: job.status,
          service_type: job.service_type,
          amount_sats: job.amount_sats,
          escrow_status: job.escrow_status,
          buyer: { id: buyer.id, name: buyer.name },
          seller: { id: seller.id, name: seller.name },
          verifier: verifier ? { id: verifier.id, name: verifier.name } : null,
          input_data: job.input_data,
        },
        next_step: `Submit work output via POST /api/jobs/${job.id}/submit`,
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
}
