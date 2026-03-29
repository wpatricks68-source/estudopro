# ConcursoPrep - projeto pronto para GitHub e Vercel

Este pacote já está organizado para subir no GitHub e fazer deploy na Vercel.

## Estrutura

- `index.html` - app principal
- `api/chat.js` - proxy para Claude via Vercel
- `api/supabase-config.js` - entrega as chaves públicas do Supabase para o front
- `vercel.json` - rotas e build da Vercel
- `supabase-schema.sql` - tabela e políticas do banco
- `.gitignore` - arquivos ignorados no repositório

## O que foi corrigido

- arquivos da API movidos para a pasta correta `api/`
- login com Google reforçado com fluxo PKCE no Supabase
- tratamento melhor do retorno do OAuth
- limpeza da URL após callback
- mensagens de erro de autenticação mais claras
- `chat.js` mais robusto e com modelo configurável por variável de ambiente

## 1) Criar o projeto no Supabase

No Supabase, crie um projeto e rode o SQL do arquivo `supabase-schema.sql` no SQL Editor.

## 2) Ativar login com Google

No Supabase:

- Authentication -> Providers -> Google -> Enable
- informe o `Client ID` e `Client Secret` do Google Cloud

No Google Cloud Console:

- crie credenciais OAuth 2.0
- adicione como Authorized redirect URI:
  - `https://SEU-PROJETO.supabase.co/auth/v1/callback`

No Supabase:

- Authentication -> URL Configuration
- adicione em Redirect URLs:
  - `https://SEU-SITE.vercel.app`
  - `http://localhost:3000`

## 3) Variáveis de ambiente na Vercel

Crie estas variáveis:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (opcional)

## 4) Deploy

- suba esta pasta para um repositório no GitHub
- importe o repositório na Vercel
- configure as variáveis de ambiente
- faça o deploy

## 5) Teste do login

Depois do deploy:

- abra o site
- clique em `Entrar com Google`
- autorize a conta
- você deve voltar para o app já autenticado

Se não funcionar, quase sempre é um destes pontos:

- Redirect URL faltando no Supabase
- Redirect URI errada no Google Cloud
- `SUPABASE_URL` ou `SUPABASE_ANON_KEY` errados na Vercel

## Observação

O banco usado pelo app é a tabela `public.user_data`, com uma linha por usuário.
