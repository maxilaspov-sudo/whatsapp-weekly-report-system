import * as dotenv from "dotenv";
import { createSupabaseClient } from "./supabaseClient";
import { SupabaseClosedJobRepository } from "./supabaseClosedJobRepository";
import { NewClosedJob } from "./types";

dotenv.config();

const demoJob: NewClosedJob = {
  raw_message:
    "Job closed\nCustomer: Jane Demo\nPhone: 555-0100\nAddress: 1 Demo Street, Springfield\nService: AC Repair\nAppointment: 2026-06-09 10:00\nTechnician: Alex Tech\nAmount: $250\nPayment: check",
  company_id: "demo-company",
  whatsapp_group_id: "demo-group",
  company_name: "Demo Company",
  customer_name: "Jane Demo",
  phone: "555-0100",
  address: "1 Demo Street, Springfield",
  service: "AC Repair",
  appointment: "2026-06-09 10:00",
  technician_name: "Alex Tech",
  closed_amount: 250,
  payment_method: "check",
  source_message_id: "demo-" + Date.now(),
  needs_review: false,
};

async function main(): Promise<void> {
  const client = createSupabaseClient();
  const repo = new SupabaseClosedJobRepository(client);

  const result = await repo.save(demoJob);

  if (!result.ok) {
    console.error("Insert failed:", result.error);
    process.exit(1);
  }

  console.log("Inserted row id:", result.record.id);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
