import { parseFullJobMessage, ParsedFullJobMessage } from "../parser/fullJobMessageParser";
import { generateWeeklyReport, WeeklyReport } from "../reports/weeklyReportGenerator";
import {
  formatMainWeeklyReport,
  formatTechnicianReport,
} from "../reports/reportFormatter";
import { SAMPLE_MESSAGES } from "./sampleMessages";

const SEPARATOR = "=".repeat(44);

export interface DemoResult {
  validJobs: ParsedFullJobMessage[];
  invalidMessages: Array<{ raw: string; reason: string }>;
  report: WeeklyReport;
  formattedMain: string;
  formattedTechnicianReports: string[];
}

export function buildDemoResult(messages: readonly string[]): DemoResult {
  const validJobs: ParsedFullJobMessage[] = [];
  const invalidMessages: Array<{ raw: string; reason: string }> = [];

  for (const raw of messages) {
    const result = parseFullJobMessage(raw);
    if (result.ok) {
      validJobs.push(result.data);
    } else {
      invalidMessages.push({ raw: result.error.raw_message, reason: result.error.reason });
    }
  }

  const report = generateWeeklyReport(validJobs);
  const formattedMain = formatMainWeeklyReport(report);
  const formattedTechnicianReports = report.technician_breakdown.map(formatTechnicianReport);

  return { validJobs, invalidMessages, report, formattedMain, formattedTechnicianReports };
}

export function printDemoResult(result: DemoResult): void {
  const { validJobs, invalidMessages, formattedMain, formattedTechnicianReports } = result;

  console.log(SEPARATOR);
  console.log("WEEKLY REPORT DEMO");
  console.log(SEPARATOR);
  console.log(
    `Parsed ${validJobs.length} valid job(s), ${invalidMessages.length} invalid message(s).`
  );

  if (invalidMessages.length > 0) {
    console.log("\nSkipped messages:");
    invalidMessages.forEach(({ raw, reason }, i) => {
      const preview = raw.length > 60 ? raw.slice(0, 57) + "..." : raw;
      console.log(`  [${i + 1}] ${reason}`);
      console.log(`       Raw: "${preview}"`);
    });
  }

  console.log(`\n${SEPARATOR}`);
  console.log("MAIN WEEKLY REPORT");
  console.log(SEPARATOR);
  console.log(formattedMain);

  formattedTechnicianReports.forEach((text, i) => {
    const name = result.report.technician_breakdown[i].technician_name;
    console.log(`\n${SEPARATOR}`);
    console.log(`TECHNICIAN REPORT: ${name}`);
    console.log(SEPARATOR);
    console.log(text);
  });

  console.log(`\n${SEPARATOR}`);
  console.log("DEMO COMPLETE");
  console.log(SEPARATOR);
}

export function runDemo(): void {
  const result = buildDemoResult(SAMPLE_MESSAGES);
  printDemoResult(result);
}

// Run only when executed directly (not when imported by tests)
if (require.main === module) {
  runDemo();
}
