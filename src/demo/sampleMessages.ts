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
  `Example Service Company

Name: Demo Customer
Phone: (555) 000-0000
Address: 123 Demo Street, Demo City, FL 00000
Job type: Dryer vent cleaning
Appointment Tuesday 02/06 @ 9am - 11am

John $250 check`,

  // ── Valid: Mike, Credit Card ────────────────────────────────────────────────
  `Example Service Company

Name: Demo Customer 2
Phone: (555) 000-0002
Address: 456 Demo Avenue, Demo City, FL 00001
Job type: AC service and tune-up
Appointment Wednesday 02/07 @ 1pm - 3pm

Mike 700 cc`,

  // ── Valid: Sara, Cash ────────────────────────────────────────────────────────
  `Example Service Company

Name: Demo Customer 3
Phone: (555) 000-0003
Address: 789 Demo Boulevard, Demo City, FL 00002
Job type: Plumbing inspection
Appointment Thursday 02/08 @ 10am - 12pm

Sara 150 cash`,

  // ── Valid: John, Zelle (second job — will be grouped with first John) ────────
  `Example Service Company

Name: Demo Customer 4
Phone: (555) 000-0004
Address: 101 Demo Lane, Demo City, FL 00003
Job type: Carpet cleaning
Appointment Friday 02/09 @ 2pm - 4pm

John $300 zelle`,

  // ── Valid: Mike, Check (second job — grouped with first Mike) ───────────────
  `Example Service Company

Name: Demo Customer 5
Phone: (555) 000-0005
Address: 202 Demo Road, Demo City, FL 00004
Job type: HVAC maintenance
Appointment Saturday 02/10 @ 8am - 10am

Mike $450 check`,

  // ── Valid: Tom, Venmo, decimal amount ───────────────────────────────────────
  `Example Service Company

Name: Demo Customer 6
Phone: (555) 000-0006
Address: 303 Demo Circle, Demo City, FL 00005
Job type: Appliance repair
Appointment Monday 02/12 @ 11am - 1pm

Tom $1250.50 venmo`,

  // ── Valid: Sara, Zelle (second job) ─────────────────────────────────────────
  `Example Service Company

Name: Demo Customer 7
Phone: (555) 000-0007
Address: 404 Demo Drive, Demo City, FL 00006
Job type: Gutter cleaning
Appointment Monday 02/12 @ 3pm - 5pm

Sara 200 zelle`,

  // ── INVALID: no sections (plain note, not a job message) ────────────────────
  `Hey just checking in, will send the report later`,

  // ── INVALID: closing line has unknown payment method ────────────────────────
  `Example Service Company

Name: Demo Ghost
Phone: (555) 000-9999
Address: 1 Unknown Place, Demo Nowhere, FL 00000
Job type: Mystery service
Appointment Someday

John 999 crypto`,
];
