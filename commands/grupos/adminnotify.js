import fs from "fs";
import path from "path";
import {
  findGroupParticipant,
  getParticipantDisplayTag,
  getParticipantMentionJid,
} from "../../lib/group-compat.js";

const DB_DIR = path.join(process.cwd(), "database");
const FILE = path.join(DB_DIR, "adminnotify.json");

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function normalizeConfig(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    enabled: source.enabled === true,
  };
}

function readStore() {
  try {
    if (!fs.existsSync(FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).map(([groupId, config]) => [groupId, normalizeConfig(config)])
    );
  } catch {
    return {};
  }
}

function saveStore(store) {
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

function getConfig(groupId, store = null) {
  const cache = store && typeof store === "object" ? store : readStore();
  if (!cache[groupId]) {
    cache[groupId] = normalizeConfig();
    saveStore(cache);
  }
  return cache[groupId];
}

function getActorCandidate(update = {}) {
  return (
    update?.author ||
    update?.actor ||
    update?.sender ||
    update?.from ||
    update?.notify ||
    ""
  );
}

function buildNoticeText({ action, targetTag, actorTag }) {
  if (action === "promote") {
    const lines = [
      "╭─〔 *ADMIN • NOTIFICACION* 〕",
      `┃ ✅ ${targetTag} ahora es *admin*`,
      actorTag ? `┃ 👮 Accion por: ${actorTag}` : "┃ 👮 Accion por: administrador",
      "╰─⟡ Cambio de rango detectado.",
    ];
    return lines.join("\n");
  }

  const lines = [
    "╭─〔 *ADMIN • NOTIFICACION* 〕",
    `┃ ⚠️ ${targetTag} ya no es *admin*`,
    actorTag ? `┃ 👮 Accion por: ${actorTag}` : "┃ 👮 Accion por: administrador",
    "╰─⟡ Cambio de rango detectado.",
  ];
  return lines.join("\n");
}

export default {
  name: "adminnotify",
  command: ["adminnotify", "notiadmin", "avisoadmin", "adminaviso"],
  category: "grupo",
  groupOnly: true,
  adminOnly: true,
  description: "Notifica en el grupo cuando promueven o degradan administradores",

  async run({ sock, msg, from, args = [] }) {
    const quoted = msg?.key ? { quoted: msg } : undefined;
    const store = readStore();
    const config = getConfig(from, store);
    const action = String(args[0] || "status").trim().toLowerCase();

    if (!args.length || action === "status") {
      return sock.sendMessage(
        from,
        {
          text:
            `*ADMIN NOTIFY*\n\n` +
            `Estado: *${config.enabled ? "ON" : "OFF"}*\n\n` +
            `.adminnotify on\n` +
            `.adminnotify off`,
          ...global.channelInfo,
        },
        quoted
      );
    }

    if (action === "on") {
      store[from] = { ...config, enabled: true };
      saveStore(store);
      return sock.sendMessage(
        from,
        { text: "✅ AdminNotify activado en este grupo.", ...global.channelInfo },
        quoted
      );
    }

    if (action === "off") {
      store[from] = { ...config, enabled: false };
      saveStore(store);
      return sock.sendMessage(
        from,
        { text: "✅ AdminNotify desactivado en este grupo.", ...global.channelInfo },
        quoted
      );
    }

    return sock.sendMessage(
      from,
      {
        text: "Usa .adminnotify on o .adminnotify off",
        ...global.channelInfo,
      },
      quoted
    );
  },

  async onGroupUpdate({ sock, update }) {
    if (!update?.id) return;
    const action = String(update.action || "").trim().toLowerCase();
    if (!["promote", "demote"].includes(action)) return;

    const config = getConfig(update.id);
    if (!config.enabled) return;

    let metadata = null;
    try {
      metadata = await sock.groupMetadata(update.id);
    } catch {}

    const actorCandidate = getActorCandidate(update);
    const actorParticipant = findGroupParticipant(metadata || {}, [actorCandidate]);
    const actorMentionJid = getParticipantMentionJid(metadata || {}, actorParticipant, actorCandidate);
    const actorTag = getParticipantDisplayTag(actorParticipant, actorCandidate);

    for (const participant of update.participants || []) {
      const targetParticipant = findGroupParticipant(metadata || {}, [participant]);
      const targetMentionJid = getParticipantMentionJid(
        metadata || {},
        targetParticipant,
        participant
      );
      const targetTag = getParticipantDisplayTag(targetParticipant, participant);
      const text = buildNoticeText({
        action,
        targetTag,
        actorTag: actorMentionJid && actorMentionJid !== targetMentionJid ? actorTag : "",
      });

      const mentions = Array.from(
        new Set([targetMentionJid, actorMentionJid].filter(Boolean))
      );

      await sock.sendMessage(update.id, {
        text,
        mentions,
        ...global.channelInfo,
      });
    }
  },
};
