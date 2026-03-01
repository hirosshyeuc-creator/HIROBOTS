const antiVOOn = new Set();

export default {
  command: ["antiviewonce", "antivo", "viewonce"],
  category: "seguridad",
  description: "Reenvía view-once como normal (on/off)",
  groupOnly: true,
  adminOnly: true,

  run: async ({ sock, msg, from, args }) => {
    const op = (args[0] || "").toLowerCase();
    if (!op) {
      const st = antiVOOn.has(from) ? "ON ✅" : "OFF ❌";
      return sock.sendMessage(
        from,
        { text: `⚙️ Estado anti-viewonce: *${st}*\nUso: .antiviewonce on / .antiviewonce off`, ...global.channelInfo },
        { quoted: msg }
      );
    }

    if (op === "on") {
      antiVOOn.add(from);
      return sock.sendMessage(from, { text: "✅ Anti-viewonce activado.", ...global.channelInfo }, { quoted: msg });
    }
    if (op === "off") {
      antiVOOn.delete(from);
      return sock.sendMessage(from, { text: "✅ Anti-viewonce desactivado.", ...global.channelInfo }, { quoted: msg });
    }

    return sock.sendMessage(from, { text: "❌ Usa on/off", ...global.channelInfo }, { quoted: msg });
  },

  onMessage: async ({ sock, msg, from, esGrupo }) => {
    if (!esGrupo) return;
    if (!antiVOOn.has(from)) return;

    const m = msg.message;
    if (!m) return;

    // Baileys usa distintas llaves según versión:
    const vo =
      m.viewOnceMessageV2 ||
      m.viewOnceMessage ||
      m.viewOnceMessageV2Extension ||
      null;

    if (!vo) return;

    const inner = vo?.message;
    if (!inner) return;

    try {
      // Detecta si es imagen o video dentro del view once
      if (inner.imageMessage) {
        const buff = await sock.downloadMediaMessage({ message: inner });
        return sock.sendMessage(from, { image: buff, caption: "👁️‍🗨️ Anti-viewonce", ...global.channelInfo }, { quoted: msg });
      }

      if (inner.videoMessage) {
        const buff = await sock.downloadMediaMessage({ message: inner });
        return sock.sendMessage(from, { video: buff, caption: "👁️‍🗨️ Anti-viewonce", ...global.channelInfo }, { quoted: msg });
      }

      // Si fuera otro tipo
      return sock.sendMessage(from, { text: "👁️‍🗨️ View-once detectado (tipo no soportado).", ...global.channelInfo }, { quoted: msg });
    } catch (e) {
      console.error("antiviewonce error:", e);
    }
  }
};
