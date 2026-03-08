import fs from "fs";
import path from "path";
import yts from "yt-search";
import ytdlp from "yt-dlp-exec";

const TMP_DIR = "./tmp";

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

export default {

  command: ["ytplay","play"],
  category: "descarga",

  run: async (ctx) => {

    const { sock, from, args } = ctx;
    const msg = ctx.m || ctx.msg;

    const quoted = msg?.key ? { quoted: msg } : undefined;

    if (!args.length) {
      return sock.sendMessage(from,{
        text:"❌ Uso: .play <nombre del video>"
      },quoted);
    }

    try {

      const query = args.join(" ");

      await sock.sendMessage(from,{
        text:"🔎 Buscando en YouTube..."
      },quoted);

      const search = await yts(query);

      const video = search.videos[0];

      if (!video) {
        return sock.sendMessage(from,{
          text:"❌ No se encontró el video"
        },quoted);
      }

      const title = video.title.replace(/[\\/:*?"<>|]/g,"");
      const url = video.url;

      const file = path.join(TMP_DIR, `${Date.now()}.mp4`);

      await sock.sendMessage(from,{
        text:`⬇️ Descargando:\n🎬 ${title}`
      },quoted);

      await ytdlp(url,{
        format:"mp4",
        output:file
      });

      await sock.sendMessage(from,{
        video:{ url:file },
        mimetype:"video/mp4",
        caption:`🎬 ${title}`
      },quoted);

      fs.unlinkSync(file);

    } catch(err){

      console.log("YTPLAY ERROR:",err);

      await sock.sendMessage(from,{
        text:"❌ Error al descargar el video"
      });

    }

  }

};
