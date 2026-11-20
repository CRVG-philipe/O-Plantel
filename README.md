# Plantel

Planejador de elencos de futebol para a próxima temporada. Feito com React + Vite.

## Como ver o site no seu computador
Precisa do [Node.js](https://nodejs.org) instalado.

1. Abra esta pasta no VS Code (Arquivo > Abrir pasta) e abra um terminal (Terminal > Novo Terminal).
2. Na primeira vez, instale as dependências:
   ```
   npm install
   ```
3. Rode o site:
   ```
   npm run dev
   ```
   e abra http://localhost:5173 no navegador. Quando você salva um arquivo, a página atualiza sozinha. Para desligar, aperte **Ctrl+C** no terminal.

## Outros comandos
| Comando | O que faz |
|---|---|
| `npm test` | Roda os testes automáticos (simulam cliques no site). |
| `npm run build` | Gera a versão final, otimizada, na pasta `dist/`. |
| `npm run preview` | Mostra a versão do `dist/` em http://localhost:4173, para conferir antes de publicar. |

## Onde fica cada coisa
- `src/componentes/`: as partes da tela (escolha de clube, topo, abas, painel).
- `src/logica/`: as regras (dinheiro, elenco, escalação, mercado).
- `src/estilo.css`: todo o visual.
- `public/`: `data.json` (clubes e jogadores) e imagens.
- `dados-brutos/`: dados coletados e scripts Python que geram o `public/data.json`.

## Publicação
O site está ligado à Vercel: cada `git push` na branch `main` publica uma versão nova automaticamente.

## Como usar o Claude Code aqui
Instale a extensão "Claude Code" no VS Code e abra esta pasta. O arquivo `CLAUDE.md` já explica o projeto inteiro para ele.
