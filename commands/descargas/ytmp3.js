import axios from "axios";
import yts from "yt-search";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

const API_BASE = "https://dv-yer-api.online/ytmp3";
const TMP_DIR = path.join(process.cwd(), "tmp");

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR);

export default {
  command: ["ytmp3", "play"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const messageKey = msg?.key || null;
    
    const id = Date.now();
    const rawPath = path.join(TMP_DIR, `raw_${id}.m4a`);
    const mp3Path = path.join(TMP_DIR, `final_${id}.mp3`);

    try {
      if (!args?.length) return;
      if (messageKey) await sock.sendMessage(from, { react: { text: "⏳", key: messageKey } });

      let query = args.join(" ").trim();
      let videoUrl = query;
      if (!/^https?:\/\//i.test(query)) {
        const { videos } = await yts(query);
        videoUrl = videos[0].url;
      }

      const apiRes = await axios.get(API_BASE, {
        params: { mode: "link", quality: "128k", url: videoUrl }
      });
      
      const streamUrl = apiRes.data?.download_url_full;
      if (!streamUrl) throw new Error("API no respondió.");

      // 1. Descargamos el archivo original (M4A)
      const writer = fs.createWriteStream(rawPath);
      const response = await axios({ url: streamUrl, method: 'GET', responseType: 'stream' });
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      // 2. CONVERSIÓN FORZADA con FFMPEG a MP3 (Esto limpia el contenedor M4A)
      await new Promise((resolve, reject) => {
        const cmd = `ffmpeg -i "${rawPath}" -acodec libmp3lame -ab 128k -ar 44100 -y "${mp3Path}"`;
        exec(cmd, (err) => err ? reject(err) : resolve());
      });

      // 3. Enviamos el archivo MP3 ya convertido
      await sock.sendMessage(from, {
        audio: { url: mp3Path },
        mimetype: "audio/mpeg",
        ptt: true,
        fileName: "audio.mp3"
      }, { quoted: msg });

      if (messageKey) await sock.sendMessage(from, { react: { text: "✅", key: messageKey } });

    } catch (err) {
      console.error("❌ ERROR FFMPEG/M4A:", err);
      if (messageKey) await sock.sendMessage(from, { react: { text: "❌", key: messageKey } });
    } finally {
      // 4. LIMPIEZA: Borramos los archivos temporales
      if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
      if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
    }
  },
};
