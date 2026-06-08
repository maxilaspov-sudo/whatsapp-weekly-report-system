import { ParsedFullJobMessage } from "../parser/fullJobMessageParser";

export type PaymentBreakdown = Record<string, number>;

export interface TechnicianReport {
  technician_name: string;
  total_jobs: number;
  total_amount: number;
  payment_method_breakdown: PaymentBreakdown;
  jobs: ParsedFullJobMessage[];
}

export interface WeeklyReport {
  total_jobs: number;
  total_gross_amount: number;
  technician_breakdown: TechnicianReport[];
  payment_method_breakdown: PaymentBreakdown;
  all_jobs: ParsedFullJobMessage[];
}

function isValidJob(job: ParsedFullJobMessage): boolean {
  return (
    job.technician_name.trim().length > 0 &&
    job.closed_amount > 0 &&
    job.payment_method.trim().length > 0
  );
}

function addToBreakdown(breakdown: PaymentBreakdown, method: string, amount: number): void {
  breakdown[method] = (breakdown[method] ?? 0) + amount;
}

function buildTechnicianReport(
  name: string,
  jobs: ParsedFullJobMessage[]
): TechnicianReport {
  const payment_method_breakdown: PaymentBreakdown = {};
  let total_amount = 0;

  for (const job of jobs) {
    total_amount += job.closed_amount;
    addToBreakdown(payment_method_breakdown, job.payment_method, job.closed_amount);
  }

  return {
    technician_name: name,
    total_jobs: jobs.length,
    total_amount,
    payment_method_breakdown,
    jobs,
  };
}

/**
 * Generates a weekly report from an array of parsed closed-job messages.
 *
 * Jobs that fail validation (zero/negative amount, empty technician name,
 * empty payment method) are silently skipped so one bad message cannot
 * corrupt the entire week's report.
 */
export function generateWeeklyReport(jobs: ParsedFullJobMessage[]): WeeklyReport {
  const validJobs = jobs.filter(isValidJob);

  // Group valid jobs by technician, preserving insertion order
  const byTechnician = new Map<string, ParsedFullJobMessage[]>();
  for (const job of validJobs) {
    const bucket = byTechnician.get(job.technician_name) ?? [];
    bucket.push(job);
    byTechnician.set(job.technician_name, bucket);
  }

  const payment_method_breakdown: PaymentBreakdown = {};
  const technician_breakdown: TechnicianReport[] = [];

  for (const [name, techJobs] of byTechnician) {
    const report = buildTechnicianReport(name, techJobs);
    technician_breakdown.push(report);

    for (const [method, amount] of Object.entries(report.payment_method_breakdown)) {
      addToBreakdown(payment_method_breakdown, method, amount);
    }
  }

  const total_gross_amount = validJobs.reduce((sum, j) => sum + j.closed_amount, 0);

  return {
    total_jobs: validJobs.length,
    total_gross_amount,
    technician_breakdown,
    payment_method_breakdown,
    all_jobs: validJobs,
  };
}
