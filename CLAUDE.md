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

## Estrutura
- `site/index.html`: o app inteiro (HTML, CSS e JS sem framework). Lê `data.json` com fetch, por isso precisa rodar num servidor local (veja abaixo). Abrir o arquivo direto não funciona.
- `site/data.json`: `{leagues, clubs, updated}`.
  - Cada clube: `{k, lg, n, coach, c, c2, ci, hd, p:[...]}`. `hd` = ID do time no Sofascore se `site/img/teams/<hd>.webp` existe, senão 0.
  - Cada jogador: `[número, nome, posição, nascimento, fim_contrato "AAAA-MM", valor_em_€mi, nacionalidade, índice_foto, stats, hd]`. `hd` = ID do jogador no Sofascore se `site/img/players/<hd>.webp` existe, senão 0.
  - `stats` = `[jogos, gols, assistências, nota]` (temporada atual, todas as competições de clube) ou `null`.
  - Posições: GOL ZAG LD LE VOL MC MEI MD ME PD PE SA CA.
- `site/img/p_<LIGA>.webp`: sprite de fotos (32 colunas, células de 48px). `índice_foto` aponta para a célula; -1 = sem foto.
- `site/img/crests.webp`: sprite de escudos (16 colunas, 64px). O índice é o campo `ci` do clube.
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
- Escolha de clube: botões de liga, carrossel do clube e grade de escudos.
- Temporada planejada: "2027" nas ligas de calendário anual (BRA, BRB, ARG, USA) e "27/28" nas demais.
- Os planos ficam salvos no localStorage (chave `plantel:v2`).

## Pendências (em ordem sugerida)
1. **Fotos e escudos em alta resolução (em andamento).** O código está pronto: `dados-brutos/baixar_imagens.py` baixa para `site/img/players/` e `site/img/teams/` (precisa de `pip install pillow`), o `build_final.py` marca `hd` e o site usa `<img loading="lazy">` quando `hd` existe, ou o sprite quando não existe.
   - **Bloqueio:** em 20/11/2026 o `api.sofascore.app` respondeu 403 a pedidos simples. Não contornar o bloqueio imitando um navegador; buscar uma fonte permitida.
   - Quando todas as imagens existirem, apagar os sprites (`p_*.webp`, `crests.webp`) e o código de sprite em `face()`/`crest()`.
2. Completar as estatísticas de ~960 jogadores (ARG e SAU) que faltam em `stats2.json`.
3. Script de atualização periódica dos dados (Transfermarkt e Sofascore).
4. Migrar para um projeto com Vite e publicar na Vercel ou Netlify.
5. Simulação da temporada, link compartilhável do plano e modo "desafio diário" (para depois).

## Cuidados
- Transfermarkt: valores "€600mil" são **mil**, não milhões. Na regex, testar `mil` antes de `mi`.
- O Sofascore bloqueia (403) quando recebe requisições demais. Usar pausas.
