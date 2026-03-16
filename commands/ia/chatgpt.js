import axios from "axios";

function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }

  return String(settings?.prefix || ".").trim() || ".";
}

export default {
  name: "gpt5",
  command: ["gpt", "ai", "gpt5"],
  category: "ai",
  desc: "Chat con IA. Uso: .gpt5 <pregunta>",

  run: async ({ sock, msg, from, args, settings }) => {
    const prompt = args.join(" ").trim();
    const prefix = getPrefix(settings);

    if (!prompt) {
      return sock.sendMessage(
        from,
        { text: `❌ Uso:\n${prefix}gpt5 <pregunta>`, ...global.channelInfo },
        { quoted: msg }
      );
    }

    try {
      const url = `https://api.soymaycol.icu/api/ai/gpt5?prompt=${encodeURIComponent(prompt)}`;
      const { data } = await axios.get(url, { timeout: 60000 });

      if (!data?.status) {
        return sock.sendMessage(
          from,
          {
            text: `❌ Error: ${data?.message || "No se pudo obtener respuesta"}`,
            ...global.channelInfo,
          },
          { quoted: msg }
        );
      }

      const respuesta = data.response || "Sin respuesta.";
      const MAX = 6000;
      const textoFinal =
        respuesta.length > MAX ? `${respuesta.slice(0, MAX)}\n\n(Recortado...)` : respuesta;

      await sock.sendMessage(
        from,
        { text: textoFinal, ...global.channelInfo },
        { quoted: msg }
      );
    } catch (e) {
      console.error("gpt5 error:", e?.message || e);
      await sock.sendMessage(
        from,
        { text: "❌ Error conectando con la API de IA.", ...global.channelInfo },
        { quoted: msg }
      );
    }
  },
};
