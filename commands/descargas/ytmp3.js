import axios from "axios";
import yts from "yt-search";
import { spawn } from "child_process";
import path from "path";

const API_BASE = "https://dv-yer-api.online/ytmp3";
const COOLDOWN = 8000;
const cooldowns = new Map();

export default {
  command: ["ytmp3", "play"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const messageKey = msg?.key || null;

    const now = Date.now();
    if (cooldowns.has(from) && now < cooldowns.get(from)) return;
    cooldowns.set(from, now + COOLDOWN);

    try {
      if (!args?.length) return;

      if (messageKey) await sock.sendMessage(from, { react: { text: "⏳", key: messageKey } });

      let query = args.join(" ").trim();
      let videoUrl = query;
      if (!/^https?:\/\//i.test(query)) {
        const { videos } = await yts(query);
        videoUrl = videos[0].url;
      }

      // 1. Obtener URL de la API
      const apiRes = await axios.get(API_BASE, {
        params: { mode: "link", quality: "128k", url: videoUrl }
      });
      
      const streamUrl = apiRes.data?.download_url_full;
      if (!streamUrl) throw new Error("No se pudo obtener el stream.");

      // 2. Procesar con FFMPEG para streaming
      // Esto convierte el stream entrante directamente a un formato amigable para WhatsApp
      const ffmpegProcess = spawn("ffmpeg", [
        "-i", streamUrl,
        "-vn",
        "-acodec", "libmp3lame",
        "-q:a", "2",
        "-f", "mp3",
        "pipe:1"
      ]);

      const chunks = [];
      ffmpegProcess.stdout.on("data", (chunk) => chunks.push(chunk));
      
      await new Promise((resolve, reject) => {
        ffmpegProcess.on("close", resolve);
        ffmpegProcess.on("error", reject);
      });

      const buffer = Buffer.concat(chunks);

      // 3. Enviar como Nota de Voz (streaming)
      await sock.sendMessage(from, {
        audio: buffer,
        mimetype: "audio/mpeg",
        ptt: true, // Esto hace que aparezca como nota de voz
        contextInfo: {
          externalAdReply: {
            title: "Audio Streaming",
            body: "Procesado con FFMPEG",
            mediaType: 1,
            renderLargerThumbnail: true
          }
        },
        ...global.channelInfo
      }, { quoted: msg });

      if (messageKey) await sock.sendMessage(from, { react: { text: "✅", key: messageKey } });

    } catch (err) {
      console.error("❌ ERROR FFMPEG:", err);
      if (messageKey) await sock.sendMessage(from, { react: { text: "❌", key: messageKey } });
    }
  },
};
