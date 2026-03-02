import axios from "axios";

// ================= CONFIG =================
const COOLDOWN_TIME = 10 * 1000;
const cooldowns = new Map();

const BORDER = "⭐════════════════════════⭐";
const LINE = "❒════════════════════════";

// ================= COMANDO =================
export default {
  command: ["tiktok", "tt", "tk"],
  category: "descarga",

  run: async ({ sock, from, args, settings, m, msg }) => {
    const quoted = (m?.key || msg?.key) ? { quoted: (m || msg) } : undefined;
    const userId = from;
    const BOT_NAME = settings?.botName || "DVYER";
    const channelContext = global.channelInfo || {};

    // 🔒 SISTEMA DE COOLDOWN
    if (cooldowns.has(userId)) {
      const wait = cooldowns.get(userId) - Date.now();
      if (wait > 0) {
        return sock.sendMessage(from, {
          text: `⚠️ *¡DESPACIO!* ⏳\nEspera *${Math.ceil(wait / 1000)}s* para volver a usar este comando.`,
          ...channelContext
        }, quoted);
      }
    }
    cooldowns.set(userId, Date.now() + COOLDOWN_TIME);

    try {
      const videoUrl = args[0]?.trim();

      // 🛑 VALIDACIÓN DE ENTRADA
      if (!videoUrl || !/tiktok\.com/i.test(videoUrl)) {
        cooldowns.delete(userId);
        return sock.sendMessage(from, {
          text: `*┏━━━〔 📥 TIKTOK DOWNLOADER 〕━━━┓*\n\n❌ *ERROR:* Enlace inválido.\n\n📌 *USO:* .tiktok <link>\n\n*┗━━━━━━━━━━━━━━━━━━━━┛*`,
          ...channelContext
        }, quoted);
      }

      // 📡 AVISO DE PROCESAMIENTO
      await sock.sendMessage(from, {
        text: `⚡ *PROCESANDO HD...*\n_Obteniendo contenido desde TikWM_`,
        ...channelContext
      }, { quoted: m });

      // 🌐 LLAMADA A LA API TIKWM
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}&hd=1`;
      const { data } = await axios.get(apiUrl, { timeout: 30000 });

      if (!data || !data.data) {
        throw new Error("No se pudo extraer la información del video.");
      }

      const info = data.data;
      // Priorizar HD, luego normal, luego con marca de agua
      const videoFile = info.hdplay || info.play || info.wmplay;

      if (!videoFile) throw new Error("No se encontró un archivo de video disponible.");

      // ✨ DISEÑO DE CAPTION PROFESIONAL
      const caption = `
${BORDER}
      🎬 *TIKTOK HD DOWNLOAD*
${BORDER}

📝 *TÍTULO:* ${info.title ? (info.title.length > 80 ? info.title.slice(0, 80) + "..." : info.title) : "Sin descripción"}
👤 *AUTOR:* ${info.author?.nickname || "TikTok User"}
⏱️ *DURACIÓN:* ${info.duration || 0}s

📈 *ESTADÍSTICAS:*
❤️ ${info.digg_count?.toLocaleString() || 0} | 💬 ${info.comment_count?.toLocaleString() || 0} | 🔁 ${info.share_count?.toLocaleString() || 0}

${LINE}
🤖 *Bot:* ${BOT_NAME}
${BORDER}`.trim();

      // 🎬 ENVÍO DEL VIDEO
      await sock.sendMessage(from, {
        video: { url: `https://www.tikwm.com${videoFile}` }, // TikWM a veces requiere el dominio base
        caption: caption,
        mimetype: "video/mp4",
        fileName: `tiktok_${info.id}.mp4`,
        ...channelContext
      }, quoted);

    } catch (err) {
      console.error("❌ ERROR TIKWM:", err.message);
      cooldowns.delete(userId);

      await sock.sendMessage(from, {
        text: `❌ *ERROR GENERAL*\n\n${LINE}\nNo se pudo obtener el video. Puede que el link sea privado o la API esté saturada.\n${LINE}`,
        ...channelContext
      }, quoted);
    }
  }
};
