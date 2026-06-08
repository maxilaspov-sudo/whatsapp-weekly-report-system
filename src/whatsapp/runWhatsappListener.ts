import "dotenv/config";
import WAWebJS from "whatsapp-web.js";
import { createWhatsAppClient } from "./whatsappClient";

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

async function handleMessage(message: WAWebJS.Message): Promise<void> {
  const body = message.body.trim();
  if (!body) return;

  const chat = await message.getChat();
  if (!chat.isGroup) return;
  if (!matchesTargetGroup(chat.id._serialized, chat.name)) return;

  const sender = message.author ?? message.from;

  console.log("─".repeat(50));
  console.log(`source_message_id : ${message.id._serialized}`);
  console.log(`chat_id           : ${chat.id._serialized}`);
  console.log(`chat_name         : ${chat.name}`);
  console.log(`sender            : ${sender}`);
  console.log(`body              :\n${body}`);
}

async function main(): Promise<void> {
  console.log("[WhatsApp] Starting listener...");

  if (TARGET_GROUP_ID) {
    console.log(`[WhatsApp] Filtering by group ID : ${TARGET_GROUP_ID}`);
  } else if (TARGET_GROUP_NAME) {
    console.log(`[WhatsApp] Filtering by group name: "${TARGET_GROUP_NAME}"`);
  } else {
    console.log("[WhatsApp] No group filter set — logging all group messages.");
  }

  const client = createWhatsAppClient();

  client.on("message", async (message: WAWebJS.Message) => {
    try {
      await handleMessage(message);
    } catch (err) {
      console.error("[WhatsApp] Error handling message:", err);
    }
  });

  await client.initialize();
}

main().catch((err) => {
  console.error("[WhatsApp] Fatal startup error:", err);
  process.exit(1);
});
