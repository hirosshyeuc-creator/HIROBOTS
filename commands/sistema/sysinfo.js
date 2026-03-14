import os from "os";

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds || 0)));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getRuntimeLabel() {
  if (process.env.pm_id || process.env.PM2_HOME) return "PM2 / VPS";
  if (process.env.RAILWAY_ENVIRONMENT) return "Railway";
  if (process.env.RENDER) return "Render";
  if (process.env.PTERODACTYL_SERVER_UUID || process.env.SERVER_ID) return "Pterodactyl";
  if (process.env.KOYEB_SERVICE_NAME) return "Koyeb";
  if (process.env.DYNO) return "Heroku";
  return "Node directo";
}

export default {
  name: "sysinfo",
  command: ["sysinfo", "system", "hostinfo", "serverinfo"],
  category: "sistema",
  description: "Muestra host, CPU, memoria y entorno del bot",

  run: async ({ sock, msg, from }) => {
    const cpus = os.cpus() || [];
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const cpuModel = cpus[0]?.model || "Desconocido";
    const processMemory = process.memoryUsage();
    const loadAverage = os.loadavg().map((value) => value.toFixed(2)).join(" | ");

    const text =
      `*SYSINFO*\n\n` +
      `Host: *${os.hostname()}*\n` +
      `Entorno: *${getRuntimeLabel()}*\n` +
      `Sistema: *${os.platform()} ${os.release()} ${os.arch()}*\n` +
      `Node: *${process.version}*\n` +
      `CPU: *${cpus.length}* cores\n` +
      `Modelo CPU: ${cpuModel}\n` +
      `Load avg: ${loadAverage}\n` +
      `RAM usada: *${formatBytes(usedMemory)}* / ${formatBytes(totalMemory)}\n` +
      `RAM libre: *${formatBytes(freeMemory)}*\n` +
      `Proceso RSS: *${formatBytes(processMemory.rss)}*\n` +
      `Heap usado: *${formatBytes(processMemory.heapUsed)}*\n` +
      `Uptime host: *${formatUptime(os.uptime())}*\n` +
      `Uptime proceso: *${formatUptime(process.uptime())}*`;

    return sock.sendMessage(
      from,
      { text, ...global.channelInfo },
      { quoted: msg }
    );
  },
};
