import fs from "fs";
import os from "os";
import path from "path";

const BOX_WIDTH = 56;

function repeat(char, count) {
  return char.repeat(Math.max(0, count));
}

function border(char = "=") {
  return `+${repeat(char, BOX_WIDTH + 2)}+`;
}

function padLine(content = "") {
  return `| ${String(content).padEnd(BOX_WIDTH)} |`;
}

function centerLine(content = "") {
  const text = String(content || "");
  const totalPadding = Math.max(0, BOX_WIDTH - text.length);
  const left = Math.floor(totalPadding / 2);
  const right = totalPadding - left;
  return `|${repeat(" ", left + 1)}${text}${repeat(" ", right + 1)}|`;
}

function wrapText(text, width = BOX_WIDTH) {
  const source = String(text || "").trim();
  if (!source) return [""];

  const words = source.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width) {
      current = next;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
    }

    if (word.length <= width) {
      current = word;
      continue;
    }

    let index = 0;
    while (index < word.length) {
      lines.push(word.slice(index, index + width));
      index += width;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildWrappedLines(text, options = {}) {
  const prefix = String(options.prefix || "");
  const continuation = String(options.continuation || repeat(" ", prefix.length));
  const width = Math.max(10, BOX_WIDTH - prefix.length);
  const lines = wrapText(text, width);

  return lines.map((line, index) =>
    padLine(`${index === 0 ? prefix : continuation}${line}`)
  );
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

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function getPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }

  return String(settings?.prefix || ".").trim() || ".";
}

function getRuntimeMode() {
  if (process.env.pm_id || process.env.PM2_HOME) return "PM2 / VPS";
  if (process.env.RAILWAY_ENVIRONMENT) return "Railway";
  if (process.env.RENDER) return "Render";
  if (process.env.PTERODACTYL_SERVER_UUID || process.env.SERVER_ID) return "Pterodactyl";
  if (process.env.KOYEB_SERVICE_NAME) return "Koyeb";
  if (process.env.DYNO) return "Heroku";
  return "Node directo";
}

function buildCategoryMap(comandos) {
  const categories = new Map();

  for (const cmd of new Set(comandos.values())) {
    if (!cmd?.category || !cmd?.command) continue;

    const category = String(cmd.category).toLowerCase();
    const primaryCommand = Array.isArray(cmd.command) ? cmd.command[0] : cmd.command;
    const description = String(cmd.description || "").trim();

    if (!primaryCommand) continue;
    if (!categories.has(category)) categories.set(category, []);

    categories.get(category).push({
      command: String(primaryCommand).toLowerCase(),
      description,
    });
  }

  for (const items of categories.values()) {
    items.sort((a, b) => a.command.localeCompare(b.command));
  }

  return categories;
}

function countCommands(categories) {
  return Array.from(categories.values()).reduce(
    (total, items) => total + items.length,
    0
  );
}

function sortCategories(categories) {
  const preferred = [
    "subbots",
    "sistema",
    "descarga",
    "busqueda",
    "grupo",
    "admin",
    "media",
    "ai",
    "vip",
    "menu",
  ];

  return Array.from(categories.keys()).sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);

    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function getCategoryLabel(category) {
  const labels = {
    admin: "ADMIN",
    ai: "AI",
    busqueda: "BUSQUEDA",
    descarga: "DESCARGAS",
    grupo: "GRUPOS",
    media: "MEDIA",
    menu: "MENU",
    sistema: "SISTEMA",
    subbots: "SUBBOTS",
    vip: "VIP",
  };

  return labels[String(category || "").toLowerCase()] || String(category || "").toUpperCase();
}

function getSubbotStats() {
  const runtime = global.botRuntime;
  if (!runtime?.getSubbotRequestState || !runtime?.listBots) {
    return {
      maxSlots: 15,
      availableSlots: 0,
      activeSlots: 0,
      enabledSlots: 0,
      publicRequests: false,
      botCount: 0,
      connectedCount: 0,
    };
  }

  const state = runtime.getSubbotRequestState() || {};
  const bots = runtime.listBots({ includeMain: true }) || [];

  return {
    maxSlots: Number(state.maxSlots || 15),
    availableSlots: Number(state.availableSlots || 0),
    activeSlots: Number(state.activeSlots || 0),
    enabledSlots: Number(state.enabledSlots || 0),
    publicRequests: Boolean(state.publicRequests),
    botCount: bots.length,
    connectedCount: bots.filter((bot) => bot.connected).length,
  };
}

function buildHeader(settings, categories, prefix) {
  const subbots = getSubbotStats();

  return [
    border("="),
    centerLine(`${String(settings.botName || "BOT")} // CONTROL HUB`),
    centerLine("menu principal del bot"),
    border("="),
    padLine(`Prefijo: ${prefix}`),
    padLine(`Uptime: ${formatUptime(process.uptime())} | Entorno: ${getRuntimeMode()}`),
    padLine(`Categorias: ${categories.size} | Comandos: ${countCommands(categories)}`),
    padLine(`Bots online: ${subbots.connectedCount}/${subbots.botCount}`),
    border("="),
  ];
}

function renderFeatureSection(title, subtitle, stats = [], items = []) {
  const lines = [border("-"), centerLine(title), centerLine(subtitle), border("-")];

  for (const stat of stats) {
    lines.push(padLine(stat));
  }

  if (stats.length) {
    lines.push(padLine(""));
  }

  for (const item of items) {
    lines.push(...buildWrappedLines(`\`${item.command}\``, { prefix: "> " }));
    lines.push(...buildWrappedLines(item.description, { prefix: "  " }));
  }

  lines.push(border("-"));
  return lines.join("\n");
}

function renderSubbotsSection(prefix, items) {
  const stats = getSubbotStats();
  const labels = {
    subbot: "pide un codigo nuevo para otro bot usando tu numero",
    subbots: "mira slots, tiempos, conexiones y subbots activos",
    subboton: "abre el acceso publico para que todos pidan subbots",
    subbotoff: "cierra el acceso publico cuando quieras pausarlo",
  };
  const order = ["subbot", "subbots", "subboton", "subbotoff"];
  const itemMap = new Map(items.map((item) => [item.command, item]));
  const ordered = [
    ...order.filter((name) => itemMap.has(name)).map((name) => itemMap.get(name)),
    ...items.filter((item) => !order.includes(item.command)),
  ];

  return renderFeatureSection(
    "SUBBOTS",
    "crea, vigila y administra los slots del bot",
    [
      `Slots: ${stats.maxSlots} | Libres: ${stats.availableSlots} | Activos: ${stats.activeSlots}`,
      `Reservados: ${stats.enabledSlots} | Modo publico: ${stats.publicRequests ? "ON" : "OFF"}`,
      `Rapido: ${prefix}subbot 519xxxxxxxxx`,
      `Panel : ${prefix}subbots`,
    ],
    ordered.map((item) => ({
      command: `${prefix}${item.command}`,
      description: labels[item.command] || item.description || "control de subbots",
    }))
  );
}

function renderSystemSection(prefix, items) {
  const memory = process.memoryUsage();
  const labels = {
    ping: "mide latencia del bot",
    runtime: "muestra cuanto tiempo lleva encendido",
    status: "panel general de estado del bot",
    sysinfo: "host, ram, cpu, node y entorno",
    procinfo: "pid, proceso, handles y sesiones activas",
    botinfo: "resumen del bot, comandos y subbots",
    update: "actualiza desde GitHub y reinicia",
  };
  const order = ["status", "ping", "runtime", "botinfo", "sysinfo", "procinfo", "update"];
  const itemMap = new Map(items.map((item) => [item.command, item]));
  const ordered = [
    ...order.filter((name) => itemMap.has(name)).map((name) => itemMap.get(name)),
    ...items.filter((item) => !order.includes(item.command)),
  ];

  return renderFeatureSection(
    "SISTEMA",
    "monitor del bot, host y proceso actual",
    [
      `Node: ${process.version} | Plataforma: ${os.platform()} ${os.arch()}`,
      `RSS: ${formatBytes(memory.rss)} | Heap: ${formatBytes(memory.heapUsed)}`,
      `Host: ${os.hostname()} | Uptime: ${formatUptime(process.uptime())}`,
      `Debug: ${prefix}whoami | ${prefix}update info`,
    ],
    ordered.map((item) => ({
      command: `${prefix}${item.command}`,
      description: labels[item.command] || item.description || "herramienta del sistema",
    }))
  );
}

function renderCompactCategory(prefix, category, items) {
  const lines = [border("."), centerLine(`${getCategoryLabel(category)} :: ${items.length}`), border(".")];

  for (const item of items) {
    lines.push(...buildWrappedLines(`\`${prefix}${item.command}\` - ${item.description || "sin descripcion"}`, {
      prefix: "- ",
    }));
  }

  lines.push(border("."));
  return lines.join("\n");
}

function buildFooter(prefix) {
  return [
    border("="),
    centerLine("accesos rapidos"),
    border("="),
    padLine(`${prefix}menu | ${prefix}status | ${prefix}botinfo | ${prefix}subbots`),
    border("="),
  ];
}

function buildMenuCaption(settings, comandos) {
  const prefix = getPrefix(settings);
  const categories = buildCategoryMap(comandos);
  const sections = [];

  for (const category of sortCategories(categories)) {
    const items = categories.get(category) || [];
    if (!items.length) continue;

    if (category === "subbots") {
      sections.push(renderSubbotsSection(prefix, items));
      continue;
    }

    if (category === "sistema") {
      sections.push(renderSystemSection(prefix, items));
      continue;
    }

    sections.push(renderCompactCategory(prefix, category, items));
  }

  return [...buildHeader(settings, categories, prefix), ...sections, ...buildFooter(prefix)].join(
    "\n"
  );
}

export default {
  command: ["menu"],
  category: "menu",
  description: "Menu principal con mejor presentacion",

  run: async ({ sock, msg, from, settings, comandos }) => {
    try {
      if (!comandos) {
        return sock.sendMessage(
          from,
          { text: "error interno", ...global.channelInfo },
          { quoted: msg }
        );
      }

      const videoPath = path.join(process.cwd(), "videos", "menu-video.mp4");
      if (!fs.existsSync(videoPath)) {
        return sock.sendMessage(
          from,
          { text: "video del menu no encontrado", ...global.channelInfo },
          { quoted: msg }
        );
      }

      const caption = buildMenuCaption(settings, comandos);

      await sock.sendMessage(
        from,
        {
          video: fs.readFileSync(videoPath),
          mimetype: "video/mp4",
          gifPlayback: true,
          caption,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error("MENU ERROR:", err);
      await sock.sendMessage(
        from,
        { text: "error al mostrar el menu", ...global.channelInfo },
        { quoted: msg }
      );
    }
  },
};
