import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import axios from "axios";
import yts from "yt-search";
import { pipeline } from "stream/promises";

const API_URL = "https://gawrgura-api.onrender.com/download/ytdl";

// ✅ TMP propio dentro del proyecto (más control y limpieza)
const TMP_DIR = path.join(process.cwd(), "tmp");

// ⛔ Ajusta límites según tu host/WhatsApp
const MAX_BYTES = 90 * 1024 * 1024; // 90MB
const MAX_SECONDS = 20 * 60; // 20 min (evita cosas gigantes)
const COOLDOWN_TIME = 40000; // ✅ 40 segundos

const cooldowns = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ✅ cola global (evita muchas descargas simultáneas)
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
  process.env.TMPDIR = TMP_DIR;
  process.env.TMP = TMP_DIR;
  process.env.TEMP = TMP_DIR;
}
ensureTmp();

async function cleanTmp(dir, maxAgeMs = 60 * 60 * 1000) {
  const now = Date.now();
  let files = [];
  try {
    files = await fsp.readdir(dir);
  } catch {
    return;
  }
  for (const name of files) {
    const p = path.join(dir, name);
    try {
      const st = await fsp.stat(p);
      if (st.isFile() && now - st.mtimeMs > maxAgeMs) {
        await fsp.unlink(p);
      }
    } catch {}
  }
}

// limpia cada 10 min lo viejo
setInterval(() => cleanTmp(TMP_DIR).catch(() => {}), 10 * 60 * 1000);

function isENOSPC(err) {
  return (
    err?.code === "ENOSPC" ||
    err?.errno === -28 ||
    String(err?.message || "").includes("ENOSPC")
  );
}

async function axiosGetWithRetry(url, opts, retries = 2) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      return await axios.get(url, opts);
    } catch (e) {
      lastErr = e;
      const code = e?.response?.status;
      const retryable =
        !code ||
        code >= 500 ||
        code === 429 ||
        e?.code === "ECONNRESET" ||
        e?.code === "ETIMEDOUT" ||
        e?.code === "ECONNABORTED";

      if (!retryable || i === retries) throw lastErr;
      await sleep(500 * (i + 1));
    }
  }
  throw lastErr;
}

async function axiosHeadSafe(url) {
  try {
    const res = await axios.head(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const len = Number(res?.headers?.["content-length"] || 0);
    return len || 0;
  } catch {
    return 0;
  }
}

async function downloadToFile(mp4Url, filePath) {
  const res = await axios.get(mp4Url, {
    responseType: "stream",
    timeout: 120000,
    maxRedirects: 5,
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  await pipeline(res.data, fs.createWriteStream(filePath));

  const size = fs.statSync(filePath).size;
  if (size < 700000) throw new Error("Archivo incompleto (muy pequeño)");
  if (MAX_BYTES && size > MAX_BYTES)
    throw new Error("Archivo supera el límite permitido");
  return size;
}

export default {
  command: ["ytmp4"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.message || ctx.msg || null;
    const messageKey = msg?.key || null;

    const userId = from;
    const now = Date.now();

    let rawMp4 = null;

    // 🔒 COOLDOWN
    const cooldown = cooldowns.get(userId);
    if (cooldown && cooldown > now) {
      return sock.sendMessage(from, {
        text: `⏳ Espera *${Math.ceil((cooldown - now) / 1000)}s* para volver a usar .ytmp4`,
      });
    }
    cooldowns.set(userId, now + COOLDOWN_TIME);

    try {
      if (!args || !args.length) {
        cooldowns.delete(userId); // ✅ no castigues si lo usó mal
        return sock.sendMessage(from, {
          text:
            "❌ *Uso correcto:*\n\n" +
            "• `.ytmp4 https://youtube.com/...`\n" +
            "• `.ytmp4 nombre del video`",
        });
      }

      if (messageKey) {
        await sock.sendMessage(from, { react: { text: "⏳", key: messageKey } });
      }

      ensureTmp();
      await cleanTmp(TMP_DIR).catch(() => {});

      let query = args.join(" ").trim();
      let videoUrl = query;

      // 🔍 Si no es link, buscar en YouTube (filtra largos)
      if (!/^https?:\/\//i.test(query)) {
        const search = await yts(query);
        if (!search?.videos?.length) throw new Error("Sin resultados");

        const pick =
          search.videos.find(
            (v) => v?.seconds && v.seconds <= MAX_SECONDS && !v.live
          ) || search.videos[0];

        videoUrl = pick.url;
      }

      // 🌐 Pedir MP4 a tu API
      const { data } = await axiosGetWithRetry(
        `${API_URL}?url=${encodeURIComponent(videoUrl)}`,
        { timeout: 25000 },
        2
      );

      if (!data?.status || !data?.result?.mp4) {
        throw new Error("API inválida o sin mp4");
      }

      const mp4Url = data.result.mp4;
      if (typeof mp4Url !== "string" || !mp4Url.startsWith("http")) {
        throw new Error("mp4Url inválido");
      }

      // ✅ chequeo de tamaño antes (si el server lo da)
      const len = await axiosHeadSafe(mp4Url);
      if (len && len > MAX_BYTES) {
        throw new Error(
          `El video pesa ~${Math.ceil(len / (1024 * 1024))}MB y supera el límite (${Math.ceil(
            MAX_BYTES / (1024 * 1024)
          )}MB).`
        );
      }

      // ⬇️ Descargar y 📤 enviar con cola global
      await withGlobalLock(async () => {
        rawMp4 = path.join(TMP_DIR, `${Date.now()}_video.mp4`);

        let ok = false;
        let lastErr = null;

        for (let i = 0; i < 3; i++) {
          try {
            await downloadToFile(mp4Url, rawMp4);
            ok = true;
            break;
          } catch (e) {
            lastErr = e;
            if (isENOSPC(e)) break;
            await sleep(1500 * (i + 1));
          }
        }

        if (!ok) throw lastErr || new Error("Fallo descarga");

        await sock.sendMessage(
          from,
          {
            video: { url: rawMp4 },
            mimetype: "video/mp4",
          },
          msg?.key ? { quoted: msg } : undefined
        );

        // ✅ limpia apenas termina (por si falla afuera)
        try {
          if (rawMp4 && fs.existsSync(rawMp4)) fs.unlinkSync(rawMp4);
        } catch {}
      });

      if (messageKey) {
        await sock.sendMessage(from, { react: { text: "✅", key: messageKey } });
      }
    } catch (err) {
      console.error("YTMP4 ERROR:", err?.message || err);

      cooldowns.delete(userId); // ✅ libera cooldown si falló

      if (messageKey) {
        try {
          await sock.sendMessage(from, { react: { text: "❌", key: messageKey } });
        } catch {}
      }

      if (isENOSPC(err)) {
        try {
          await cleanTmp(TMP_DIR, 0);
        } catch {}
        return sock.sendMessage(from, {
          text:
            "❌ *Sin espacio en el servidor (ENOSPC).* Ya limpié temporales.\n\n" +
            "✅ Solución: libera espacio en el host o aumenta el almacenamiento.",
        });
      }

      await sock.sendMessage(from, {
        text: `❌ Error al descargar/enviar el video.\n${err?.message ? `\n🧾 ${err.message}` : ""}`,
      });
    } finally {
      // 🧹 Limpieza extra por seguridad
      try {
        if (rawMp4 && fs.existsSync(rawMp4)) fs.unlinkSync(rawMp4);
      } catch {}
    }
  },
};

process.on("uncaughtException", (e) => console.error("Uncaught:", e));
process.on("unhandledRejection", (e) => console.error("Unhandled:", e));
