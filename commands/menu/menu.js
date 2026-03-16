import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function getPrimaryPrefix(settings) {
  if (Array.isArray(settings?.prefix)) {
    return settings.prefix.find((value) => String(value || "").trim()) || ".";
  }

  return String(settings?.prefix || ".").trim() || ".";
}

function getPrefixLabel(settings) {
  if (Array.isArray(settings?.prefix)) {
    const values = settings.prefix
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    return values.length ? values.join(" | ") : ".";
  }

  return String(settings?.prefix || ".").trim() || ".";
}

export default {
  command: ["menu"],
  category: "menu",
  description: "Menu principal con diseno premium",

  run: async ({ sock, msg, from, settings, comandos }) => {
    try {
      if (!comandos) {
        return sock.sendMessage(
          from,
          { text: "❌ error interno", ...global.channelInfo },
          { quoted: msg }
        );
      }

      const videoPath = path.join(process.cwd(), "videos", "menu-video.mp4");
      if (!fs.existsSync(videoPath)) {
        return sock.sendMessage(
          from,
          { text: "❌ video del menu no encontrado", ...global.channelInfo },
          { quoted: msg }
        );
      }

      const uptime = formatUptime(process.uptime());
      const primaryPrefix = getPrimaryPrefix(settings);
      const prefixLabel = getPrefixLabel(settings);
      const categorias = {};

      for (const cmd of new Set(comandos.values())) {
        if (!cmd?.category || !cmd?.command) continue;

        const cat = String(cmd.category).toLowerCase();
        const principal = cmd.name || (Array.isArray(cmd.command) ? cmd.command[0] : cmd.command);

        if (!principal) continue;

        if (!categorias[cat]) categorias[cat] = new Set();
        categorias[cat].add(String(principal).toLowerCase());
      }

      let menu = `
╭══════════════════════╮
│ ✦ *${settings.botName}* ✦
╰══════════════════════╯

▸ _prefijos_ : *${prefixLabel}*
▸ _estado_   : *online*
▸ _uptime_   : *${uptime}*

┌──────────────────────┐
│ ✧ *MENU DE COMANDOS* ✧
└──────────────────────┘
`;

      for (const cat of Object.keys(categorias).sort()) {
        const lista = Array.from(categorias[cat]).sort();

        menu += `
╭─ ❖ *${cat.toUpperCase()}*
│`;

        for (const c of lista) {
          menu += `\n│  • \`${primaryPrefix}${c}\``;
        }

        menu += `
╰──────────────────────`;
      }

      menu += `

┌──────────────────────┐
│ ✦ _bot premium activo_
└──────────────────────┘
_artoria bot vip_
`;

      await sock.sendMessage(
        from,
        {
          video: fs.readFileSync(videoPath),
          mimetype: "video/mp4",
          gifPlayback: true,
          caption: menu.trim(),
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    } catch (err) {
      console.error("MENU ERROR:", err);
      await sock.sendMessage(
        from,
        { text: "❌ error al mostrar el menu", ...global.channelInfo },
        { quoted: msg }
      );
    }
  },
};
