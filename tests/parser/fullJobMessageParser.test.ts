import {
  parseFullJobMessage,
  ParsedFullJobMessage,
} from "../../src/parser/fullJobMessageParser";

// ─── helpers ────────────────────────────────────────────────────────────────

function expectOk(result: ReturnType<typeof parseFullJobMessage>): ParsedFullJobMessage {
  if (!result.ok) {
    throw new Error(`Expected parse to succeed but got error: ${result.error.reason}`);
  }
  return result.data;
}

function expectFail(result: ReturnType<typeof parseFullJobMessage>): string {
  if (result.ok) {
    throw new Error(`Expected parse to fail but got: ${JSON.stringify(result.data)}`);
  }
  return result.error.reason;
}

// ─── canonical demo example ──────────────────────────────────────────────────

const FULL_MESSAGE = `Example Service Company

Name: Demo Customer
Phone: (555) 000-0000
Address: 123 Demo Street, Demo City, FL 00000
Job type: Dryer vent cleaning
Appointment Tuesday 02/06 @ 9am -11am

DemoTech $250 check`;

describe("parseFullJobMessage — canonical demo example", () => {
  let data: ParsedFullJobMessage;

  beforeAll(() => {
    data = expectOk(parseFullJobMessage(FULL_MESSAGE));
  });

  test("company_name", () => expect(data.company_name).toBe("Example Service Company"));
  test("customer_name", () => expect(data.customer_name).toBe("Demo Customer"));
  test("phone", () => expect(data.phone).toBe("(555) 000-0000"));
  test("address", () => expect(data.address).toBe("123 Demo Street, Demo City, FL 00000"));
  test("service", () => expect(data.service).toBe("Dryer vent cleaning"));
  test("appointment", () => expect(data.appointment).toBe("Tuesday 02/06 @ 9am -11am"));
  test("technician_name", () => expect(data.technician_name).toBe("DemoTech"));
  test("closed_amount", () => expect(data.closed_amount).toBe(250));
  test("payment_method", () => expect(data.payment_method).toBe("Check"));
  test("raw_message is preserved", () => expect(data.raw_message).toBe(FULL_MESSAGE.trim()));
});

// ─── closing line variations ─────────────────────────────────────────────────

describe("parseFullJobMessage — closing line variations", () => {
  function makeMessage(closingLine: string): string {
    return `Example Service Company\n\nName: Demo Customer\nPhone: (555) 000-0000\nAddress: 123 Demo Street\nJob type: Dryer vent cleaning\nAppointment Tuesday 02/06 @ 9am\n\n${closingLine}`;
  }

  test("no dollar sign", () => {
    const data = expectOk(parseFullJobMessage(makeMessage("Mike 700 cc")));
    expect(data.technician_name).toBe("Mike");
    expect(data.closed_amount).toBe(700);
    expect(data.payment_method).toBe("Credit Card");
  });

  test("cash payment", () => {
    const data = expectOk(parseFullJobMessage(makeMessage("Sara 150 cash")));
    expect(data.payment_method).toBe("Cash");
  });

  test("zelle payment", () => {
    const data = expectOk(parseFullJobMessage(makeMessage("Tom 300 zelle")));
    expect(data.payment_method).toBe("Zelle");
  });
});

// ─── label parsing ───────────────────────────────────────────────────────────

describe("parseFullJobMessage — label parsing", () => {
  test("labels are case-insensitive", () => {
    const msg = `ACME Co\n\nNAME: Alice\nPHONE: 555-1234\nADDRESS: 1 Main St\nJOB TYPE: AC Repair\nAppointment Monday\n\nJohn 100 cash`;
    const data = expectOk(parseFullJobMessage(msg));
    expect(data.customer_name).toBe("Alice");
    expect(data.service).toBe("AC Repair");
  });

  test("unknown labeled fields are ignored", () => {
    const msg = `ACME Co\n\nName: Alice\nPhone: 555-1234\nAddress: 1 Main St\nJob type: AC Repair\nNote: Bring ladder\nAppointment Monday\n\nJohn 100 cash`;
    const data = expectOk(parseFullJobMessage(msg));
    expect(data.customer_name).toBe("Alice");
  });

  test("appointment value captures full date/time string", () => {
    const msg = `ACME Co\n\nName: Alice\nPhone: 555-1234\nAddress: 1 Main St\nJob type: AC Repair\nAppointment Wednesday 03/15 @ 2pm - 4pm\n\nJohn 100 cash`;
    const data = expectOk(parseFullJobMessage(msg));
    expect(data.appointment).toBe("Wednesday 03/15 @ 2pm - 4pm");
  });
});

// ─── error cases ─────────────────────────────────────────────────────────────

describe("parseFullJobMessage — error cases", () => {
  test("fewer than 3 sections", () => {
    const reason = expectFail(parseFullJobMessage("Just one line"));
    expect(reason).toMatch(/3 sections/);
  });

  test("missing Name field", () => {
    const msg = `ACME Co\n\nPhone: 555-1234\nAddress: 1 Main St\nJob type: AC Repair\nAppointment Monday\n\nJohn 100 cash`;
    const reason = expectFail(parseFullJobMessage(msg));
    expect(reason).toMatch(/customer_name/);
  });

  test("missing Appointment line", () => {
    const msg = `ACME Co\n\nName: Alice\nPhone: 555-1234\nAddress: 1 Main St\nJob type: AC Repair\n\nJohn 100 cash`;
    const reason = expectFail(parseFullJobMessage(msg));
    expect(reason).toMatch(/appointment/);
  });

  test("bad closing line propagates inner error", () => {
    const msg = `ACME Co\n\nName: Alice\nPhone: 555-1234\nAddress: 1 Main St\nJob type: AC Repair\nAppointment Monday\n\nJohn 100 bitcoin`;
    const reason = expectFail(parseFullJobMessage(msg));
    expect(reason).toMatch(/payment method/i);
  });

  test("raw_message is preserved on error", () => {
    const msg = "bad\ninput";
    const result = parseFullJobMessage(msg);
    if (result.ok) throw new Error("should fail");
    expect(result.error.raw_message).toBe("bad\ninput");
  });
});
