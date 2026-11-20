# Plantel: planejador de elencos de futebol

Contexto do projeto para o Claude Code. O dono é Philipe, que está aprendendo a programar. Explique as mudanças em português, de forma simples.

## O que é
Site para planejar o elenco de um clube na próxima temporada. O usuário pode:
- decidir quem fica, é vendido, emprestado ou liberado;
- contratar de outros clubes ou criar jogadores;
- montar o time titular;
- ver um resumo com caixa, profundidade por posição, idade e quem chega e quem sai.

Foi inspirado no reconstruindo.thefenomeno.com, mas **não deve copiá-lo**. O foco aqui é planejamento, com um visual clean e minimalista.

## Ligas (214 clubes, ~6.265 jogadores)
BRA (Brasileirão A), BRB (Série B), ENG, ESP, ITA, GER, FRA, ARG, SAU (Saudita), USA (MLS).

## Comandos (na raiz do projeto)
- `npm install`: instala as dependências (só na primeira vez ou quando o package.json mudar).
- `npm run dev`: roda o site em http://localhost:5173 e atualiza ao salvar.
- `npm test`: testes automáticos (`testes/app.test.jsx`, cliques simulados com vitest + jsdom). Rodar depois de qualquer mudança.
- `npm run build`: gera a versão final em `dist/` (não vai para o git). `npm run preview` serve o `dist/` para conferir.

## Estrutura
React 19 + Vite 6, em JavaScript (sem TypeScript).
- `index.html`: só a casca (fonte Inter e `<div id="root">`).
- `src/main.jsx`: liga o React na página e importa `src/estilo.css` (o CSS inteiro, num arquivo só).
- `src/App.jsx`: carrega o `data.json`. Enquanto carrega ou se der erro, mostra a casca.
- `src/Plantel.jsx`: estado e ações do app (plano aberto, aba, filtros, painel, aviso). Monta um objeto `app` com dados e ações e passa para todos os componentes.
  - Mudanças no plano sempre passam por `app.mudar(fn)`: ele copia o plano, aplica `fn`, chama `completarTime` e salva.
  - Painéis abrem com `app.abrirPainel(tipo, args)`. Os tipos estão em `PAINEIS`.
- `src/componentes/`: `EscolhaClube`, `Topo` (resumo e abas), `Elenco`, `Mercado`, `Time`, `Resumo`, `Painel` (o painel que sobe de baixo), `Imagens` (`Foto` e `Escudo`) e `Rodape`.
  - `paineis/`: o conteúdo de cada painel (`PainelJogador`, `PainelCompra`, `PainelFiltros`, `PainelCriar`, `PainelClube`, `PainelOrcamento`, `PainelPosicao`) e `comum.jsx`.
  - `Congelado` (em `Painel.jsx`) congela o conteúdo enquanto o painel fecha, para ele sumir sem piscar.
- `src/logica/`: funções sem tela.
  - `dados.js`: carrega e indexa os dados no objeto `D`.
  - `constantes.js`: posições, formações e compatibilidade.
  - `dinheiro.js`: `eur` e caixa.
  - `elenco.js`: plano, elenco, saídas, alertas e texto do resumo.
  - `escalacao.js`: escalar, completar e encaixar.
  - `mercado.js`: busca e filtros.
  - `formato.js`: textos (datas, nomes curtos, iniciais).
  - `armazenamento.js`: ler e salvar no localStorage.
- `public/data.json`: `{leagues, clubs, updated}`.
  - Cada clube: `{k, lg, n, coach, c, c2, hd, p:[...]}`. `hd` = ID do time no Sofascore se `public/img/teams/<hd>.webp` existe, senão 0 (aí o site mostra "+" no lugar do escudo).
  - Cada jogador: `[número, nome, posição, nascimento, fim_contrato "AAAA-MM", valor_em_€mi, nacionalidade, índice_foto, stats, hd]`. `hd` = ID do jogador no Sofascore se `public/img/players/<hd>.webp` existe, senão 0.
  - `stats` = `[jogos, gols, assistências, nota]` (temporada atual, todas as competições de clube) ou `null`.
  - Posições: GOL ZAG LD LE VOL MC MEI MD ME PD PE SA CA.
- `public/img/p_<LIGA>.webp`: sprite de fotos (32 colunas, células de 48px). `índice_foto` aponta para a célula; -1 = sem foto.
- `public/img/teams/<id>.webp`: escudos em alta (214, 160×160 px, fundo transparente), nomeados pelo ID do Sofascore. Não há mais sprite de escudos.
- `vercel.json`: a Vercel roda `npm run build` e publica `dist/`. Cada `git push` na `main` publica uma versão nova.
- `dados-brutos/`: dados coletados em 20/11/2026 e scripts Python que geram o data.json.
  - `tm_all.json` + `tm_extra.json`: Transfermarkt.
  - `sofa_all.json`: Sofascore.
  - `val.json`: valores corrigidos, em milhares de €.
  - `stats2.json`: estatísticas.
  - Para gerar: `python dados-brutos/build_all.py` e depois `python dados-brutos/build_final.py` (rodar na raiz do projeto).
  - Os scripts abrem os arquivos com `encoding='utf-8'`. No Windows isso é obrigatório.

## Decisões de design
- Uma coluna centralizada (máx. 720px).
- Topo fixo com caixa, nº de jogadores e chegam/saem, mais as abas Elenco · Mercado · Time · Resumo.
- Nenhum botão dentro das linhas da lista: tudo acontece num painel que sobe de baixo ao tocar.
- Cores neutras, com a cor do clube como único acento. Fonte Inter. Tema claro e escuro.
- Escolha de clube (`EscolhaClube.jsx`): tela cheia em 3 etapas, com a coluna de até 480px centralizada.
  - Etapa 1 é o país: bandeira em cartão branco, setas, deslizar o dedo e siglas.
  - Etapa 2 é a divisão, e só aparece se o país tiver mais de uma liga (hoje, só o Brasil).
  - Etapa 3 é o clube: escudo num círculo branco, vizinhos dos lados, valor e jogadores.
  - Fundo = cor do país (`PAISES` em `constantes.js`) ou do clube (`corDeFundo`: `c`, senão `c2`, senão cinza `#222428`, sempre com brilho ≤ 0,6 para o texto branco ser legível). Transição de 300ms, desligada com `prefers-reduced-motion`.
  - "Voltar" vai para a etapa anterior real (pula a divisão se não houve). Quem troca de clube volta direto à etapa 3, no último clube.
  - Bandeiras: SVGs do Wikimedia Commons em `public/img/flags/`.
- Temporada planejada: "2027" nas ligas de calendário anual (BRA, BRB, ARG, USA) e "27/28" nas demais.
- Os planos ficam salvos no localStorage (chave `plantel:v2`, formato `{plans:{<clube>: plano}, last}`). **Não mudar os nomes dos campos do plano** (`club, budget, st, ins, form, xi, custom`), senão quem já tem planos salvos os perde.

## Pendências (em ordem sugerida)
1. **Fotos em alta resolução (em andamento).** Os escudos já estão prontos (20/11/2026). Faltam as fotos dos jogadores: `dados-brutos/baixar_imagens.py --so-jogadores` baixa para `public/img/players/` (precisa de `pip install pillow`; rodar na raiz do projeto), o `build_final.py` marca `hd` e o `Foto` usa `<img loading="lazy">` quando `hd` existe, ou o sprite quando não existe.
   - **Bloqueio:** em 20/11/2026 o `api.sofascore.app` respondeu 403 a pedidos simples. Não contornar o bloqueio imitando um navegador; buscar uma fonte permitida.
   - Quando todas as fotos existirem, apagar os sprites `p_*.webp` e o código de sprite em `Foto` (`src/componentes/Imagens.jsx`).
2. Completar as estatísticas de ~960 jogadores (ARG e SAU) que faltam em `stats2.json`.
3. Script de atualização periódica dos dados (Transfermarkt e Sofascore).
4. ~~Migrar para Vite~~ Feito em 20/11/2026 (React + Vite; a versão antiga sem framework está na tag git `antes-do-react`). Falta conferir o deploy na Vercel.
5. Simulação da temporada, link compartilhável do plano e modo "desafio diário" (para depois).

## Cuidados
- Transfermarkt: valores "€600mil" são **mil**, não milhões. Na regex, testar `mil` antes de `mi`.
- O Sofascore bloqueia (403) quando recebe requisições demais. Usar pausas.
