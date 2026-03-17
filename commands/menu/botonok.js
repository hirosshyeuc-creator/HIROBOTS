import { getPrefix } from "../sistema/_shared.js";

export default {
  name: "botonok",
  command: ["botonok", "botonprueba", "testbutton"],
  category: "menu",
  description: "Confirma que los botones ejecutan comandos",

  run: async ({ sock, msg, from, settings, botLabel }) => {
    const prefix = getPrefix(settings);
    const label = String(botLabel || settings?.botName || "BOT").toUpperCase();

    return sock.sendMessage(
      from,
      {
        text:
          `OK, el boton funciono correctamente.\n\n` +
          `Bot activo: ${label}\n` +
          `Comando ejecutado: ${prefix}botonok\n` +
          `Si quieres volver a probar, usa: ${prefix}botones`,
        ...global.channelInfo,
      },
      { quoted: msg }
    );
  },
};
