function takeLastLines(n = 30) {
  const lines = global.consoleBuffer || [];
  if (!lines.length) return "✅ Consola vacía (sin logs aún).";

  const take = Math.min(Math.max(parseInt(n, 10) || 30, 5), 120);
  const slice = lines.slice(-take);

  let text = `🧾 *Consola (últimas ${slice.length} líneas)*\n\n` + slice.join("\n");
  const MAX_CHARS = 6000;
  if (text.length > MAX_CHARS) {
    text = "⚠️ (Recortado por límite)\n\n" + text.slice(text.length - MAX_CHARS);
  }
  return text;
}

export default {
  command: ["consola", "logs", "errores", "clearconsola", "clearlogs"],
  category: "sistema",
  description: "Ver y limpiar consola (owner)",

  ownerOnly: true,

  run: async ({ sock, msg, from, args }) => {
    const cmd = (args?.__cmdName || "").toLowerCase(); // no lo usamos, por compat
    const raw = msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      "";

    const first = raw.trim().split(/\s+/)[0].replace(/^[!.#$%&/?¿]+/, "").toLowerCase();
    const n = raw.trim().split(/\s+/)[1];

    if (["clearconsola", "clearlogs"].includes(first)) {
      global.consoleBuffer = [];
      return sock.sendMessage(from, { text: "✅ Consola limpiada.", ...global.channelInfo }, { quoted: msg });
    }

    const text = takeLastLines(n || 30);
    return sock.sendMessage(from, { text, ...global.channelInfo }, { quoted: msg });
  }
};
