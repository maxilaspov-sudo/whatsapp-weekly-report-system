import * as dotenv from "dotenv";
dotenv.config();

import { createSupabaseClient } from "../db/supabaseClient";

interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

function checkEnvVar(name: string): CheckResult {
  const val = process.env[name]?.trim();
  return {
    name: `Env: ${name}`,
    passed: Boolean(val),
    detail: val ? undefined : "not set",
  };
}

async function checkSupabaseTable(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  try {
    const client = createSupabaseClient();
    const { count, error } = await client
      .from("closed_jobs")
      .select("*", { count: "exact", head: true });

    if (error) {
      results.push({ name: "Supabase: connection", passed: false, detail: error.message });
      results.push({ name: "Supabase: closed_jobs table", passed: false, detail: error.message });
    } else {
      results.push({ name: "Supabase: connection", passed: true });
      results.push({
        name: "Supabase: closed_jobs table",
        passed: true,
        detail: `${count ?? 0} rows`,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    results.push({ name: "Supabase: connection", passed: false, detail: msg });
    results.push({ name: "Supabase: closed_jobs table", passed: false, detail: "skipped" });
  }

  return results;
}

function printResults(results: CheckResult[]): void {
  const maxLen = Math.max(...results.map((r) => r.name.length));
  let failed = 0;

  for (const r of results) {
    const status = r.passed ? "PASS" : "FAIL";
    const pad = " ".repeat(maxLen - r.name.length + 2);
    const detail = r.detail ? `  (${r.detail})` : "";
    console.log(`[${status}]  ${r.name}${pad}${detail}`);
    if (!r.passed) failed++;
  }

  console.log("");
  console.log(`${results.length - failed} passed, ${failed} failed`);

  if (failed > 0) process.exit(1);
}

async function main(): Promise<void> {
  console.log("=== System Health Check ===\n");

  const envChecks: CheckResult[] = [
    checkEnvVar("SUPABASE_URL"),
    checkEnvVar("SUPABASE_SERVICE_ROLE_KEY"),
    checkEnvVar("GROUP_REGISTRY"),
    checkEnvVar("GROUP_ADMINS"),
  ];

  const supabaseReady = envChecks[0].passed && envChecks[1].passed;

  const supabaseChecks = supabaseReady
    ? await checkSupabaseTable()
    : [
        { name: "Supabase: connection", passed: false, detail: "skipped (missing env vars)" },
        { name: "Supabase: closed_jobs table", passed: false, detail: "skipped (missing env vars)" },
      ];

  printResults([...envChecks, ...supabaseChecks]);
}

main().catch((err: unknown) => {
  console.error("Health check error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
