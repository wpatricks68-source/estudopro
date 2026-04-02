export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    const { mode, topic = "", panelTitle = "", files = [] } = req.body || {};

    if (mode === "summary_from_files") {
      if (!files.length) {
        return res.status(400).json({ error: "No files provided" });
      }

      const extracted = [];

      for (const file of files) {
        if (!file.file_url) continue;

        try {
          const response = await fetch(file.file_url);
          if (!response.ok) continue;

          const buffer = Buffer.from(await response.arrayBuffer());
          let text = "";

          if (file.file_name.toLowerCase().endsWith(".pdf")) {
            const pdfParse = (await import("pdf-parse")).default;
            const parsed = await pdfParse(buffer);
            text = parsed.text || "";
          } else {
            text = buffer.toString("utf-8");
          }

          if (text) extracted.push(text.slice(0, 15000));

        } catch (err) {
          console.error("Erro arquivo:", err);
        }
      }

      if (!extracted.length) {
        return res.status(400).json({ error: "Nenhum conteúdo válido" });
      }

      const prompt = `
Você é um professor especialista em concursos.

Crie um resumo organizado, claro e focado em prova.

${extracted.join("\n")}
`;

      const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await aiResponse.json();

      const summary = data.content?.map(c => c.text).join("\n") || "";

      return res.status(200).json({ summary });
    }

    return res.status(400).json({ error: "Modo inválido" });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
