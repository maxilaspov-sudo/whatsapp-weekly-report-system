import { ClosedJobRecord, NewClosedJob, SaveResult } from "./types";

/**
 * Repository interface for closed job persistence.
 *
 * All methods are async so that any concrete implementation — in-memory,
 * Supabase, or other — satisfies the same contract without changes to callers.
 */
export interface ClosedJobRepository {
  /**
   * Persists a new closed job.
   * Returns DUPLICATE_SOURCE_MESSAGE_ID if the source_message_id already exists.
   */
  save(job: NewClosedJob): Promise<SaveResult>;

  /**
   * Returns all records whose created_at falls within [start, end] inclusive.
   */
  findByDateRange(start: Date, end: Date): Promise<ClosedJobRecord[]>;

  /**
   * Returns records whose created_at falls within [start, end] inclusive,
   * scoped to a single WhatsApp group.
   *
   * This is the required query for all report generation — it prevents jobs
   * from one group from appearing in another group's report.
   */
  findByDateRangeForGroup(
    start: Date,
    end: Date,
    whatsapp_group_id: string
  ): Promise<ClosedJobRecord[]>;

  /**
   * Returns the record matching the given source_message_id, or null if not found.
   */
  findBySourceMessageId(source_message_id: string): Promise<ClosedJobRecord | null>;

  /**
   * Returns every record in the repository, in insertion order.
   */
  listAll(): Promise<ClosedJobRecord[]>;
}
