import axios from "axios";

const API_KEY = "dvyer";
const API_URL = "https://api-adonix.ultraplus.click/download/mediafire";
const MAX_MB = 300;

export default {
  command: ["mediafire", "mf"],
  category: "descarga",

  run: async ({ sock, from, args }) => {
    try {

      if (!args[0]) {
        return sock.sendMessage(from, {
          text: "❌ Usa:\n.mf <link de mediafire>"
        });
      }

      const url = args[0];

      if (!url.includes("mediafire.com")) {
        return sock.sendMessage(from, {
          text: "❌ Enlace inválido."
        });
      }

      await sock.sendMessage(from, {
        text: "📥 Procesando enlace..."
      });

      // 🔹 1️⃣ Obtener datos desde tu API
      const api = `${API_URL}?apikey=${API_KEY}&url=${encodeURIComponent(url)}`;
      const { data } = await axios.get(api);

      if (!data.status || !data.result?.link) {
        throw new Error("API inválida");
      }

      const file = data.result;

      // 🔹 2️⃣ Detectar tamaño real
      let sizeMB = 0;

      if (file.size?.includes("MB")) {
        sizeMB = parseFloat(file.size);
      } else if (file.size?.includes("GB")) {
        sizeMB = parseFloat(file.size) * 1024;
      }

      // 🔹 3️⃣ Si supera límite → solo enviar link
      if (sizeMB > MAX_MB) {
        return sock.sendMessage(from, {
          text:
            `📁 *MediaFire Downloader*\n\n` +
            `📄 Archivo: ${file.filename}\n` +
            `📦 Tamaño: ${file.size}\n\n` +
            `⚠️ Supera el límite de ${MAX_MB}MB\n\n` +
            `🔗 Descargar:\n${file.link}`
        });
      }

      await sock.sendMessage(from, {
        text: `⚡ Descargando archivo (${file.size})...`
      });

      // 🔹 4️⃣ Descargar como stream
      const response = await axios({
        method: "GET",
        url: file.link,
        responseType: "arraybuffer", // 🔥 MÁS ESTABLE QUE STREAM
        timeout: 0,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const buffer = Buffer.from(response.data);

      // 🔹 5️⃣ Detectar mimetype automáticamente
      const contentType = response.headers["content-type"] || "application/octet-stream";

      // 🔹 6️⃣ Enviar correctamente según tipo
      await sock.sendMessage(from, {
        document: buffer,
        fileName: file.filename,
        mimetype: contentType,
        caption:
          `📁 *MediaFire Downloader*\n\n` +
          `📄 Archivo: ${file.filename}\n` +
          `📦 Tamaño: ${file.size}\n\n` +
          `🤖 SonGokuBot`
      });

    } catch (err) {

      console.error("MEDIAFIRE ERROR:", err);

      await sock.sendMessage(from, {
        text: "❌ Error enviando archivo."
      });

    }
  }
};
