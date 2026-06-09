export interface GroupConfig {
  company_id: string;
}

/**
 * Looks up a WhatsApp group ID in the registry and returns its config.
 *
 * Registry format — GROUP_REGISTRY env var:
 *   groupId1:companyId1,groupId2:companyId2
 *
 * The `registryEnv` parameter overrides process.env.GROUP_REGISTRY,
 * making the function testable without mutating process.env.
 *
 * Returns null when the group ID is not found or the registry is empty.
 */
export function lookupGroup(
  whatsapp_group_id: string,
  registryEnv?: string
): GroupConfig | null {
  const raw = (registryEnv ?? process.env.GROUP_REGISTRY ?? "").trim();
  if (!raw) return null;

  for (const entry of raw.split(",")) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) continue;
    const gid = entry.slice(0, colonIdx).trim();
    const companyId = entry.slice(colonIdx + 1).trim();
    if (gid === whatsapp_group_id && companyId) {
      return { company_id: companyId };
    }
  }

  return null;
}
