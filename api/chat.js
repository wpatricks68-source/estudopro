export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    const {
      mode,
      topic = "",
      panelTitle = "",
      files = [],
      model = "claude-3-5-sonnet-20241022",
      max_tokens = 1800
    } = req.body || {};

    // 🔥 MODO: RESUMO BASEADO EM ARQUIVOS
    if (mode === "summary_from_files") {

      const extracted = [];
      const skipped = [];

      for (const file of files) {
        const fileName = file.file_name || "arquivo";
        const fileUrl = file.file_url;

        if (!fileUrl) {
          skipped.push({ file: fileName, reason: "sem URL" });
          continue;
        }

        try {
          const response = await fetch(fileUrl);
          const buffer = Buffer.from(await response.arrayBuffer());

          let text = "";

          // 📄 PDF
          if (fileName.toLowerCase().endsWith(".pdf")) {
            const pdfParse = (await import("pdf-parse")).default;
            const parsed = await pdfParse(buffer);
            text = parsed.text;
          }

          // 📄 TXT
          else {
            text = buffer.toString("utf-8");
          }

          if (!text) {
            skipped.push({ file: fileName, reason: "texto vazio" });
            continue;
          }

          extracted.push({
            file_name: fileName,
            text: text.slice(0, 15000)
          });

        } catch (err) {
          skipped.push({ file: fileName, reason: "erro leitura" });
        }
      }

      if (!extracted.length) {
        return res.status(400).json({
          error: "Nenhum arquivo válido",
          skipped
        });
      }

      const compiledText = extracted.map((f, i) => {
        return `ARQUIVO ${i + 1}: ${f.file_name}\n${f.text}\n`;
      }).join("\n");

      const prompt = `
Você é um professor especialista em concursos públicos.

Gere um resumo claro, organizado e direto.

Tema: ${topic}
Painel: ${panelTitle}

Regras:
- usar tópicos
- destacar pontos importantes
- foco em prova
- linguagem simples

CONTEÚDO:
${compiledText}
`;

      const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model,
          max_tokens,
          messages: [
            { role: "user", content: prompt }
          ]
        })
      });

      const data = await aiResponse.json();

      if (!aiResponse.ok) {
        return res.status(500).json(data);
      }

      const summary = data.content.map(c => c.text).join("\n");

      return res.status(200).json({
        summary,
        arquivos_lidos: extracted.map(f => f.file_name),
        ignorados: skipped
      });
    }

    return res.status(400).json({
      error: "Modo inválido"
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
}
