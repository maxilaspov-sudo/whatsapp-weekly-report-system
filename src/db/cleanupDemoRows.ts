import * as dotenv from "dotenv";
dotenv.config();

import { createSupabaseClient } from "./supabaseClient";

const DEMO_COMPANY_ID = "demo-company";

interface DeletedRow {
  id: string;
}

async function main(): Promise<void> {
  const client = createSupabaseClient();

  const { data, error } = await client
    .from("closed_jobs")
    .delete()
    .eq("company_id", DEMO_COMPANY_ID)
    .select("id");

  if (error) {
    console.error("Cleanup failed:", error.message);
    process.exit(1);
  }

  const rows = data as DeletedRow[] | null;
  console.log(`Deleted ${rows?.length ?? 0} demo row(s).`);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
