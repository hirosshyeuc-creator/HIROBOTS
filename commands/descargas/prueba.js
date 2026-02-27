import axios from 'axios';  // Necesitas instalar axios usando `npm install axios`
import yts from 'yt-search';  // Necesitas instalar yt-search usando `npm install yt-search`
import fs from 'fs';
import path from 'path';

const API_KEY = 'DvYer159'; // Tu API Key
const TMP_DIR = path.join(process.cwd(), 'ytmp4');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

const BASE_URL = 'https://api-sky.ultraplus.click'; // Base URL del servidor de la API

export default {
  command: ['ytmp1'],
  category: 'descarga',

  run: async (ctx) => {
    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.msg || null;

    if (!args.length) {
      return sock.sendMessage(from, {
        text: "❌ Uso: .ytmp1 <link o nombre del video>",
        ...global.channelInfo,
      });
    }

    try {

      let query = args.join(' ');
      let videoUrl = query;

      // Si no es link, hacer búsqueda con yt-search
      if (!/^https?:\/\//i.test(query)) {
        const search = await yts(query);
        if (!search.videos.length) {
          throw new Error('No se encontró el video');
        }
        videoUrl = search.videos[0].url;
      }

      // Obtener enlace en 360p con /resolve
      const resolve = await axios.post(
        `${BASE_URL}/youtube-mp4/resolve`,
        {
          url: videoUrl,
          type: 'video',
          quality: '360',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': API_KEY,
          },
        }
      );

      const rel = resolve.data?.result?.media?.dl_download;
      if (!rel) throw new Error('No se encontró enlace de descarga');

      // Construir la URL completa usando la URL base
      const downloadUrl = BASE_URL + rel;
      console.log('Enlace de descarga:', downloadUrl);  // Depuración: Verificar el enlace de descarga completo

      // 2) Descargar el archivo
      const videoFilePath = path.join(TMP_DIR, 'video_360p.mp4');
      const writer = fs.createWriteStream(videoFilePath);

      const videoRes = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream',
      });

      videoRes.data.pipe(writer);

      // Cuando el archivo se haya descargado
      writer.on('finish', async () => {
        await sock.sendMessage(
          from,
          {
            video: fs.readFileSync(videoFilePath),
            mimetype: 'video/mp4',
            caption: `🎬 Video descargado en 360p`,
            ...global.channelInfo,
          },
          msg?.key ? { quoted: msg } : undefined
        );

        // Eliminar el archivo temporal después de enviarlo
        fs.unlinkSync(videoFilePath);
      });

      writer.on('error', (err) => {
        throw new Error('Error al guardar el archivo de video: ' + err.message);
      });

    } catch (err) {
      console.error('❌ Error en YTMP1:', err);
      await sock.sendMessage(
        from,
        { text: '❌ No se pudo descargar el video' },
        msg ? { quoted: msg } : undefined
      );
    }
  }
};
