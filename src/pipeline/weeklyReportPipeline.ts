import { parseFullJobMessage } from "../parser/fullJobMessageParser";
import { ClosedJobRepository } from "../db/closedJobRepository";
import { ClosedJobRecord, NewClosedJob } from "../db/types";
import { ParsedFullJobMessage } from "../parser/fullJobMessageParser";
import { generateWeeklyReport } from "../reports/weeklyReportGenerator";
import { formatMainWeeklyReport, formatTechnicianReport } from "../reports/reportFormatter";

export interface IncomingMessage {
  source_message_id: string;
  raw_message: string;
}

export interface InvalidMessageResult {
  source_message_id: string;
  raw_message: string;
  reason: string;
}

export interface DuplicateMessageResult {
  source_message_id: string;
  raw_message: string;
}

export interface ProcessResult {
  processed_count: number;
  saved_count: number;
  invalid_count: number;
  duplicate_count: number;
  invalid_messages: InvalidMessageResult[];
  duplicate_messages: DuplicateMessageResult[];
}

export interface TechnicianReportText {
  technician_name: string;
  text: string;
}

export interface FormattedWeeklyReports {
  main_report_text: string;
  technician_report_texts: TechnicianReportText[];
}

function recordToJobMessage(record: ClosedJobRecord): ParsedFullJobMessage {
  return {
    company_name: record.company_name,
    customer_name: record.customer_name,
    phone: record.phone,
    address: record.address,
    service: record.service,
    appointment: record.appointment,
    technician_name: record.technician_name,
    closed_amount: record.closed_amount,
    payment_method: record.payment_method,
    raw_message: record.raw_message,
  };
}

export async function processIncomingMessages(
  messages: IncomingMessage[],
  repository: ClosedJobRepository
): Promise<ProcessResult> {
  const invalid_messages: InvalidMessageResult[] = [];
  const duplicate_messages: DuplicateMessageResult[] = [];
  let saved_count = 0;

  for (const message of messages) {
    const parseResult = parseFullJobMessage(message.raw_message);

    if (!parseResult.ok) {
      invalid_messages.push({
        source_message_id: message.source_message_id,
        raw_message: message.raw_message,
        reason: parseResult.error.reason,
      });
      continue;
    }

    const newJob: NewClosedJob = {
      ...parseResult.data,
      source_message_id: message.source_message_id,
      needs_review: false,
    };

    const saveResult = await repository.save(newJob);

    if (!saveResult.ok) {
      duplicate_messages.push({
        source_message_id: message.source_message_id,
        raw_message: message.raw_message,
      });
    } else {
      saved_count++;
    }
  }

  return {
    processed_count: messages.length,
    saved_count,
    invalid_count: invalid_messages.length,
    duplicate_count: duplicate_messages.length,
    invalid_messages,
    duplicate_messages,
  };
}

export async function generateFormattedWeeklyReports(
  repository: ClosedJobRepository,
  startDate: Date,
  endDate: Date
): Promise<FormattedWeeklyReports> {
  const records = await repository.findByDateRange(startDate, endDate);
  const jobs = records.map(recordToJobMessage);
  const weeklyReport = generateWeeklyReport(jobs);

  const main_report_text = formatMainWeeklyReport(weeklyReport);
  const technician_report_texts: TechnicianReportText[] = weeklyReport.technician_breakdown.map(
    (techReport) => ({
      technician_name: techReport.technician_name,
      text: formatTechnicianReport(techReport),
    })
  );

  return {
    main_report_text,
    technician_report_texts,
  };
}
