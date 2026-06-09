import { randomUUID } from "crypto";
import { ClosedJobRecord, NewClosedJob, SaveResult } from "./types";
import { ClosedJobRepository } from "./closedJobRepository";

/**
 * In-memory repository for use in tests and local demos.
 * Not suitable for production — data is lost when the process exits.
 *
 * The optional `clock` parameter lets tests control `created_at` timestamps
 * without patching globals or sleeping between saves.
 */
export class InMemoryClosedJobRepository implements ClosedJobRepository {
  private readonly store = new Map<string, ClosedJobRecord>();
  private readonly clock: () => Date;

  constructor(clock: () => Date = () => new Date()) {
    this.clock = clock;
  }

  async save(job: NewClosedJob): Promise<SaveResult> {
    if (this.store.has(job.source_message_id)) {
      return { ok: false, error: "DUPLICATE_SOURCE_MESSAGE_ID" };
    }

    const record: ClosedJobRecord = {
      ...job,
      id: randomUUID(),
      created_at: this.clock(),
    };

    this.store.set(job.source_message_id, record);
    return { ok: true, record };
  }

  async findByDateRange(start: Date, end: Date): Promise<ClosedJobRecord[]> {
    return Array.from(this.store.values()).filter(
      (r) => r.created_at >= start && r.created_at <= end
    );
  }

  async findByDateRangeForGroup(
    start: Date,
    end: Date,
    whatsapp_group_id: string
  ): Promise<ClosedJobRecord[]> {
    return Array.from(this.store.values()).filter(
      (r) =>
        r.created_at >= start &&
        r.created_at <= end &&
        r.whatsapp_group_id === whatsapp_group_id
    );
  }

  async findBySourceMessageId(source_message_id: string): Promise<ClosedJobRecord | null> {
    return this.store.get(source_message_id) ?? null;
  }

  async listAll(): Promise<ClosedJobRecord[]> {
    return Array.from(this.store.values());
  }
}
