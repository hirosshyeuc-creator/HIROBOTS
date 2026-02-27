import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import axios from "axios";
import yts from "yt-search";
import { pipeline } from "stream/promises";

const API_URL = "https://nexevo-api.vercel.app/download/y2";

const TMP_DIR = path.join(process.cwd(), "tmp");

const MAX_BYTES = 90 * 1024 * 1024;
const COOLDOWN_TIME = 15000;

const cooldowns = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let busy = false;
async function withGlobalLock(fn) {
  while (busy) await sleep(400);
  busy = true;
  try {
    return await fn();
  } finally {
    busy = false;
  }
}

function ensureTmp() {
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}
ensureTmp();

async function cleanTmp() {
  try {
    const files = await fsp.readdir(TMP_DIR);
    for (const file of files) {
      const p = path.join(TMP_DIR, file);
      await fsp.unlink(p).catch(() => {});
    }
  } catch {}
}

function isENOSPC(err) {
  return (
    err?.code === "ENOSPC" ||
    String(err?.message || "").includes("ENOSPC")
  );
}

async function downloadToFile(url, filePath) {
  const res = await axios.get(url, {
    responseType: "stream",
    timeout: 120000,
    maxRedirects: 5,
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  await pipeline(res.data, fs.createWriteStream(filePath));

  const size = fs.statSync(filePath).size;
  if (size < 500000) throw new Error("Archivo incompleto");
  if (size > MAX_BYTES) throw new Error("Video supera 90MB");
}

export default {
  command: ["ytmp4"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const messageKey = msg?.key || null;

    const userId = from;
    const now = Date.now();
    let rawMp4 = null;

    const cooldown = cooldowns.get(userId);
    if (cooldown && cooldown > now) {
      return sock.sendMessage(from, {
        text: `⏳ Espera ${Math.ceil((cooldown - now) / 1000)}s`,
      });
    }
    cooldowns.set(userId, now + COOLDOWN_TIME);

    try {
      if (!args.length) {
        cooldowns.delete(userId);
        return sock.sendMessage(from, {
          text:
            "❌ Uso:\n" +
            ".ytmp4 https://youtube.com/...\n" +
            "o\n" +
            ".ytmp4 nombre del video",
        });
      }

      if (messageKey) {
        await sock.sendMessage(from, { react: { text: "⏳", key: messageKey } });
      }

      let query = args.join(" ");
      let videoUrl = query;

      // 🔎 buscar si no es link
      if (!/^https?:\/\//i.test(query)) {
        const search = await yts(query);
        if (!search.videos.length) throw new Error("Sin resultados");
        videoUrl = search.videos[0].url;
      }

      // 🔥 LLAMADA A TU API REAL
      const { data } = await axios.get(
        `${API_URL}?url=${encodeURIComponent(videoUrl)}`,
        { timeout: 25000 }
      );

      if (!data?.status || !data?.result?.url) {
        throw new Error("API inválida");
      }

      const mp4Url = data.result.url;

      await withGlobalLock(async () => {
        rawMp4 = path.join(TMP_DIR, `${Date.now()}.mp4`);

        await downloadToFile(mp4Url, rawMp4);

        await sock.sendMessage(
          from,
          {
            video: { url: rawMp4 },
            mimetype: "video/mp4",
            caption: `🎬 Calidad: ${data.result.quality || "360p"}`,
          },
          msg?.key ? { quoted: msg } : undefined
        );
      });

      if (messageKey) {
        await sock.sendMessage(from, { react: { text: "✅", key: messageKey } });
      }

    } catch (err) {
      console.error("YTMP4 ERROR:", err?.message);

      if (isENOSPC(err)) {
        await cleanTmp();
        return sock.sendMessage(from, {
          text: "❌ Sin espacio en el servidor. Limpieza realizada.",
        });
      }

      await sock.sendMessage(from, {
        text: `❌ Error:\n${err?.message || "No se pudo descargar"}`,
      });

    } finally {
      try {
        if (rawMp4 && fs.existsSync(rawMp4)) fs.unlinkSync(rawMp4);
      } catch {}
    }
  },
};

process.on("uncaughtException", (e) => console.error("Uncaught:", e));
process.on("unhandledRejection", (e) => console.error("Unhandled:", e));
