import "dotenv/config";
import WAWebJS from "whatsapp-web.js";
import { createWhatsAppClient } from "./whatsappClient";
import { createSupabaseClient } from "../db/supabaseClient";
import { SupabaseClosedJobRepository } from "../db/supabaseClosedJobRepository";
import { ClosedJobRepository } from "../db/closedJobRepository";
import {
  processIncomingMessages,
  IncomingMessage,
  ProcessResult,
} from "../pipeline/weeklyReportPipeline";

const TARGET_GROUP_ID = process.env.TARGET_WHATSAPP_GROUP_ID?.trim() ?? "";
const TARGET_GROUP_NAME = process.env.TARGET_WHATSAPP_GROUP_NAME?.trim() ?? "";

function matchesTargetGroup(chatId: string, chatName: string): boolean {
  if (TARGET_GROUP_ID) {
    return chatId === TARGET_GROUP_ID;
  }
  if (TARGET_GROUP_NAME) {
    return chatName.toLowerCase().includes(TARGET_GROUP_NAME.toLowerCase());
  }
  // No filter configured — accept all group messages
  return true;
}

function logProcessResult(result: ProcessResult, sourceMessageId: string): void {
  if (result.saved_count > 0) {
    console.log(`[Pipeline] Saved        | ID: ${sourceMessageId}`);
    return;
  }

  for (const dup of result.duplicate_messages) {
    console.log(`[Pipeline] Duplicate    | ID: ${dup.source_message_id}`);
  }

  for (const inv of result.invalid_messages) {
    console.warn(`[Pipeline] Invalid      | ID: ${inv.source_message_id} | Reason: ${inv.reason}`);
  }
}

async function handleMessage(
  message: WAWebJS.Message,
  repository: ClosedJobRepository
): Promise<void> {
  const body = message.body.trim();
  if (!body) return;

  const chat = await message.getChat();
  if (!chat.isGroup) return;
  if (!matchesTargetGroup(chat.id._serialized, chat.name)) return;

  const incoming: IncomingMessage = {
    source_message_id: message.id._serialized,
    raw_message: body,
  };

  const result = await processIncomingMessages([incoming], repository);

  logProcessResult(result, incoming.source_message_id);
}

async function main(): Promise<void> {
  console.log("[WhatsApp] Starting listener...");

  if (TARGET_GROUP_ID) {
    console.log(`[WhatsApp] Filtering by group ID   : ${TARGET_GROUP_ID}`);
  } else if (TARGET_GROUP_NAME) {
    console.log(`[WhatsApp] Filtering by group name : "${TARGET_GROUP_NAME}"`);
  } else {
    console.log("[WhatsApp] No group filter set — accepting all group messages.");
  }

  const supabaseClient = createSupabaseClient();
  const repository = new SupabaseClosedJobRepository(supabaseClient);

  console.log("[WhatsApp] Supabase repository initialized.");

  const client = createWhatsAppClient();

  client.on("message", async (message: WAWebJS.Message) => {
    try {
      await handleMessage(message, repository);
    } catch (err) {
      console.error("[Pipeline] Error processing message:", err);
    }
  });

  await client.initialize();
}

main().catch((err) => {
  console.error("[WhatsApp] Fatal startup error:", err);
  process.exit(1);
});
