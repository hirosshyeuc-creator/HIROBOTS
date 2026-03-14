const TEST_HOST = "https://speed.cloudflare.com";
const PING_SAMPLES = 3;
const DOWNLOAD_BYTES = 8_000_000;
const UPLOAD_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 45_000;

let activeSpeedtest = null;

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatMbps(bytes, ms) {
  const totalMs = Math.max(1, Number(ms || 0));
  const mbps = ((Number(bytes || 0) * 8) / (totalMs / 1000)) / 1_000_000;
  return `${mbps.toFixed(2)} Mbps`;
}

function formatMs(value) {
  return `${Number(value || 0).toFixed(0)} ms`;
}

function average(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, current) => sum + current, 0) / values.length;
}

async function readResponseBytes(response) {
  if (!response?.body?.getReader) {
    const payload = await response.arrayBuffer();
    return payload.byteLength;
  }

  const reader = response.body.getReader();
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value?.byteLength || 0;
  }

  return total;
}

async function runTimedFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = process.hrtime.bigint();

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return { response, startedAt };
  } finally {
    clearTimeout(timeout);
  }
}

async function measurePing() {
  const samples = [];

  for (let index = 0; index < PING_SAMPLES; index += 1) {
    const query = `${TEST_HOST}/__down?bytes=1&r=${Date.now()}-${index}`;
    const { response, startedAt } = await runTimedFetch(query, { method: "GET" });
    await readResponseBytes(response);
    const endedAt = process.hrtime.bigint();
    samples.push(Number(endedAt - startedAt) / 1_000_000);
  }

  return {
    samples,
    averageMs: average(samples),
    bestMs: Math.min(...samples),
  };
}

async function measureDownload() {
  const query = `${TEST_HOST}/__down?bytes=${DOWNLOAD_BYTES}&r=${Date.now()}`;
  const { response, startedAt } = await runTimedFetch(query, { method: "GET" });
  const bytes = await readResponseBytes(response);
  const endedAt = process.hrtime.bigint();
  const elapsedMs = Number(endedAt - startedAt) / 1_000_000;

  return {
    bytes,
    elapsedMs,
    speedLabel: formatMbps(bytes, elapsedMs),
  };
}

async function measureUpload() {
  const payload = Buffer.alloc(UPLOAD_BYTES, 97);
  const query = `${TEST_HOST}/__up?r=${Date.now()}`;
  const { response, startedAt } = await runTimedFetch(query, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(payload.length),
    },
    body: payload,
  });

  await response.text();
  const endedAt = process.hrtime.bigint();
  const elapsedMs = Number(endedAt - startedAt) / 1_000_000;

  return {
    bytes: payload.length,
    elapsedMs,
    speedLabel: formatMbps(payload.length, elapsedMs),
  };
}

async function executeSpeedtest() {
  const startedAt = Date.now();
  const ping = await measurePing();
  const download = await measureDownload();
  const upload = await measureUpload();

  return {
    startedAt,
    finishedAt: Date.now(),
    ping,
    download,
    upload,
  };
}

function buildResultMessage(result) {
  const totalTimeMs = Math.max(0, Number(result?.finishedAt || 0) - Number(result?.startedAt || 0));

  return (
    `*SPEEDTEST BOT*\n\n` +
    `Host prueba: *Cloudflare Speed Test*\n` +
    `Ping promedio: *${formatMs(result?.ping?.averageMs)}*\n` +
    `Ping mejor: *${formatMs(result?.ping?.bestMs)}*\n` +
    `Descarga: *${result?.download?.speedLabel || "0.00 Mbps"}*\n` +
    `Subida: *${result?.upload?.speedLabel || "0.00 Mbps"}*\n` +
    `Datos descarga: *${formatBytes(result?.download?.bytes)}*\n` +
    `Datos subida: *${formatBytes(result?.upload?.bytes)}*\n` +
    `Tiempo total: *${formatMs(totalTimeMs)}*`
  );
}

function buildErrorMessage(error) {
  const message = String(error?.message || error || "Error desconocido");

  return (
    `No pude completar el speedtest.\n` +
    `Motivo: *${message}*\n\n` +
    `Posibles causas:\n` +
    `- el hosting bloquea pruebas de red\n` +
    `- la salida HTTP esta limitada\n` +
    `- la conexion del servidor esta inestable`
  );
}

export default {
  name: "speedtest",
  command: ["speedtest"],
  category: "sistema",
  description: "Mide ping, descarga y subida del internet del bot",

  run: async ({ sock, msg, from }) => {
    if (activeSpeedtest) {
      return sock.sendMessage(
        from,
        {
          text: "Ya hay un speedtest en progreso. Espera a que termine.",
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }

    await sock.sendMessage(
      from,
      {
        text:
          "*Iniciando speedtest del bot...*\n\n" +
          "Estoy midiendo ping, descarga y subida. Esto puede tardar unos segundos.",
        ...global.channelInfo,
      },
      { quoted: msg }
    );

    activeSpeedtest = executeSpeedtest();

    try {
      const result = await activeSpeedtest;

      return sock.sendMessage(
        from,
        {
          text: buildResultMessage(result),
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    } catch (error) {
      console.error("SPEEDTEST ERROR:", error);

      return sock.sendMessage(
        from,
        {
          text: buildErrorMessage(error),
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    } finally {
      activeSpeedtest = null;
    }
  },
};
