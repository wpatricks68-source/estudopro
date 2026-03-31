export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const {
      mode,
      topic = '',
      panelTitle = '',
      files = [],
      model = 'claude-sonnet-4-6',
      max_tokens = 1400,
      system,
      messages
    } = req.body || {};

    if (mode === 'summary_from_files') {
      const selectedFiles = Array.isArray(files) ? files : [];

      const fileList = selectedFiles.length
        ? selectedFiles.map((f, i) => {
            const name = f && f.file_name ? f.file_name : `arquivo_${i + 1}`;
            const type = f && f.file_type ? f.file_type : 'desconhecido';
            const url = f && f.file_url ? f.file_url : '';
            return `Arquivo ${i + 1}: ${name} | tipo: ${type} | url: ${url}`;
          }).join('\n')
        : 'Nenhum arquivo informado.';

      const prompt = [
        'Você é um professor especialista em concursos públicos.',
        'Gere um resumo claro, didático e objetivo em português do Brasil.',
        '',
        `Painel: ${panelTitle || 'Sem título'}`,
        `Tema: ${topic || 'Tema não informado'}`,
        '',
        'Arquivos selecionados como base:',
        fileList,
        '',
        'Importante:',
        '- Se os arquivos vierem apenas com nome e URL, use essas referências como contexto nominal.',
        '- Se não houver conteúdo textual dos arquivos disponível, ainda produza um resumo útil sobre o tema.',
        '- Organize em tópicos curtos.',
        '- Foque em revisão para estudo.'
      ].join('\n');

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      const data = await anthropicRes.json();

      if (!anthropicRes.ok) {
        return res.status(anthropicRes.status).json({
          error: data && data.error && data.error.message ? data.error.message : 'Anthropic request failed',
          raw: data
        });
      }

      const summary = data && data.content
        ? data.content.map(part => part && part.text ? part.text : '').join('\n').trim()
        : '';

      return res.status(200).json({
        summary,
        raw: data
      });
    }

    if (Array.isArray(messages)) {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens,
          system: system || 'Responda em português do Brasil.',
          messages
        })
      });

      const data = await anthropicRes.json();

      if (!anthropicRes.ok) {
        return res.status(anthropicRes.status).json({
          error: data && data.error && data.error.message ? data.error.message : 'Anthropic request failed',
          raw: data
        });
      }

      return res.status(200).json(data);
    }

    return res.status(400).json({
      error: 'Invalid payload. Use mode="summary_from_files" or send messages.'
    });
  } catch (error) {
    return res.status(500).json({
      error: error && error.message ? error.message : 'Internal server error'
    });
  }
}
