export const SUPPORTED_COMMANDS = [
  "help",
  "start",
  "stop",
  "status",
  "format",
  "report",
] as const;

export type SupportedCommand = (typeof SUPPORTED_COMMANDS)[number];

export interface ParsedCommand {
  command: string;
  args: string[];
}

/**
 * Parses an incoming message as a bot command.
 *
 * A command is any message whose first non-whitespace character is ".".
 * The command name is normalised to lowercase. Everything after the command
 * name is split into args.
 *
 * Returns null when the message is not a command (does not start with ".").
 * Unknown command names are returned as-is — the handler decides the response.
 *
 * Examples:
 *   ".help"           → { command: "help",   args: [] }
 *   ".REPORT"         → { command: "report", args: [] }
 *   "  .start now  "  → { command: "start",  args: ["now"] }
 *   "hello"           → null
 */
export function parseCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim();

  if (!trimmed.startsWith(".")) return null;

  // Remove the leading dot and re-split
  const tokens = trimmed.slice(1).trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) return null;

  const [commandToken, ...args] = tokens;

  return { command: commandToken.toLowerCase(), args };
}
