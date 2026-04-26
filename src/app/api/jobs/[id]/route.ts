import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;

    const { data: job, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    const agentIds = [
      job.buyer_agent_id,
      job.seller_agent_id,
      job.verifier_agent_id,
    ].filter(Boolean);

    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, reputation_score")
      .in("id", agentIds);

    const agentMap: Record<string, any> = {};
    (agents || []).forEach((a) => {
      agentMap[a.id] = a;
    });

    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        service_type: job.service_type,
        amount_sats: job.amount_sats,
        escrow_status: job.escrow_status,
        created_at: job.created_at,
        completed_at: job.completed_at,
        buyer: agentMap[job.buyer_agent_id] || { id: job.buyer_agent_id },
        seller: agentMap[job.seller_agent_id] || { id: job.seller_agent_id },
        verifier: job.verifier_agent_id
          ? agentMap[job.verifier_agent_id] || { id: job.verifier_agent_id }
          : null,
        input_data: job.input_data,
        output_data: job.output_data,
        verification_result: job.verification_result,
      },
      transactions: transactions || [],
    });
  } catch (err) {
    console.error("Job lookup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
