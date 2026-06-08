import { parseJobMessage } from "./jobMessageParser";

export interface ParsedFullJobMessage {
  company_name: string;
  customer_name: string;
  phone: string;
  address: string;
  service: string;
  appointment: string;
  technician_name: string;
  closed_amount: number;
  payment_method: string;
  raw_message: string;
}

export type FullParseResult =
  | { ok: true; data: ParsedFullJobMessage }
  | { ok: false; error: { raw_message: string; reason: string } };

// Maps the lowercased label (before the colon) to the output field name.
// Add new label aliases here as message formats vary across companies.
const LABEL_TO_FIELD: Record<string, keyof ParsedFullJobMessage> = {
  name: "customer_name",
  phone: "phone",
  address: "address",
  "job type": "service",
};

const REQUIRED_FIELDS: Array<keyof ParsedFullJobMessage> = [
  "customer_name",
  "phone",
  "address",
  "service",
  "appointment",
];

/**
 * Parses a full closed-job WhatsApp message.
 *
 * Expected structure (sections separated by blank lines):
 *
 *   <Company Name>
 *
 *   Name: <customer>
 *   Phone: <phone>
 *   Address: <address>
 *   Job type: <service>
 *   Appointment <date/time>
 *
 *   <technician> [$]<amount> <payment method>
 */
export function parseFullJobMessage(raw: string): FullParseResult {
  const message = raw.trim();

  // Split on one or more blank lines (lines that are empty or only whitespace)
  const sections = message
    .split(/\n[ \t]*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sections.length < 3) {
    return {
      ok: false,
      error: {
        raw_message: message,
        reason: `Expected 3 sections (company name, info block, closing line), got ${sections.length}`,
      },
    };
  }

  // First section — first line is the company name
  const company_name = sections[0].split("\n")[0].trim();

  // Last section — closing line handled by the existing single-line parser
  const closingLine = sections[sections.length - 1];
  const closingResult = parseJobMessage(closingLine);
  if (!closingResult.ok) {
    return {
      ok: false,
      error: {
        raw_message: message,
        reason: `Closing line: ${closingResult.error.reason}`,
      },
    };
  }

  // Middle sections — info block (handles edge case of extra blank lines inside)
  const infoLines = sections
    .slice(1, -1)
    .join("\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const fields: Partial<Record<keyof ParsedFullJobMessage, string>> = {};

  for (const line of infoLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx !== -1) {
      const label = line.slice(0, colonIdx).trim().toLowerCase();
      const value = line.slice(colonIdx + 1).trim();
      const fieldName = LABEL_TO_FIELD[label];
      if (fieldName) {
        fields[fieldName] = value;
      }
      // Unknown labeled fields are ignored — forward-compatible with new message formats
    } else if (line.toLowerCase().startsWith("appointment")) {
      // "Appointment" has no colon in this message format
      fields.appointment = line.slice("appointment".length).trim();
    }
  }

  for (const field of REQUIRED_FIELDS) {
    if (!fields[field]) {
      return {
        ok: false,
        error: {
          raw_message: message,
          reason: `Missing required field: ${field}`,
        },
      };
    }
  }

  return {
    ok: true,
    data: {
      company_name,
      customer_name: fields.customer_name as string,
      phone: fields.phone as string,
      address: fields.address as string,
      service: fields.service as string,
      appointment: fields.appointment as string,
      technician_name: closingResult.data.technician_name,
      closed_amount: closingResult.data.closed_amount,
      payment_method: closingResult.data.payment_method,
      raw_message: message,
    },
  };
}
