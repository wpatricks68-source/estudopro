export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

    const { mode, topic = "", panelTitle = "", files = [], model = "claude-3-5-sonnet-20241022", max_tokens = 2200 } = req.body || {};
    const selectedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!selectedFiles.length) return res.status(400).json({ error: "No files provided" });

    const extracted = [];
    for (const file of selectedFiles) {
      if (!file.file_url) continue;
      const response = await fetch(file.file_url);
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      let text = "";
      if ((file.file_name || "").toLowerCase().endsWith(".pdf")) {
        const pdfParse = (await import("pdf-parse")).default;
        const parsed = await pdfParse(buffer);
        text = parsed?.text || "";
      } else {
        text = buffer.toString("utf-8");
      }
      text = String(text || "").trim();
      if (text) extracted.push(text.slice(0, 18000));
    }

    if (!extracted.length) return res.status(400).json({ error: "Nenhum arquivo válido" });

    const content = extracted.join("\\n\\n");
    let instruction = "";

    if (mode === "summary_from_files") {
      instruction = "Crie um resumo claro, organizado em tópicos e focado em prova.";
    } else if (mode === "questions_from_files") {
      instruction = 'Gere exatamente 10 questões de múltipla escolha em JSON puro no formato {"questions":[{"prompt":"", "options":["","","",""], "correct_answer":"A"}]}.';
    } else if (mode === "flashcards_from_files") {
      instruction = 'Gere exatamente 20 flashcards em JSON puro no formato {"flashcards":[{"front":"", "back":""}]}.';
    } else {
      return res.status(400).json({ error: "Modo inválido" });
    }

    const prompt = `Tema: ${topic}\\nPainel: ${panelTitle}\\n\\n${instruction}\\n\\nCONTEÚDO:\\n${content}`;

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
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await aiResponse.json();
    if (!aiResponse.ok) return res.status(aiResponse.status).json({ error: data?.error?.message || "Erro na Anthropic", raw: data });

    const rawText = Array.isArray(data.content) ? data.content.map(c => c.text || "").join("\\n") : "";

    if (mode === "summary_from_files") {
      return res.status(200).json({ summary: rawText });
    }

    const clean = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (mode === "questions_from_files") return res.status(200).json({ questions: Array.isArray(parsed.questions) ? parsed.questions : [] });
    if (mode === "flashcards_from_files") return res.status(200).json({ flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [] });

    return res.status(400).json({ error: "Modo inválido" });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
