/**
 * Sample WhatsApp closed-job messages for local demo and testing.
 *
 * Covers: multiple technicians, multiple payment methods, decimal amounts,
 * and intentionally invalid messages that the parser must skip gracefully.
 *
 * In production these strings come from WhatsApp — not from this file.
 */
export const SAMPLE_MESSAGES: readonly string[] = [
  // ── Valid: John, Check ──────────────────────────────────────────────────────
  `Sunshine Home Services

Name: Steve Mcgee
Phone: (205) 999-9284
Address: 205 Fox Run Cir, Pell City, AL 35125
Job type: Dryer vent cleaning
Appointment Tuesday 02/06 @ 9am - 11am

John $250 check`,

  // ── Valid: Mike, Credit Card ────────────────────────────────────────────────
  `Sunshine Home Services

Name: Patricia Lane
Phone: (205) 555-0182
Address: 310 Oak St, Birmingham, AL 35201
Job type: AC service and tune-up
Appointment Wednesday 02/07 @ 1pm - 3pm

Mike 700 cc`,

  // ── Valid: Sara, Cash ────────────────────────────────────────────────────────
  `Sunshine Home Services

Name: Robert Tanner
Phone: (205) 444-7823
Address: 88 Maple Ave, Hoover, AL 35244
Job type: Plumbing inspection
Appointment Thursday 02/08 @ 10am - 12pm

Sara 150 cash`,

  // ── Valid: John, Zelle (second job — will be grouped with first John) ────────
  `Sunshine Home Services

Name: Diana Ford
Phone: (205) 333-6601
Address: 14 Birch Ln, Vestavia Hills, AL 35216
Job type: Carpet cleaning
Appointment Friday 02/09 @ 2pm - 4pm

John $300 zelle`,

  // ── Valid: Mike, Check (second job — grouped with first Mike) ───────────────
  `Sunshine Home Services

Name: Carlos Rivera
Phone: (205) 777-9900
Address: 52 Pine Rd, Trussville, AL 35173
Job type: HVAC maintenance
Appointment Saturday 02/10 @ 8am - 10am

Mike $450 check`,

  // ── Valid: Tom, Venmo, decimal amount ───────────────────────────────────────
  `Sunshine Home Services

Name: Linda Graves
Phone: (205) 222-5544
Address: 901 Elm St, Irondale, AL 35210
Job type: Appliance repair
Appointment Monday 02/12 @ 11am - 1pm

Tom $1250.50 venmo`,

  // ── Valid: Sara, Zelle (second job) ─────────────────────────────────────────
  `Sunshine Home Services

Name: Kevin Brooks
Phone: (205) 888-1122
Address: 76 Cedar Dr, Pelham, AL 35124
Job type: Gutter cleaning
Appointment Monday 02/12 @ 3pm - 5pm

Sara 200 zelle`,

  // ── INVALID: no sections (plain note, not a job message) ────────────────────
  `Hey just checking in, will send the report later`,

  // ── INVALID: closing line has unknown payment method ────────────────────────
  `Sunshine Home Services

Name: Ghost Customer
Phone: (205) 000-0000
Address: 1 Unknown Pl, Nowhere, AL 00000
Job type: Mystery service
Appointment Someday

John 999 crypto`,
];
