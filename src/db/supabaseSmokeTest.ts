import * as dotenv from "dotenv";
dotenv.config();

import { createSupabaseClient } from "./supabaseClient";
import { SupabaseClosedJobRepository } from "./supabaseClosedJobRepository";
import { NewClosedJob } from "./types";

const SMOKE_ID = `smoke-test-${Date.now()}`;

const fakeJob: NewClosedJob = {
  raw_message: "[SMOKE TEST] This row was inserted by supabaseSmokeTest.ts and should be deleted automatically.",
  company_id: "smoke-company",
  whatsapp_group_id: "smoke-group",
  company_name: "Smoke Test Co",
  customer_name: "Test Customer",
  phone: "0000000000",
  address: "1 Test Street",
  service: "Smoke Test Service",
  appointment: "2099-01-01 10:00",
  technician_name: "Smoke Bot",
  closed_amount: 1,
  payment_method: "check",
  source_message_id: SMOKE_ID,
  needs_review: false,
};

async function run(): Promise<void> {
  const client = createSupabaseClient();
  const repo = new SupabaseClosedJobRepository(client);

  // 1. Insert
  console.log(`[smoke] Inserting row with source_message_id="${SMOKE_ID}" ...`);
  const saveResult = await repo.save(fakeJob);

  if (!saveResult.ok) {
    throw new Error(`[smoke] Insert failed: ${saveResult.error}`);
  }

  const inserted = saveResult.record;
  console.log(`[smoke] Insert OK — id=${inserted.id}`);

  // 2. Read back
  console.log("[smoke] Reading row back by source_message_id ...");
  const found = await repo.findBySourceMessageId(SMOKE_ID);

  if (!found) {
    throw new Error("[smoke] Read-back failed: row not found after insert");
  }

  if (found.id !== inserted.id) {
    throw new Error(
      `[smoke] Read-back mismatch: expected id=${inserted.id}, got id=${found.id}`
    );
  }

  console.log(`[smoke] Read-back OK — company_name="${found.company_name}", closed_amount=${found.closed_amount}`);

  // 3. Delete
  console.log("[smoke] Deleting test row ...");
  const { error: deleteError } = await client
    .from("closed_jobs")
    .delete()
    .eq("id", inserted.id);

  if (deleteError) {
    console.warn(`[smoke] WARNING: Could not delete test row (id=${inserted.id}): ${deleteError.message}`);
    console.warn("[smoke] You may need to delete it manually from the Supabase dashboard.");
  } else {
    console.log("[smoke] Delete OK — test row removed.");
  }

  console.log("[smoke] Smoke test PASSED.");
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[smoke] FAILED: ${message}`);
  process.exit(1);
});
