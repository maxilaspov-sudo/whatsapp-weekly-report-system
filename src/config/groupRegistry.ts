export interface GroupConfig {
  company_id: string;
  /**
   * WhatsApp contact IDs authorised to run admin commands in this group.
   * Format: phone@c.us (e.g. "15551234567@c.us").
   * Sourced from GROUP_ADMINS env var: groupId:phone1|phone2,...
   * An empty array means all admin commands are denied for everyone.
   */
  authorized_admin_ids: string[];
}

/**
 * Looks up a WhatsApp group ID in the registry and returns its full config.
 *
 * Registry env vars:
 *   GROUP_REGISTRY=groupId1:companyId1,groupId2:companyId2
 *   GROUP_ADMINS=groupId1:adminPhone1@c.us|adminPhone2@c.us,groupId2:adminPhone3@c.us
 *
 * The optional override params (`registryEnv`, `adminsEnv`) replace the
 * corresponding env vars, making the function testable without mutating process.env.
 *
 * Returns null when the group ID is not found in GROUP_REGISTRY.
 */
export function lookupGroup(
  whatsapp_group_id: string,
  registryEnv?: string,
  adminsEnv?: string
): GroupConfig | null {
  const raw = (registryEnv ?? process.env.GROUP_REGISTRY ?? "").trim();
  if (!raw) return null;

  let company_id: string | null = null;
  for (const entry of raw.split(",")) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) continue;
    const gid = entry.slice(0, colonIdx).trim();
    const cid = entry.slice(colonIdx + 1).trim();
    if (gid === whatsapp_group_id && cid) {
      company_id = cid;
      break;
    }
  }

  if (company_id === null) return null;

  const authorized_admin_ids = parseAdminIds(whatsapp_group_id, adminsEnv);
  return { company_id, authorized_admin_ids };
}

function parseAdminIds(whatsapp_group_id: string, adminsEnv?: string): string[] {
  const raw = (adminsEnv ?? process.env.GROUP_ADMINS ?? "").trim();
  if (!raw) return [];

  for (const entry of raw.split(",")) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) continue;
    const gid = entry.slice(0, colonIdx).trim();
    if (gid !== whatsapp_group_id) continue;
    const adminsPart = entry.slice(colonIdx + 1).trim();
    if (!adminsPart) return [];
    return adminsPart.split("|").map((id) => id.trim()).filter(Boolean);
  }

  return [];
}
