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
import { parseCommand } from "../commands/commandParser";
import { CommandHandler } from "../commands/commandHandler";
import { lookupGroup, GroupConfig } from "../config/groupRegistry";

const UNREGISTERED_GROUP_MESSAGE =
  "Group is not registered. Please configure this group first.";

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

function getOrCreateHandler(
  groupHandlers: Map<string, CommandHandler>,
  groupId: string,
  groupConfig: GroupConfig,
  repository: ClosedJobRepository
): CommandHandler {
  const existing = groupHandlers.get(groupId);
  if (existing) return existing;

  const handler = new CommandHandler({
    repository,
    repositoryType: "supabase",
    whatsapp_group_id: groupId,
    company_id: groupConfig.company_id,
    getNow: () => new Date(),
  });
  groupHandlers.set(groupId, handler);
  console.log(`[WhatsApp] Handler created for group ${groupId} (company: ${groupConfig.company_id})`);
  return handler;
}

async function handleCommand(
  message: WAWebJS.Message,
  commandHandler: CommandHandler
): Promise<void> {
  const body = message.body.trim();
  const sourceId = message.id._serialized;
  const parsed = parseCommand(body);

  if (!parsed) return;

  console.log(`[Command] Received  : .${parsed.command} | ID: ${sourceId}`);

  const prevActive = commandHandler.isActive();
  const response = await commandHandler.handle(parsed);
  const nowActive = commandHandler.isActive();

  if (prevActive !== nowActive) {
    console.log(`[WhatsApp] Processing ${nowActive ? "ACTIVATED" : "DEACTIVATED"} | Group: ${message.id.remote}`);
  }

  try {
    await message.reply(response);
    console.log(`[Command] Response sent | ID: ${sourceId}`);
  } catch (replyErr) {
    console.error(`[Command] Reply failed  | ID: ${sourceId}`, replyErr);
  }
}

async function handleJobMessage(
  message: WAWebJS.Message,
  repository: ClosedJobRepository,
  company_id: string,
  whatsapp_group_id: string
): Promise<void> {
  const body = message.body.trim();
  const sourceId = message.id._serialized;

  const incoming: IncomingMessage = {
    source_message_id: sourceId,
    raw_message: body,
    company_id,
    whatsapp_group_id,
  };

  const result = await processIncomingMessages([incoming], repository);
  logProcessResult(result, incoming.source_message_id);
}

async function handleMessage(
  message: WAWebJS.Message,
  repository: ClosedJobRepository,
  groupHandlers: Map<string, CommandHandler>
): Promise<void> {
  const body = message.body.trim();
  if (!body) return;

  const chat = await message.getChat();
  if (!chat.isGroup) return;

  const groupId = chat.id._serialized;
  const groupConfig = lookupGroup(groupId);
  const parsed = parseCommand(body);

  if (parsed !== null) {
    if (!groupConfig) {
      try {
        await message.reply(UNREGISTERED_GROUP_MESSAGE);
      } catch (replyErr) {
        console.error(`[Command] Reply failed for unregistered group ${groupId}`, replyErr);
      }
      console.warn(`[WhatsApp] Command from unregistered group: ${groupId}`);
      return;
    }

    const handler = getOrCreateHandler(groupHandlers, groupId, groupConfig, repository);
    await handleCommand(message, handler);
    return;
  }

  if (!groupConfig) {
    // Silently ignore job messages from unregistered groups
    return;
  }

  const handler = getOrCreateHandler(groupHandlers, groupId, groupConfig, repository);
  if (!handler.isActive()) {
    return;
  }

  await handleJobMessage(message, repository, groupConfig.company_id, groupId);
}

async function main(): Promise<void> {
  console.log("[WhatsApp] Starting listener...");

  const registryEnv = process.env.GROUP_REGISTRY?.trim() ?? "";
  if (!registryEnv) {
    console.warn(
      "[WhatsApp] GROUP_REGISTRY is not set. No groups are registered — all messages will be ignored."
    );
    console.warn(
      "[WhatsApp] Set GROUP_REGISTRY=groupId1:companyId1,groupId2:companyId2 in your .env file."
    );
  } else {
    const groupCount = registryEnv.split(",").filter((e) => e.includes(":")).length;
    console.log(`[WhatsApp] Group registry loaded — ${groupCount} group(s) registered.`);
  }

  const supabaseClient = createSupabaseClient();
  const repository = new SupabaseClosedJobRepository(supabaseClient);

  console.log("[WhatsApp] Supabase repository initialized.");

  const groupHandlers = new Map<string, CommandHandler>();

  console.log("[WhatsApp] Ready. Send .start in a registered group to activate processing.");

  const client = createWhatsAppClient();

  client.on("message", async (message: WAWebJS.Message) => {
    try {
      await handleMessage(message, repository, groupHandlers);
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
