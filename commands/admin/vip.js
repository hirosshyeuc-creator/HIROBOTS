function normalizeNumber(x) {
  return String(x || "")
    .split("@")[0]
    .split(":")[0]
    .replace(/[^\d]/g, "")
    .trim();
}

function getSenderNumber(msg, from) {
  const jid = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid || from;
  return normalizeNumber(jid);
}

function getOwners(settings) {
  const owners = [];
  if (Array.isArray(settings?.ownerNumbers)) owners.push(...settings.ownerNumbers);
  if (typeof settings?.ownerNumber === "string") owners.push(settings.ownerNumber);
  if (typeof settings?.botNumber === "string") owners.push(settings.botNumber);
  return owners.map(normalizeNumber).filter(Boolean);
}

function isOwner(msg, from, settings) {
  const sender = getSenderNumber(msg, from);
  const owners = getOwners(settings);

  // ✅ (Solo para debug 1 vez, luego puedes quitarlo)
  console.log("[OWNER DEBUG]", { sender, owners });

  return owners.includes(sender);
}
