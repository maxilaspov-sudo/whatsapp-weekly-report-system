import WAWebJS from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

/**
 * Creates a fully configured WhatsApp Web client.
 *
 * LocalAuth persists the session to disk so the QR code only needs to be
 * scanned once. Subsequent starts reuse the saved credentials.
 *
 * The caller is responsible for registering application-level event handlers
 * (e.g. 'message') and calling client.initialize().
 */
export function createWhatsAppClient(): WAWebJS.Client {
  const client = new WAWebJS.Client({
    authStrategy: new WAWebJS.LocalAuth(),
    puppeteer: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr: string) => {
    console.log("[WhatsApp] Scan the QR code below to connect:");
    qrcode.generate(qr, { small: true });
  });

  client.on("authenticated", () => {
    console.log("[WhatsApp] Authenticated.");
  });

  client.on("auth_failure", (message: string) => {
    console.error("[WhatsApp] Authentication failed:", message);
  });

  client.on("ready", () => {
    console.log("[WhatsApp] Client is ready.");
  });

  client.on("disconnected", (reason: string) => {
    console.warn("[WhatsApp] Disconnected:", reason);
  });

  return client;
}
