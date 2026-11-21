# Plantel: planejador de elencos de futebol

Contexto do projeto para o Claude Code. O dono é Philipe, que está aprendendo a programar. Explique as mudanças em português, de forma simples.

## O que é
Site para planejar o elenco de um clube na próxima temporada. O usuário pode:
- decidir quem fica, é vendido, emprestado ou liberado;
- contratar de outros clubes ou criar jogadores;
- montar o time titular;
- ver um resumo com caixa, profundidade por posição, idade e quem chega e quem sai.

Foi inspirado no reconstruindo.thefenomeno.com, mas **não deve copiá-lo**. O foco aqui é planejamento, com um visual clean e minimalista.

## Ligas (46 ligas em 39 países, 798 clubes, 23.613 jogadores)
- Originais (214 clubes): BRA (Brasileirão A), BRB (Série B), ENG, ESP, ITA, GER, FRA, ARG, SAU (Saudita), USA (MLS).
- Rodada 1, 20/11/2026 (270 clubes, 7.617 jogadores):
  - 1ª divisão: MEX (Liga MX), POR, BEL, SCO, NOR, NED, TUR, DEN, SUI, GRE, AUT.
  - 2ª divisão: ENG2 (Championship), ESP2 (LaLiga 2), ITA2 (Serie B), GER2 (2. Bundesliga), FRA2 (Ligue 2).
- Rodada 2, 20/11/2026 (314 clubes, 9.731 jogadores):
  - BRC (Série C, `div` 3).
  - América do Sul: COL, URU, CHI, PAR, ECU, PER.
  - Europa: SWE, POL, CZE, CRO, SRB, UKR, ROU, RUS.
  - Ásia e Oriente Médio: JPN, KOR, CHN, QAT, UAE.
- Os jogadores das duas rodadas ainda não têm foto (`índice_foto` -1, `hd` 0). O site mostra as iniciais.
- Estatísticas:
  - As duas rodadas e os jogadores de ARG e SAU que faltavam ganharam estatísticas coletadas em 21/11/2026:
    - bloco 1: rodada 1, mais ARG e SAU (8.438 jogadores);
    - bloco 2: rodada 2 (9.247 jogadores).
  - Ainda faltam 699 jogadores (`stats` null), 282 deles da Série C. O site mostra "Estatísticas indisponíveis".
  - `[0,0,0,0]` = não entrou em campo (não é "sem estatísticas"): mostra "0 jogos", sem a nota e com as médias por jogo "—".
- Muitos têm valor 0 (sem valor no Transfermarkt): 876 dos 905 da Série C e dezenas por liga asiática.
  - `valorJogador()` mostra "—" no lugar de "€ 0".
  - `precoDeCompra()` cobra no mínimo `PRECO_MINIMO` (€ 0,1 mi) numa compra. Vale também para "cabe no caixa" e para o filtro "só quem cabe".
- Cada liga tem `div` (1, 2 ou 3): a divisão dentro do país. A tela de divisão ordena por ele.

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
- `src/componentes/`: `EscolhaClube`, `Topo` (resumo e abas), `Elenco`, `Mercado`, `Time`, `Resumo`, `Painel` (o painel que sobe de baixo), `Imagens` (`Foto`, `Escudo` e `LogoLiga`), `SeletorMoeda` e `Rodape`.
  - `paineis/`: o conteúdo de cada painel (`PainelJogador`, `PainelCompra`, `PainelFiltros`, `PainelCriar`, `PainelClube`, `PainelOrcamento`, `PainelPosicao`) e `comum.jsx`.
  - `Congelado` (em `Painel.jsx`) congela o conteúdo enquanto o painel fecha, para ele sumir sem piscar.
- `src/logica/`: funções sem tela.
  - `dados.js`: carrega e indexa os dados no objeto `D`.
  - `constantes.js`: posições, formações e compatibilidade.
  - `dinheiro.js`: moeda, `dinheiro()` e caixa.
  - `cotacao.js`: moeda escolhida e cotação no localStorage.
  - `elenco.js`: plano, elenco, saídas, alertas e texto do resumo.
  - `escalacao.js`: escalar, completar e encaixar.
  - `mercado.js`: busca e filtros.
  - `formato.js`: textos (datas, nomes curtos, iniciais).
  - `armazenamento.js`: ler e salvar no localStorage.
- `public/data.json`: `{leagues, clubs, updated}`. **É gerado pelo `build_final.py`: não editar à mão.**
  - Cada liga: `{k, n, pais, nat, season, div}`. `nat` = nacionalidade como aparece nos jogadores (para contar estrangeiros). `season` "2026" = ano fechado (planeja "2027"); "26/27" = planeja "27/28".
  - Cada clube: `{k, lg, n, coach, c, c2, hd, p:[...]}`. `hd` = ID do time no Sofascore se `public/img/teams/<hd>.webp` existe, senão 0 (aí o site mostra "+" no lugar do escudo).
  - Cada jogador: `[número, nome, posição, nascimento, fim_contrato "AAAA-MM", valor_em_€mi, nacionalidade, índice_foto, stats, hd]`. `hd` = ID do jogador no Sofascore se `public/img/players/<hd>.webp` existe, senão 0.
  - `stats` = `[jogos, gols, assistências, nota]` (temporada atual, todas as competições de clube) ou `null`.
  - Posições: GOL ZAG LD LE VOL MC MEI MD ME PD PE SA CA.
- `public/img/p_<LIGA>.webp`: sprite de fotos (32 colunas, células de 48px). `índice_foto` aponta para a célula; -1 = sem foto.
- `public/img/p_<LIGA>.webp` só existe para as 10 ligas originais. Os jogadores novos não estão em nenhum sprite.
- `public/img/teams/<id>.webp`: escudos em alta (484, 160×160 px, fundo transparente), nomeados pelo ID do Sofascore. Não há mais sprite de escudos.
- `public/img/leagues/<k>.webp`: logos das 26 ligas (160×160, fundo transparente), mostradas por `LogoLiga` num círculo branco, porque várias são pretas.
- `public/img/flags/`: bandeiras dos 20 países (SVG do Wikimedia Commons).
- `vercel.json`: a Vercel roda `npm run build` e publica `dist/`. Cada `git push` na `main` publica uma versão nova.
- `dados-brutos/`: dados coletados em 20/11/2026 e scripts Python que geram o data.json.
  - `tm_all.json` + `tm_extra.json`: Transfermarkt.
  - `sofa_all.json`: Sofascore.
  - `val.json`: valores corrigidos, em milhares de €.
  - `stats2.json`: estatísticas.
  - `novas_ligas_2.json`, `ids_sofascore_novas_2.json` (95% têm ID), `tm_new2.json`, `sofa_new2.json` e `build_new2.py`: a mesma coisa para a rodada 2.
    - O `build_final.py` corrige: nomes repetidos ("Pro League dos Emirados", "Superliga Sérvia", "Premier Liga Ucraniana" e "Premier Liga Russa"); a temporada da J1 League, que passa a "26/27"; e o `nat` de PER, POL, CZE, ROU e QAT, que precisa ser escrito igual aos jogadores ("Perú", "Polónia", "República Checa", "Roménia", "Qatar").
  - `novas_ligas.json`: as 16 ligas novas já no formato final (ligas com `div`, clubes e jogadores). O `build_final.py` junta essas ligas às originais e aplica duas correções:
    - nomes repetidos ficam "Bundesliga Austríaca", "Super League Suíça" e "Super League Grega";
    - a Liga MX passa a ter temporada "26/27" (vai de julho a maio).
  - `ids_sofascore_novas.json`: `{clube: [ID Sofascore de cada jogador, na mesma ordem do elenco]}` (0 = não encontrado; ~98% têm). É para a próxima fase: fotos HD e estatísticas dos jogadores novos.
  - Estatísticas por blocos, todas coletadas em 21/11/2026:
    - bloco 1: MEX, POR, BEL, SCO, NOR, NED, TUR, DEN, SUI, GRE, AUT, ENG2, ESP2, ITA2, GER2 e FRA2, mais os jogadores de ARG e SAU que estavam sem estatísticas;
    - bloco 2: COL, URU, CHI, PAR, ECU, PER, BRC, SWE, POL, CZE, CRO, SRB, UKR, ROU, RUS, JPN, KOR, CHN, QAT e UAE.
  - Arquivos de cada bloco:
    - `estatisticas_blocoN.json`: `{stats: {<clube>: {<nome exato>: [jogos, gols, assist, nota]}}}`. O `build_final.py` grava no campo `stats` de quem tem o mesmo nome no clube e mostra quantos foram atualizados e quantos nomes não foram encontrados. Na 1ª vez: 8.438 e 0 no bloco 1, e 9.247 e 0 no bloco 2;
    - `stats_sofascore_blocoN.json`: os dados brutos por ID Sofascore, `[jogos, gols, assist, nota, nº de competições]`.
  - Nome repetido no mesmo clube: o nome não diz de quem são os números, então o script usa o ID de `ids_sofascore_novas*.json` com os dados brutos. Isso aconteceu 4 vezes no bloco 2 (Brusque, Ferroviária, Degerfors e FC Tokyo). O primeiro "João Pedro" do Brusque não tem ID e ficou sem estatísticas.
  - Para um bloco novo, acrescentar o par de arquivos em `STATS_ARQS`, no `build_final.py`.
  - `tm_new.json`, `sofa_new.json` e `build_new.py`: dados brutos e o script que gerou as ligas novas. Ficam só como referência: o script usa caminhos `raw/` da coleta original e não precisa rodar.
  - Para gerar: `python dados-brutos/build_all.py` e depois `python dados-brutos/build_final.py` (rodar na raiz do projeto).
  - Os scripts abrem os arquivos com `encoding='utf-8'`. No Windows isso é obrigatório.

## Decisões de design
- Uma coluna centralizada (máx. 720px).
- Topo fixo com caixa, nº de jogadores e chegam/saem, mais as abas Elenco · Mercado · Time · Resumo.
- Nenhum botão dentro das linhas da lista: tudo acontece num painel que sobe de baixo ao tocar.
- Cores neutras, com a cor do clube como único acento. Fonte Inter. Tema claro e escuro.
- Tema: segue o sistema até a pessoa tocar no botão sol/lua (`BotaoTema`, no topo do plano). A escolha fica em `plantel:tema` (`src/logica/tema.js`), que marca `<html data-theme>`. O `main.jsx` aplica o tema antes de desenhar, para não piscar. As telas antes do plano têm cores próprias e não mudam com o tema.
- Visual das abas do plano (modelo `referencia-mercado.html`, adaptado aos dois temas):
  - **Topo:** brilho na cor do clube e escudo como marca-d'água. Cards com ícone, barra do caixa e idade média; no celular, 2 cards e uma faixa. Abas com indicador deslizante (`--i`).
  - **Cores por setor:** `--gol` amarelo, `--def` azul, `--mei` verde, `--ata` vermelho (`SETOR`/`corDoSetor` em `constantes.js`).
  - **Peças em `componentes/Jogador.jsx`:** `Avatar` (anel do setor + mini escudo), `Bandeira`, `Pos`, `Nota` (≥8 azul, ≥7 verde, ≥6 amarelo, <6 laranja) e `MiniStats`.
  - **Bandeiras dos jogadores:** `public/img/flags/paises/<iso>.svg` (pacote flag-icons, MIT). O mapa nacionalidade → código está em `src/logica/nacionalidades.js`. Usamos imagem porque emoji de bandeira não aparece no Windows.
  - **Mercado:** busca fixa abaixo do topo a partir de 561px (`--topo-h`, medido pelo `Topo`), atalho "/", "cabe no caixa" / "faltam € X" (linha `.too` apagada) e legenda dos setores.
  - **Cor do clube no CSS:** `--club` (campo `c`, para o brilho) e `--clubVis`/`--clubVisInk`, sempre legíveis: no claro usa `--ac`; no escuro, `--clubEscuro` troca cor escura demais pela 2ª cor ou cinza.
  - **Cuidado:** a classe `.no` já existe (`.row .no`); não reutilizar esse nome.
- Antes do plano (`EscolhaClube.jsx`, estado `tela` no `Plantel.jsx`): telas cheias com fundo colorido, linhas de campo em SVG (branco a 8%) e conteúdo num bloco de até 480px, com o botão principal logo abaixo do conteúdo. Modelo visual: `referencia-inicio-paises.html`, enviado pelo Philipe.
  - Topo de todas: logo e seletor de moeda. Nas etapas, há também "← X de Y".
  - `inicio`: o site **sempre** abre aqui, mesmo com plano salvo. Fundo `#0f3d2b`, título, números calculados do data.json (clubes, ligas, jogadores com valor > 0), "Seus planos" (o último aberto primeiro; tocar abre o plano; a lixeira ao lado abre `PainelExcluirPlano`, que só apaga ao tocar em "Excluir plano") e "Planejar um clube". "Trocar de clube" volta para cá.
  - `pais`: grade de cartões (2 colunas; 3 a partir de 600px), fundo `#1f2a24`, agrupada por continente (`CONTINENTES` e o campo `continente` de `PAISES`), com busca por país ou liga no topo. Tocar avança.
  - `divisao`: só aparece se o país tiver mais de uma liga (Brasil com 3; Inglaterra, Espanha, Itália, Alemanha e França com 2). Fundo = cor do país (`PAISES` em `constantes.js`).
  - `clube`: escudo num círculo branco, vizinhos, valor e jogadores. Setas, teclado e deslizar o dedo trocam de clube. Fundo = `corDeFundo` (`c`, senão `c2`, senão cinza `#222428`, sempre com brilho ≤ 0,6 para o texto branco ser legível).
  - "Voltar" vai para a tela anterior real (pula a divisão se não houve). Transições de 300ms, desligadas com `prefers-reduced-motion`.
  - Bandeiras: SVGs do Wikimedia Commons em `public/img/flags/`.
- Moeda (€, R$, US$; `dinheiro.js` e `cotacao.js`):
  - **Tudo é guardado em euro.** A conversão é só na exibição (`dinheiro(v)`, com formato "€ 12 mi", "R$ 70 mi", "US$ 13 mil") e ao ler o que foi digitado (`paraCampo`/`lerCampo`; campo sem mexer mantém o valor original exato).
  - Escolha salva em `plantel:moeda`.
  - Cotação da API Frankfurter (`https://api.frankfurter.dev/v1/...`; o endereço `.app` redireciona sem CORS e falha no navegador), salva em `plantel:cotacao`. Se a busca falhar, usa a salva; sem nada salvo, usa `COTACAO_RESERVA`.
  - O rodapé mostra a cotação usada e a data.
- Temporada planejada: "2027" nas ligas de calendário anual (BRA, BRB, ARG, USA) e "27/28" nas demais.
- Os planos ficam salvos no localStorage (chave `plantel:v2`, formato `{plans:{<clube>: plano}, last}`). **Não mudar os nomes dos campos do plano** (`club, budget, st, ins, form, xi, custom`), senão quem já tem planos salvos os perde.

## Pendências (em ordem sugerida)
1. **Fotos em alta resolução (em andamento).** Os escudos já estão prontos (20/11/2026). Faltam as fotos dos jogadores: `dados-brutos/baixar_imagens.py --so-jogadores` baixa para `public/img/players/` (precisa de `pip install pillow`; rodar na raiz do projeto), o `build_final.py` marca `hd` e o `Foto` usa `<img loading="lazy">` quando `hd` existe, ou o sprite quando não existe.
   - **Bloqueio:** em 20/11/2026 o `api.sofascore.app` respondeu 403 a pedidos simples. Não contornar o bloqueio imitando um navegador; buscar uma fonte permitida.
   - Quando todas as fotos existirem, apagar os sprites `p_*.webp` e o código de sprite em `Foto` (`src/componentes/Imagens.jsx`).
2. Completar as estatísticas que faltam. Os blocos 1 e 2 foram feitos em 21/11/2026; restam 699 jogadores, 282 deles da Série C.
   - As fotos dos jogadores das duas rodadas também faltam: o `baixar_imagens.py` hoje só lê `kept.json` e precisa passar a ler `ids_sofascore_novas.json` e `ids_sofascore_novas_2.json` também.
3. Script de atualização periódica dos dados (Transfermarkt e Sofascore).
4. ~~Migrar para Vite~~ Feito em 20/11/2026 (React + Vite; a versão antiga sem framework está na tag git `antes-do-react`), publicado na Vercel.
5. Simulação da temporada, link compartilhável do plano e modo "desafio diário" (para depois).

## Cuidados
- Transfermarkt: valores "€600mil" são **mil**, não milhões. Na regex, testar `mil` antes de `mi`.
- O Sofascore bloqueia (403) quando recebe requisições demais. Usar pausas.
