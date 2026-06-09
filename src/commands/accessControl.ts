import { GroupConfig } from "../config/groupRegistry";

export const ADMIN_COMMANDS = new Set(["start", "stop", "status", "report"]);
export const PUBLIC_COMMANDS = new Set(["help", "format"]);

export function isAdminCommand(command: string): boolean {
  return ADMIN_COMMANDS.has(command);
}

export type AccessDecision =
  | { granted: true }
  | { granted: false; reason: "private_chat" }
  | { granted: false; reason: "unregistered_group" }
  | { granted: false; reason: "access_denied" };

/**
 * Pure function — decides whether a command may be executed.
 *
 * private_chat:       non-group message; deny silently (caller should not reply)
 * unregistered_group: group not in registry; caller should reply with group-not-registered message
 * access_denied:      group registered but sender not an admin; caller should reply with access-denied message
 * granted:            proceed
 *
 * Public commands (help, format) are always granted inside registered groups.
 * Admin commands (start, stop, status, report) require the sender to be in authorized_admin_ids.
 * An empty authorized_admin_ids list blocks all admin commands.
 */
export function checkCommandAccess(
  command: string,
  isGroupChat: boolean,
  groupConfig: GroupConfig | null,
  senderId: string
): AccessDecision {
  if (!isGroupChat) return { granted: false, reason: "private_chat" };
  if (!groupConfig) return { granted: false, reason: "unregistered_group" };
  if (!isAdminCommand(command)) return { granted: true };
  if (groupConfig.authorized_admin_ids.includes(senderId)) return { granted: true };
  return { granted: false, reason: "access_denied" };
}
