/**
 * Abstraction for delivering formatted report text to a recipient.
 *
 * `recipient` is an opaque string — a label for console implementations,
 * a phone number for WhatsApp implementations. Callers supply it; the
 * sender implementation decides how to use it.
 *
 * Both methods are async so that network-backed implementations (e.g.
 * WhatsApp) satisfy the interface without wrapping.
 */
export interface ReportSender {
  sendMainReport(reportText: string, recipient: string): Promise<void>;
  sendTechnicianReport(
    reportText: string,
    technicianName: string,
    recipient: string
  ): Promise<void>;
}
