export interface ParsedJobMessage {
  technician_name: string;
  closed_amount: number;
  payment_method: string;
  raw_message: string;
}

export interface ParseError {
  raw_message: string;
  reason: string;
}

export type ParseResult =
  | { ok: true; data: ParsedJobMessage }
  | { ok: false; error: ParseError };

// Maps lowercase aliases to canonical payment method names.
// Add new aliases here as more companies/technicians are onboarded.
const PAYMENT_METHOD_MAP: Record<string, string> = {
  check: "Check",
  chk: "Check",
  ck: "Check",
  cc: "Credit Card",
  "credit card": "Credit Card",
  credit: "Credit Card",
  cash: "Cash",
  zelle: "Zelle",
  venmo: "Venmo",
  ach: "ACH",
  wire: "Wire",
};

function resolvePaymentMethod(raw: string): string | null {
  return PAYMENT_METHOD_MAP[raw.toLowerCase()] ?? null;
}

/**
 * Parses a single closed-job WhatsApp message.
 *
 * Expected format (flexible):
 *   <TechnicianName> [$]<Amount> <PaymentMethodAlias>
 *
 * Examples:
 *   "John $250 check"  → { technician_name: "John", closed_amount: 250, payment_method: "Check" }
 *   "Mike 700 cc"      → { technician_name: "Mike", closed_amount: 700, payment_method: "Credit Card" }
 */
export function parseJobMessage(raw: string): ParseResult {
  const message = raw.trim();

  // Tokenize: split on whitespace, collapse multiple spaces
  const tokens = message.split(/\s+/);

  if (tokens.length < 3) {
    return {
      ok: false,
      error: {
        raw_message: message,
        reason: `Expected at least 3 tokens (name, amount, payment method), got ${tokens.length}`,
      },
    };
  }

  const [nameToken, amountToken, ...rest] = tokens;

  // Strip leading $ and parse amount
  const amountStr = amountToken.replace(/^\$/, "");
  const closed_amount = parseFloat(amountStr);

  if (isNaN(closed_amount) || closed_amount < 0) {
    return {
      ok: false,
      error: {
        raw_message: message,
        reason: `Could not parse amount from "${amountToken}"`,
      },
    };
  }

  // Payment method may be multi-word (e.g. "credit card"), join remaining tokens
  const paymentRaw = rest.join(" ");
  const payment_method = resolvePaymentMethod(paymentRaw);

  if (payment_method === null) {
    return {
      ok: false,
      error: {
        raw_message: message,
        reason: `Unknown payment method "${paymentRaw}"`,
      },
    };
  }

  return {
    ok: true,
    data: {
      technician_name: nameToken,
      closed_amount,
      payment_method,
      raw_message: message,
    },
  };
}
