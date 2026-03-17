import * as baileys from "@whiskeysockets/baileys";
import { getPrefix } from "../sistema/_shared.js";

const generateWAMessageFromContent = baileys.generateWAMessageFromContent;
const proto = baileys.proto;

function buildLegacyButtons(buttons = []) {
  return buttons.map((button) => ({
    buttonId: button.id,
    buttonText: { displayText: button.text },
    type: 1,
  }));
}

async function sendNativeQuickReplyButtons({
  sock,
  from,
  msg,
  title,
  text,
  footer,
  buttons,
}) {
  if (!proto?.Message?.InteractiveMessage || typeof generateWAMessageFromContent !== "function") {
    throw new Error("InteractiveMessage no disponible");
  }

  const content = proto.Message.fromObject({
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
        },
        interactiveMessage: proto.Message.InteractiveMessage.create({
          header: proto.Message.InteractiveMessage.Header.create({
            title,
            hasMediaAttachment: false,
          }),
          body: proto.Message.InteractiveMessage.Body.create({
            text,
          }),
          footer: proto.Message.InteractiveMessage.Footer.create({
            text: footer,
          }),
          nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: buttons.map((button) => ({
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: button.text,
                id: button.id,
              }),
            })),
          }),
        }),
      },
    },
  });

  const waMessage = generateWAMessageFromContent(from, content, {
    quoted: msg,
    userJid: sock.user?.id,
  });

  await sock.relayMessage(from, waMessage.message, { messageId: waMessage.key.id });
}

export default {
  name: "botones",
  command: ["botones", "buttons", "menubotones"],
  category: "menu",
  description: "Envia botones para ejecutar comandos con un toque",

  run: async ({ sock, msg, from, settings }) => {
    const prefix = getPrefix(settings);
    const buttons = [
      { text: "Ping", id: `${prefix}ping` },
      { text: "Menu", id: `${prefix}menu` },
      { text: "Prueba", id: `${prefix}botonok` },
    ];

    const title = `${settings?.botName || "DVYER"} - Botones`;
    const text =
      "Toca un boton y el bot ejecutara el comando al instante.\n\n" +
      `Prueba directa: ${prefix}botonok`;
    const footer = "DVYER BOT";

    try {
      await sendNativeQuickReplyButtons({
        sock,
        from,
        msg,
        title,
        text,
        footer,
        buttons,
      });
    } catch (error) {
      console.warn("BOTONES fallback:", error?.message || error);

      await sock.sendMessage(
        from,
        {
          text,
          footer,
          buttons: buildLegacyButtons(buttons),
          headerType: 1,
          ...global.channelInfo,
        },
        { quoted: msg }
      );
    }
  },
};
