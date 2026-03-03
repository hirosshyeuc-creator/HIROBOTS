import fs from "fs";
import path from "path";
import axios from "axios";
import yts from "yt-search";
import { execSync } from "child_process";

const API_URL = "https://nexevo.onrender.com/download/y2";

const COOLDOWN_TIME = 15 * 1000;
const TMP_DIR = path.join(process.cwd(), "tmp");

const MAX_VIDEO_BYTES = 70 * 1024 * 1024;
const MAX_DOC_BYTES = 2 * 1024 * 1024 * 1024;
const MIN_FREE_BYTES = 350 * 1024 * 1024;
const MIN_VALID_BYTES = 300000;
const CLEANUP_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const cooldowns = new Map();
const locks = new Set();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

function safeFileName(name) {
  return (String(name || "video")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "video");
}

function isHttpUrl(s) {
  return /^https?:\/\//i.test(String(s || ""));
}

function getYoutubeId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "").trim();
    const v = u.searchParams.get("v");
    if (v) return v.trim();
    return null;
  } catch {
    return null;
  }
}

function cleanupTmp(maxAgeMs = CLEANUP_MAX_AGE_MS) {
  try {
    const now = Date.now();
    for (const f of fs.readdirSync(TMP_DIR)) {
      const p = path.join(TMP_DIR, f);
      try {
        const st = fs.statSync(p);
        if (st.isFile() && (now - st.mtimeMs) > maxAgeMs) fs.unlinkSync(p);
      } catch {}
    }
  } catch {}
}

function getFreeBytes(dir) {
  try {
    const out = execSync(`df -k "${dir}" | tail -1 | awk '{print $4}'`)
      .toString()
      .trim();
    return Number(out) * 1024;
  } catch {
    return null;
  }
}

async function fetchDirectMediaUrl(videoUrl) {
  const { data } = await axios.get(API_URL, {
    timeout: 25000,
    params: { url: videoUrl },
    validateStatus: (s) => s >= 200 && s < 500,
  });

  if (!data?.status || !data?.result?.url) {
    throw new Error("API Nexevo no respondió correctamente.");
  }

  return {
    title: data?.result?.info?.title || "video",
    directUrl: data.result.url,
    thumbnail: data?.result?.info?.thumbnail || null,
    quality: data?.result?.quality || 360,
  };
}

async function resolveVideoInfo(queryOrUrl) {
  if (!isHttpUrl(queryOrUrl)) {
    const search = await yts(queryOrUrl);
    const first = search?.videos?.[0];
    if (!first) return null;
    return { videoUrl: first.url, title: safeFileName(first.title) };
  }

  const vid = getYoutubeId(queryOrUrl);
  if (vid) {
    try {
      const info = await yts({ videoId: vid });
      if (info) return { videoUrl: info.url, title: safeFileName(info.title) };
    } catch {}
  }

  return { videoUrl: queryOrUrl, title: "video" };
}

async function trySendByUrl(sock, from, quoted, directUrl, title) {
  try {
    await sock.sendMessage(from, {
      video: { url: directUrl },
      mimetype: "video/mp4",
      caption: `🎬 ${title}`,
      ...global.channelInfo,
    }, quoted);
    return;
  } catch {
    await sock.sendMessage(from, {
      document: { url: directUrl },
      mimetype: "video/mp4",
      fileName: `${title}.mp4`,
      caption: `📄 ${title}`,
      ...global.channelInfo,
    }, quoted);
  }
}

async function downloadToFileWithLimit(directUrl, outPath, maxBytes) {
  const partPath = `${outPath}.part`;
  let downloaded = 0;

  const res = await axios.get(directUrl, {
    responseType: "stream",
    timeout: 120000,
    maxRedirects: 5,
  });

  const writer = fs.createWriteStream(partPath);

  res.data.on("data", (chunk) => {
    downloaded += chunk.length;
    if (downloaded > maxBytes) {
      res.data.destroy(new Error("Archivo supera límite"));
    }
  });

  await new Promise((resolve, reject) => {
    res.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  const size = fs.statSync(partPath).size;
  if (size < MIN_VALID_BYTES) throw new Error("Archivo inválido");

  fs.renameSync(partPath, outPath);
  return size;
}

export default {
  command: ["ytmp4"],
  category: "descarga",

  run: async (ctx) => {
    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.msg || null;
    const quoted = msg?.key ? { quoted: msg } : undefined;

    if (locks.has(from))
      return sock.sendMessage(from, { text: "⏳ Espera que termine el otro proceso." });

    const until = cooldowns.get(from);
    if (until && until > Date.now())
      return sock.sendMessage(from, {
        text: `⏳ Espera ${Math.ceil((until - Date.now()) / 1000)}s`,
      });

    if (!args?.length)
      return sock.sendMessage(from, { text: "❌ Uso: .ytmp4 <nombre o link>" });

    cooldowns.set(from, Date.now() + COOLDOWN_TIME);
    locks.add(from);

    let outFile = null;

    try {
      cleanupTmp();

      const query = args.join(" ");
      const meta = await resolveVideoInfo(query);
      if (!meta) throw new Error("No se encontró el video.");

      const api = await fetchDirectMediaUrl(meta.videoUrl);
      const title = safeFileName(api.title || meta.title);

      const loadingMsg = `
╭━━━〔 ⚡ DVYER DOWNLOADER 〕━━━⬣
┃ 🎬 ${title}
┃ 📺 Calidad: ${api.quality}p
┃ 🚀 Procesando descarga...
╰━━━━━━━━━━━━━━━━━━⬣
`;

      if (api.thumbnail) {
        await sock.sendMessage(from, {
          image: { url: api.thumbnail },
          caption: loadingMsg,
        }, quoted);
      } else {
        await sock.sendMessage(from, { text: loadingMsg }, quoted);
      }

      const free = getFreeBytes(TMP_DIR);

      try {
        await trySendByUrl(sock, from, quoted, api.directUrl, title);
      } catch {
        if (free && free < MIN_FREE_BYTES)
          throw new Error("Espacio insuficiente.");

        outFile = path.join(TMP_DIR, `${Date.now()}.mp4`);
        const size = await downloadToFileWithLimit(api.directUrl, outFile, MAX_DOC_BYTES);

        if (size <= MAX_VIDEO_BYTES) {
          await sock.sendMessage(from, {
            video: { url: outFile },
            caption: `🎬 ${title}`,
          }, quoted);
        } else {
          await sock.sendMessage(from, {
            document: { url: outFile },
            fileName: `${title}.mp4`,
          }, quoted);
        }
      }

    } catch (err) {
      await sock.sendMessage(from, { text: `❌ ${err.message}` });
    } finally {
      locks.delete(from);
      try { if (outFile && fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
    }
  },
};