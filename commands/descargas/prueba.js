export default {
  name: "play",
  command: ["play"],
  category: "music",

  run: async ({ sock, msg, from, args = [], enviarBotonesInteractive, enviarListaInteractive }) => {
    try {
      if (!sock || !from) return;

      const query = Array.isArray(args) ? args.join(" ").trim() : String(args ?? "").trim();
      const q = query.replace(/\s+/g, " "); // normaliza espacios

      // Log útil sin spamear
      console.log("[PLAY] from:", from, "query:", q);

      // ✅ Sin query: ayuda / UI si existe
      if (!q) {
        return await mostrarAyudaPlay({
          sock,
          from,
          msg,
          enviarBotonesInteractive,
          enviarListaInteractive,
        });
      }

      // ✅ Protección: query demasiado larga
      if (q.length > 120) {
        return await sock.sendMessage(
          from,
          { text: "⚠️ Tu búsqueda es muy larga. Escribe una más corta (máx 120 caracteres)." },
          { quoted: msg }
        );
      }

      // ✅ Respuesta demo
      await sock.sendMessage(
        from,
        { text: `🔎 Buscando: *${q}*\n\n(Demo) Luego lo conectamos a YouTube/audio real.` },
        { quoted: msg }
      );

      // 🔌 Aquí después conectamos a yt-search y devolvemos opciones
      // Ejemplo futuro:
      // const results = await buscarEnYouTube(q);
      // await enviarListaDeResultados(...)

    } catch (err) {
      console.error("[PLAY] Error:", err);
      try {
        await sock.sendMessage(from, { text: "❌ Error en *play*. Revisa consola." }, { quoted: msg });
      } catch {}
    }
  },
};

async function mostrarAyudaPlay({ sock, from, msg, enviarBotonesInteractive, enviarListaInteractive }) {
  const hasButtons = typeof enviarBotonesInteractive === "function";
  const hasList = typeof enviarListaInteractive === "function";

  // Si no tienes UI interactiva conectada aún, manda texto limpio
  if (!hasButtons || !hasList) {
    await sock.sendMessage(
      from,
      {
        text:
          "🎵 *PLAY*\n\n" +
          "Usa:\n" +
          "• *.play <canción o artista>*\n" +
          "Ej:\n" +
          "• *.play yellow coldplay*\n" +
          "• *.play bad bunny un verano*\n\n" +
          "ℹ️ (Aún no está conectada la UI interactiva.)",
      },
      { quoted: msg }
    );
    return;
  }

  // Si sí tienes UI, muestra botones + lista (demo)
  await enviarBotonesInteractive(
    sock,
    from,
    "🎵 *PLAY* (Demo)\n\nElige una opción:",
    [
      { text: "🔎 Buscar", id: "play_buscar" },
      { text: "📃 Lista", id: "play_lista" },
      { text: "❌ Cancelar", id: "play_cancelar" },
    ],
    msg
  );

  await enviarListaInteractive(
    sock,
    from,
    "📃 *PLAY* (Demo)\n\nAbre la lista y elige:",
    "Opciones PLAY",
    [
      {
        title: "Acciones",
        rows: [
          { id: "play_buscar", title: "🔎 Buscar", description: "Buscar una canción/video" },
          { id: "play_top", title: "🔥 Top", description: "Ver opciones populares" },
          { id: "play_ayuda", title: "❓ Ayuda", description: "Cómo usar play" },
        ],
      },
    ],
    msg
  );
}

