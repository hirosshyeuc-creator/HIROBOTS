import fs from "fs";
import path from "path";
import { formatCoins, formatUserLabel, getTopCoins } from "./_shared.js";

function buildTopDolaresMessage(caption) {
  const imagePath = path.join(process.cwd(), "imagenes", "topdolares.png");

  if (fs.existsSync(imagePath)) {
    return {
      image: fs.readFileSync(imagePath),
      caption,
      ...global.channelInfo,
    };
  }

  return {
    text: caption,
    ...global.channelInfo,
  };
}

export default {
  name: "topdolares",
  command: ["topdolares", "rankdolares", "topcoins", "coinstop", "rankcoins", "rankdolaressemana"],
  category: "economia",
  description: "Muestra el ranking de dolares",

  run: async ({ sock, msg, from }) => {
    const leaderboard = getTopCoins(10);

    await sock.sendMessage(
      from,
      buildTopDolaresMessage(
        `*TOP DOLARES*\n\n` +
          `${leaderboard.length
            ? leaderboard
                .map(
                  (entry, index) =>
                    `${index + 1}. ${formatUserLabel(entry.id)} - *${formatCoins(entry.total)}*`
                )
                .join("\n")
            : "Todavia no hay jugadores con dolares."}`
      ),
      { quoted: msg }
    );
  },
};
