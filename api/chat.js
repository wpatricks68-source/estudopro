export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

    const {
      mode,
      topic = "",
      panelTitle = "",
      files = [],
    } = req.body || {};

    // ── modelo e tokens corretos ──────────────────────────────
    const MODEL      = "claude-sonnet-4-5";   // Sonnet 4.6 (nome correto na API)
    const MAX_TOKENS = 8000;                   // suficiente para flashcards + resumos longos

    const selectedFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    if (!selectedFiles.length)
      return res.status(400).json({ error: "Marque ao menos um arquivo antes de gerar." });

    // ── extrai texto dos arquivos ─────────────────────────────
    const extracted = [];
    for (const file of selectedFiles) {
      if (!file.file_url) continue;
      try {
        const response = await fetch(file.file_url);
        if (!response.ok) continue;
        const buffer = Buffer.from(await response.arrayBuffer());
        let text = "";
        if ((file.file_name || "").toLowerCase().endsWith(".pdf")) {
          const pdfParse = (await import("pdf-parse")).default;
          const parsed   = await pdfParse(buffer);
          text = parsed?.text || "";
        } else {
          text = buffer.toString("utf-8");
        }
        text = String(text || "").trim();
        if (text) extracted.push(text.slice(0, 18000));
      } catch (_) {
        // ignora arquivos que falharem individualmente
      }
    }

    if (!extracted.length)
      return res.status(400).json({ error: "Nenhum arquivo válido ou com conteúdo legível." });

    const content = extracted.join("\n\n");

    // ── monta instrução por modo ──────────────────────────────
    let instruction = "";
    let expectJson  = false;

    if (mode === "summary_from_files") {
      instruction = `Crie um resumo completo, claro e organizado em tópicos sobre o tema abaixo.
Foque nos pontos mais cobrados em provas de concurso público.
Use linguagem direta. Não inclua introduções genéricas.`;

    } else if (mode === "questions_from_files") {
      expectJson  = true;
      instruction = `Gere EXATAMENTE 10 questões de múltipla escolha com base no conteúdo abaixo.
Responda APENAS com JSON puro, sem texto antes ou depois, sem markdown, sem blocos de código.
Formato obrigatório:
{"questions":[{"prompt":"texto da questão","options":["opção A","opção B","opção C","opção D"],"correct_answer":"A"}]}
- correct_answer deve ser a LETRA (A, B, C ou D) da opção correta.
- Todas as questões devem ter exatamente 4 opções.`;

    } else if (mode === "flashcards_from_files") {
      expectJson  = true;
      instruction = `Gere EXATAMENTE 20 flashcards com base no conteúdo abaixo.
Responda APENAS com JSON puro, sem texto antes ou depois, sem markdown, sem blocos de código.
Formato obrigatório:
{"flashcards":[{"front":"pergunta ou conceito","back":"resposta ou definição"}]}
- front: pergunta curta ou termo
- back: resposta objetiva (máximo 3 linhas)`;

    } else {
      return res.status(400).json({ error: "Modo inválido: " + mode });
    }

    const prompt = `Tema: ${topic}\nPainel: ${panelTitle}\n\n${instruction}\n\nCONTEÚDO DO MATERIAL:\n${content}`;

    // ── chamada à API da Anthropic ────────────────────────────
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    const data = await aiResponse.json();

    if (!aiResponse.ok) {
      console.error("Anthropic API error:", data);
      return res.status(aiResponse.status).json({
        error: data?.error?.message || "Erro na API da Anthropic",
        raw:   data,
      });
    }

    // ── extrai texto da resposta ──────────────────────────────
    const rawText = Array.isArray(data.content)
      ? data.content.map((c) => c.text || "").join("\n")
      : "";

    if (!rawText.trim())
      return res.status(500).json({ error: "A IA retornou uma resposta vazia." });

    // ── retorno por modo ──────────────────────────────────────
    if (mode === "summary_from_files") {
      return res.status(200).json({ summary: rawText });
    }

    // Para questões e flashcards: extrai JSON de forma robusta
    let parsed;
    try {
      // Remove possíveis blocos markdown mesmo quando o modelo desobedece
      const clean = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();

      // Tenta localizar o JSON dentro da resposta caso haja texto ao redor
      const jsonStart = clean.indexOf("{");
      const jsonEnd   = clean.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1)
        throw new Error("Nenhum JSON encontrado na resposta da IA.");

      parsed = JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr.message, "\nRaw:", rawText.slice(0, 500));
      return res.status(500).json({
        error: "A IA não retornou um JSON válido. Tente novamente.",
        raw:   rawText.slice(0, 500),
      });
    }

    if (mode === "questions_from_files") {
      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
      if (!questions.length)
        return res.status(500).json({ error: "Nenhuma questão foi gerada. Tente novamente." });
      return res.status(200).json({ questions });
    }

    if (mode === "flashcards_from_files") {
      const flashcards = Array.isArray(parsed.flashcards) ? parsed.flashcards : [];
      if (!flashcards.length)
        return res.status(500).json({ error: "Nenhum flashcard foi gerado. Tente novamente." });
      return res.status(200).json({ flashcards });
    }

    return res.status(400).json({ error: "Modo inválido" });

  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
