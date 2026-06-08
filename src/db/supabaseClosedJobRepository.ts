import { SupabaseClient } from "@supabase/supabase-js";
import { ClosedJobRepository } from "./closedJobRepository";
import { ClosedJobRecord, NewClosedJob, SaveResult } from "./types";

/**
 * Shape of a row returned by the Supabase JSON API.
 *
 * Differences from ClosedJobRecord:
 *  - created_at comes back as an ISO 8601 string, not a Date object.
 *  - closed_amount arrives as a JS number (PostgreSQL numeric is decoded by
 *    the PostgREST JSON layer), but we run Number() on it as a safety measure
 *    in case the driver ever returns it as a string.
 */
interface ClosedJobRow {
  id: string;
  raw_message: string;
  company_name: string;
  customer_name: string;
  phone: string;
  address: string;
  service: string;
  appointment: string;
  technician_name: string;
  closed_amount: number;
  payment_method: string;
  created_at: string;
  source_message_id: string;
  needs_review: boolean;
}

// PostgreSQL error code for a UNIQUE constraint violation.
const UNIQUE_VIOLATION_CODE = "23505";

const TABLE = "closed_jobs";

function rowToRecord(row: ClosedJobRow): ClosedJobRecord {
  return {
    id: row.id,
    raw_message: row.raw_message,
    company_name: row.company_name,
    customer_name: row.customer_name,
    phone: row.phone,
    address: row.address,
    service: row.service,
    appointment: row.appointment,
    technician_name: row.technician_name,
    closed_amount: Number(row.closed_amount),
    payment_method: row.payment_method,
    created_at: new Date(row.created_at),
    source_message_id: row.source_message_id,
    needs_review: row.needs_review,
  };
}

/**
 * Supabase-backed implementation of ClosedJobRepository.
 *
 * The client is injected so callers (and tests) control its lifecycle.
 * Use createSupabaseClient() from supabaseClient.ts for production instances.
 */
export class SupabaseClosedJobRepository implements ClosedJobRepository {
  constructor(private readonly client: SupabaseClient) {}

  async save(job: NewClosedJob): Promise<SaveResult> {
    const { data, error } = await this.client
      .from(TABLE)
      .insert(job)
      .select()
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION_CODE) {
        return { ok: false, error: "DUPLICATE_SOURCE_MESSAGE_ID" };
      }
      throw new Error(`[SupabaseRepo] save failed: ${error.message}`);
    }

    return { ok: true, record: rowToRecord(data as ClosedJobRow) };
  }

  async findByDateRange(start: Date, end: Date): Promise<ClosedJobRecord[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    if (error) {
      throw new Error(`[SupabaseRepo] findByDateRange failed: ${error.message}`);
    }

    return (data as ClosedJobRow[]).map(rowToRecord);
  }

  async findBySourceMessageId(
    source_message_id: string
  ): Promise<ClosedJobRecord | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("source_message_id", source_message_id)
      .maybeSingle();

    if (error) {
      throw new Error(
        `[SupabaseRepo] findBySourceMessageId failed: ${error.message}`
      );
    }

    return data ? rowToRecord(data as ClosedJobRow) : null;
  }

  async listAll(): Promise<ClosedJobRecord[]> {
    const { data, error } = await this.client.from(TABLE).select("*");

    if (error) {
      throw new Error(`[SupabaseRepo] listAll failed: ${error.message}`);
    }

    return (data as ClosedJobRow[]).map(rowToRecord);
  }
}
