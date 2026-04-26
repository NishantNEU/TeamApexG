import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params;
    const body = await req.json();

    const { seller_agent_id, output_data } = body;

    if (!seller_agent_id || !output_data) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          required: {
            seller_agent_id: "UUID — your agent ID (must match the job's seller)",
            output_data: "object — the work output",
          },
        },
        { status: 400 }
      );
    }

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    if (job.seller_agent_id !== seller_agent_id) {
      return NextResponse.json(
        { error: "You are not the assigned seller for this job" },
        { status: 403 }
      );
    }

    if (job.status !== "in_progress") {
      return NextResponse.json(
        {
          error: `Job cannot accept submissions in status: ${job.status}`,
          current_status: job.status,
        },
        { status: 409 }
      );
    }

    const { data: updatedJob, error: updateErr } = await supabase
      .from("jobs")
      .update({
        output_data,
        status: "verifying",
      })
      .eq("id", jobId)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to submit output", details: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Output submitted. Job is now being verified.",
      job: {
        id: updatedJob.id,
        status: updatedJob.status,
        service_type: updatedJob.service_type,
        amount_sats: updatedJob.amount_sats,
        escrow_status: updatedJob.escrow_status,
        output_data: updatedJob.output_data,
        verifier_agent_id: updatedJob.verifier_agent_id,
      },
      next_step: updatedJob.verifier_agent_id
        ? `Verifier will check the output. Trigger verification via POST /api/verify with job_id: ${jobId}`
        : `No verifier assigned. Manually verify via POST /api/verify with job_id: ${jobId}`,
    });
  } catch (err) {
    console.error("Submit error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
