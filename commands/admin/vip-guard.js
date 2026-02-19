import fs from "fs";
import path from "path";

const VIP_FILE = path.join(process.cwd(), "settings", "vip.json");

function readVip() {
  try {
    const raw = fs.readFileSync(VIP_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (!data.users || typeof data.users !== "object") data.users = {};
    return data;
  } catch {
    return { users: {} };
  }
}

function saveVip(data) {
  fs.writeFileSync(VIP_FILE, JSON.stringify(data, null, 2));
}

function normalizeNumber(x) {
  return String(x || "").replace(/[^\d]/g, "").trim();
}

function getSenderNumber(msg, from) {
  const jid = msg?.key?.participant || from;
  return String(jid || "").split("@")[0];
}

function isOwner(senderNumber, settings) {
  const owners = Array.isArray(settings?.ownerNumbers)
    ? settings.ownerNumbers
    : (typeof settings?.ownerNumber === "string" ? [settings.ownerNumber] : []);
  return owners.map(normalizeNumber).includes(normalizeNumber(senderNumber));
}

// ✅ Verifica VIP y descuenta 1 uso
export function checkVipAndConsume({ msg, from, settings }) {
  const sender = normalizeNumber(getSenderNumber(msg, from));
  if (isOwner(sender, settings)) return { ok: true, owner: true };

  const data = readVip();
  const info = data.users[sender];

  if (!info) return { ok: false, reason: "no_vip" };

  const now = Date.now();

  // vencido
  if (typeof info.expiresAt === "number" && now >= info.expiresAt) {
    delete data.users[sender];
    saveVip(data);
    return { ok: false, reason: "expired" };
  }

  // sin usos
  if (typeof info.usesLeft === "number") {
    if (info.usesLeft <= 0) {
      delete data.users[sender];
      saveVip(data);
      return { ok: false, reason: "limit" };
    }

    // consumir 1 uso
    info.usesLeft -= 1;
    data.users[sender] = info;
    saveVip(data);
  }

  return { ok: true, owner: false, usesLeft: info.usesLeft, expiresAt: info.expiresAt };
}
