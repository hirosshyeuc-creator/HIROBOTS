import {
  getParticipantDisplayTag,
  getParticipantMentionJid,
} from "../../lib/group-compat.js";

function nowLabel() {
  try {
    return new Date().toLocaleString("es-PE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return new Date().toISOString();
  }
}

function buildMembersBlock(participants = [], maxChars = 2800) {
  const lines = [];
  let used = 0;

  for (let i = 0; i < participants.length; i += 1) {
    const participant = participants[i];
    const line = `┃ ${String(i + 1).padStart(2, "0")}. ${getParticipantDisplayTag(participant, participant?.id)}`;
    const extra = line.length + 1;

    if (used + extra > maxChars) {
      const remaining = participants.length - i;
      lines.push(`┃ … y ${remaining} miembro(s) mas`);
      break;
    }

    lines.push(line);
    used += extra;
  }

  return lines.join("\n");
}

export default {
  command: ["tagall", "invocar", "invocartodos", "llamartodos", "mencionartodos"],
  category: "grupo",
  description: "Invoca y etiqueta a todos los miembros del grupo",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, args }) => {
    const meta = await sock.groupMetadata(from);
    const participants = Array.isArray(meta?.participants) ? meta.participants : [];
    const members = participants
      .map((participant) => getParticipantMentionJid(meta, participant, participant?.id))
      .filter(Boolean);

    const texto = args.length ? args.join(" ") : "Convocatoria general del grupo";
    const membersBlock = buildMembersBlock(participants);
    const header =
      `╭━━━〔 📢 INVOCACION GENERAL 〕━━━⬣\n` +
      `┃ Grupo: *${meta?.subject || "Grupo"}*\n` +
      `┃ Miembros: *${participants.length}*\n` +
      `┃ Fecha: *${nowLabel()}*\n` +
      `┃ Mensaje: *${texto}*\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━⬣`;

    const body =
      `${header}\n\n` +
      `╭━━━〔 👥 MIEMBROS INVOCADOS 〕━━━⬣\n` +
      `${membersBlock}\n` +
      `╰━━━━━━━━━━━━━━━━━━━━━━⬣`;

    return sock.sendMessage(
      from,
      {
        text: body,
        mentions: members,
        ...global.channelInfo
      },
      { quoted: msg }
    );
  }
};
