import { parseJobMessage, ParsedJobMessage } from "../../src/parser/jobMessageParser";

function expectOk(result: ReturnType<typeof parseJobMessage>): ParsedJobMessage {
  if (!result.ok) {
    throw new Error(`Expected parse to succeed but got error: ${result.error.reason}`);
  }
  return result.data;
}

function expectFail(result: ReturnType<typeof parseJobMessage>): string {
  if (result.ok) {
    throw new Error(`Expected parse to fail but got: ${JSON.stringify(result.data)}`);
  }
  return result.error.reason;
}

describe("parseJobMessage — CLAUDE.md examples", () => {
  test("John $250 check", () => {
    const data = expectOk(parseJobMessage("John $250 check"));
    expect(data.technician_name).toBe("John");
    expect(data.closed_amount).toBe(250);
    expect(data.payment_method).toBe("Check");
    expect(data.raw_message).toBe("John $250 check");
  });

  test("Mike 700 cc", () => {
    const data = expectOk(parseJobMessage("Mike 700 cc"));
    expect(data.technician_name).toBe("Mike");
    expect(data.closed_amount).toBe(700);
    expect(data.payment_method).toBe("Credit Card");
    expect(data.raw_message).toBe("Mike 700 cc");
  });
});

describe("parseJobMessage — payment method aliases", () => {
  test("chk alias → Check", () => {
    const data = expectOk(parseJobMessage("Sara 100 chk"));
    expect(data.payment_method).toBe("Check");
  });

  test("ck alias → Check", () => {
    const data = expectOk(parseJobMessage("Sara 100 ck"));
    expect(data.payment_method).toBe("Check");
  });

  test("credit alias → Credit Card", () => {
    const data = expectOk(parseJobMessage("Sara 100 credit"));
    expect(data.payment_method).toBe("Credit Card");
  });

  test("credit card (multi-word) → Credit Card", () => {
    const data = expectOk(parseJobMessage("Sara 100 credit card"));
    expect(data.payment_method).toBe("Credit Card");
  });

  test("cash → Cash", () => {
    const data = expectOk(parseJobMessage("Sara 100 cash"));
    expect(data.payment_method).toBe("Cash");
  });

  test("zelle → Zelle", () => {
    const data = expectOk(parseJobMessage("Sara 100 zelle"));
    expect(data.payment_method).toBe("Zelle");
  });

  test("payment method matching is case-insensitive", () => {
    const data = expectOk(parseJobMessage("Sara 100 CHECK"));
    expect(data.payment_method).toBe("Check");
  });
});

describe("parseJobMessage — amount parsing", () => {
  test("dollar sign prefix is stripped", () => {
    const data = expectOk(parseJobMessage("John $500 cash"));
    expect(data.closed_amount).toBe(500);
  });

  test("decimal amounts are preserved", () => {
    const data = expectOk(parseJobMessage("John 99.50 cash"));
    expect(data.closed_amount).toBe(99.5);
  });

  test("extra whitespace is handled", () => {
    const data = expectOk(parseJobMessage("  John   250   cash  "));
    expect(data.technician_name).toBe("John");
    expect(data.closed_amount).toBe(250);
    expect(data.payment_method).toBe("Cash");
  });
});

describe("parseJobMessage — error cases", () => {
  test("too few tokens", () => {
    const reason = expectFail(parseJobMessage("John 250"));
    expect(reason).toMatch(/3 tokens/);
  });

  test("non-numeric amount", () => {
    const reason = expectFail(parseJobMessage("John abc cash"));
    expect(reason).toMatch(/amount/i);
  });

  test("unknown payment method", () => {
    const reason = expectFail(parseJobMessage("John 250 bitcoin"));
    expect(reason).toMatch(/payment method/i);
  });

  test("raw_message preserved on error", () => {
    const result = parseJobMessage("bad input");
    if (result.ok) throw new Error("should fail");
    expect(result.error.raw_message).toBe("bad input");
  });
});
