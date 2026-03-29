ESTRUTURA CORRETA PARA VERCEL

/index.html
/vercel.json
/supabase-schema.sql
/api/chat.js
/api/supabase-config.js

PASSOS:
1. Apague os arquivos chat.js e supabase-config.js da raiz do repo, se existirem.
2. Crie a pasta api na raiz.
3. Coloque chat.js e supabase-config.js dentro de /api.
4. Mantenha vercel.json na raiz.
5. Redeploy na Vercel.

VARIAVEIS DE AMBIENTE NA VERCEL:
SUPABASE_URL
SUPABASE_ANON_KEY
ANTHROPIC_API_KEY
