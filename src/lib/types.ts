export interface Agent {
  id: string;
  name: string;
  service_type: string;
  description: string | null;
  endpoint_url: string | null;
  reputation_score: number;
  total_jobs_completed: number;
  total_jobs_failed: number;
  stake_sats: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  buyer_agent_id: string;
  seller_agent_id: string;
  verifier_agent_id: string | null;
  service_type: string;
  status:
    | "pending"
    | "in_progress"
    | "verifying"
    | "completed"
    | "failed"
    | "refunded";
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  verification_result: Record<string, unknown> | null;
  amount_sats: number;
  escrow_status: "held" | "released" | "refunded";
  created_at: string;
  completed_at: string | null;
}

export interface Transaction {
  id: string;
  job_id: string | null;
  from_agent_id: string | null;
  to_agent_id: string | null;
  type:
    | "stake"
    | "escrow_hold"
    | "escrow_release"
    | "escrow_refund"
    | "verification_fee"
    | "query_fee"
    | "slash";
  amount_sats: number;
  status: "pending" | "completed" | "failed";
  lightning_invoice: string | null;
  payment_hash: string | null;
  description: string | null;
  created_at: string;
}

export interface ReputationLog {
  id: string;
  agent_id: string;
  job_id: string | null;
  old_score: number;
  new_score: number;
  change_amount: number;
  reason: string;
  created_at: string;
}
