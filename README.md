# Cola Cidadã

Transparência sobre quem ocupa cada cargo público, aberta para qualquer pessoa.

Aplicação web com um **Painel Público** de Presidente e vice, ministros do STF, senadores, deputados federais, governadores,
deputados estaduais e distritais, prefeitos e vereadores das 26 capitais e das duas maiores cidades de cada estado, mais as **contas** da Presidência, da Câmara, do Senado,
do STF, dos 27 governos e assembleias e das prefeituras e câmaras dessas cidades. Nada é escolhido antes: a pessoa consulta
qualquer perfil e, só depois de vê-lo, pode **acompanhar** quem quiser (votações, gastos e alertas).

## Privacidade (LGPD)

- O app não pergunta em quem a pessoa votou nem pede cadastro. Tudo o que é público já aparece no Painel.
- "Acompanhar" é uma escolha opcional, feita dentro do perfil, e não declara voto. A lista fica só no `localStorage` do aparelho
  (opinião política é dado sensível, LGPD art. 5º, II e art. 11) e pode ser exportada ou apagada no Perfil.
- Os dados exibidos são de agentes públicos no exercício do cargo, publicados pelos próprios órgãos (LGPD art. 7º, §3º e §4º; Lei de Acesso à Informação).

## Rodando

Requer apenas Node 18+ (sem dependências):

```bash
npm run dev   # http://localhost:5173
```

## Deploy no Cloudflare Workers (plano gratuito)

O deploy usa `wrangler.jsonc` e publica somente os arquivos do app. O arquivo `.assetsignore` é obrigatório: o checkout contém `node_modules` e ferramentas de desenvolvimento que não podem ser enviados como assets do Worker.

No Cloudflare, deixe o diretório de saída como `.` e use:

```bash
npm run deploy
```

O commit publicado precisa conter `wrangler.jsonc` e `.assetsignore`. Se o Wrangler mostrar `Detected Project Settings` ou perguntar `Do you want to modify these settings?`, ele não encontrou o `wrangler.jsonc` no commit que o Cloudflare clonou; verifique o branch e o commit configurados no projeto.

## Testes

```bash
npm install
npm test            # unitários (node:test) + navegador (Playwright, desktop e celular)
npm run test:unit   # só lógica, dados e verificações estáticas
```

Os testes de navegador bloqueiam as APIs públicas, então rodam offline e não dependem da Câmara ou do Senado. Com Chromium já instalado, use `PW_CHROMIUM_PATH=/caminho/do/chrome`. O CI (`.github/workflows/ci.yml`) roda tudo a cada PR.

## Arquitetura

- `index.html` + módulos ES nativos (sem bundler) e CSS próprio com tema claro/escuro.
- `src/store.js` — estado no `localStorage`. **Nada é enviado a servidores** (opinião política é dado sensível, LGPD art. 5º, II).
- `src/api.js` / `src/votes.js` — cliente da API da Câmara e cruzamento de votos nominais.
- `src/directory.js` — diretório do Painel: carrega cada cargo (APIs da Câmara e do Senado, arquivos do TSE, Executivo e STF) no mesmo formato usado ao acompanhar.
- `src/contas.js` — contas públicas pelo Siconfi (Tesouro Nacional): RREO (receita e despesa) e RGF (gasto com pessoal por órgão).
- `src/views/` — Painel Público, Acompanhamento (Início), Quem Acompanho, Comparador, Alertas, Perfil.

## Decisões vs. protótipo original

- Sem dados fictícios: tudo vem do usuário ou da API oficial.
- Sem promessas falsas de criptografia: "Apagar tudo" e "Exportar" funcionam de verdade.
- Datas de mandato corrigidas (deputados até jan/2027; senadores até jan/2027 ou jan/2031).

## Fontes e Integrações Ativas

- **Câmara dos Deputados (`dadosabertos.camara.leg.br`):**
  - Busca oficial e fotos de todos os 513 deputados federais.
  - Votações nominais no Plenário com placar oficial (Sim / Não / Obstrução / Abstenção).
  - Projetos de Lei (PLs) e PECs de autoria do parlamentar, com link direto para a ficha de tramitação.
  - **Auditoria Financeira da Cota Parlamentar (CEAP):** Total acumulado no mandato, maiores categorias de gastos e links diretos para as notas fiscais e comprovantes eletrônicos (DANFE/PDF).
- **Senado Federal (`legis.senado.leg.br`):**
  - Busca oficial e fotos dos 81 senadores da República em exercício por nome ou UF.
  - Votações nominais do Plenário do Senado com resultado oficial e voto individual.
  - Cálculo exato de término do mandato de 8 anos a partir dos dados do Senado.
- **Filtros temáticos:** votações por área (Economia, Tecnologia, Social/Saúde, Meio Ambiente, Segurança).
- **PWA & Funcionamento Offline:**
  - Instalável como aplicativo no celular e desktop (`manifest.webmanifest` e `icon.svg`).
  - `sw.js` (Service Worker) ativo com cache do app shell e estratégia de fallback para dados consultados offline.
  - Botão automático para adicionar à tela inicial no navegador.
- **Alertas Locais no Dispositivo (Push Local):**
  - Integração com a *Web Notifications API* para disparar avisos nativos na barra de notificações quando novas votações nominais forem registradas.
- **Gabinete & Perfil Institucional:**
  - Consulta de nome civil, condição eleitoral (Titular/Suplente), naturalidade e canais de contato público (sala, anexo, telefone e e-mail).
- **Backup & Restauração Local (LGPD):**
  - Exportação e restauração completa de backup em formato JSON para migração entre dispositivos.
  - Expurgo irreversível dos dados locais sob demanda do usuário.
- **Atos do Poder Executivo (Medidas Provisórias):**
  - Radar em tempo real de Medidas Provisórias (MPVs) apresentadas pela Presidência da República que tramitam no Congresso Nacional com força de lei.
  - Esclarecimento cívico sobre os prazos constitucionais de 60 + 60 dias (Art. 62 da CF/88) e links oficiais para acompanhamento.
- **Fiscalização Cívica de Orçamento & "Emendas Pix":**
  - Guia descomplicado sobre Emendas Individuais de Transferência Especial (Emendas Pix - EC 105/2019) e transferências diretas para prefeituras.
  - Atalhos diretos para fiscalização cidadã no Portal da Transparência da CGU e no Painel Siga Brasil do Senado Federal.
- **Relatório Cívico & Dossiê de Prestação de Contas (PDF):**
  - Emissão instantânea de relatório oficial de mandato diretamente no navegador (`window.print()` e `@media print` otimizado para papel A4 e PDF).
  - Inclui resumo da cota parlamentar (CEAP), notas fiscais recentes, projetos autorais e deliberações em plenário.
  - **Selo Criptográfico SHA-256**: Geração de hash de integridade local via `crypto.subtle.digest` para atestar a fidelidade dos dados abertos na data de emissão.
- **Cards Cívicos para Redes Sociais (Canvas / WhatsApp / Stories):**
  - Geração dinâmica em HTML5 Canvas de cards visuais elegantes (1080x1080) com foto oficial, dados do mandato e posicionamentos de voto.
  - Download em PNG e integração nativa com *Web Share API* para compartilhamento direto no WhatsApp, Telegram e redes sociais.
- **Modo Confronto Direto 1 vs 1:**
  - Matriz de alinhamento entre dois parlamentares quaisquer monitorados.
  - Cálculo automático da taxa de convergência (% de votos coincidentes), matérias onde concordaram vs onde divergiram e geração de card de confronto.
- **Deputados Estaduais/Distritais e Vereadores de Capitais (dados reais do TSE):**
  - Os 27 rosters de assembleias (1.059 eleitos em 2022) e as 26 câmaras de capitais (eleitos em 2024) vêm dos dados abertos do TSE (`consulta_cand` e `bem_candidato`), gerados por `scripts/build-regional-data.mjs`.
  - Cada parlamentar traz número de urna, resultado, coligação/federação, patrimônio declarado e link para a ficha no DivulgaCandContas.
  - Limitações: o roster reflete **quem foi eleito**, não o exercício atual (suplentes que assumiram, cassações e afastamentos não aparecem); não há foto, e-mail ou telefone, pois o TSE não os publica.
  - Dados particionados por UF (`/src/data/states/{uf}.json`, `/src/data/capitais/{uf}.json`) e carregados sob demanda.
- **Presença & Fidelidade (deputados federais, API da Câmara):** `src/plenary.js` calcula, sobre as últimas sessões deliberativas e votações nominais do Plenário:
  - presença registrada (`/eventos/{id}/deputados`) e participação em votações nominais (`/votacoes/{id}/votos`);
  - fidelidade = votos iguais à orientação da bancada (`/votacoes/{id}/orientacoes`; usa o partido ou, se ele não orienta sozinho, o bloco/federação). Votações com bancada liberada ou sem orientação publicada não entram na taxa.
  - Limitações: a presença não distingue falta justificada; o cálculo cobre só uma janela recente; para deputados estaduais e vereadores não há dado equivalente implementado. A resolução de blocos abreviados (`Bl UniPpPsd...`) é heurística.
- **Presença & Fidelidade (senadores, API do Senado):** `senatorPlenaryStats` em `src/plenary.js`, sobre as votações nominais do Plenário dos últimos 180 dias (`/votacao` e `/plenario/votacao/orientacaoBancada`):
  - presença nas votações nominais, separando ausências justificadas (licença, missão, atividade parlamentar) de não comparecimento; votos secretos contam como presença;
  - fidelidade à orientação publicada para o partido (votações com bancada liberada ou sem orientação ficam fora da taxa). Poucas votações têm orientação, então a amostra costuma ser pequena e o painel mostra quantas foram medidas.
- **Agenda Legislativa:** próximos eventos oficiais da Câmara (API `/eventos`) na tela inicial.
- **Detecção Inteligente de "Jabutis" & Sumarizador Cívico (Fase 8):**
  - **Scanner de Jabutis (Contrabando Legislativo):** Algoritmo semântico em linguagem natural (*client-side* no navegador, 100% privado e em conformidade estrita com a LGPD) que audita a coerência temática de emendas e artigos de Medidas Provisórias e Projetos de Lei. Emite alertas de risco (*Baixo, Médio, Alto*) e cita a jurisprudência vinculante do STF (ADI 5127).
  - **Sumarizador Didático de Proposições:** Síntese instantânea em linguagem simples explicando: *O que muda na prática*, *Impacto financeiro e orçamentário*, e *Quem ganha e quem paga*.
  - **Simulador Interativo de Texto:** Ferramenta interativa para o cidadão colar qualquer texto de emenda, parágrafo ou artigo de lei e auditar na hora a presença de temas alheios ao núcleo da matéria.
- **Glossário Cívico Interativo:**
  - Dicionário didático embutido com busca rápida para termos legislativos (*Obstrução, Quórum Qualificado, Jabuti, Substitutivo, DVS, MPV, Emendas Pix*).
- **Experiência Cívica & Governança (Fase 9 — Conforme Stitch Design System):**
  - **Onboarding Cívico Interativo:** Fluxo guiado em 3 passos para novos usuários apresentando a privacidade radical da LGPD (Art. 5º, II), a conexão com dados abertos oficiais e o ciclo de auditoria de mandato.
  - **Minha Cola Eleitoral (Cédula Cívica de Mandatos):** Assistente dedicado para preenchimento e vinculação rápida de todos os cargos eletivos (Presidente, Governador, Senadores, Deputados Federais, Estaduais e Vereadores), com visualização do status de preenchimento.
  - **Painel de Governança & Score de Vigilância Cívica:** Termômetro no Perfil que calcula o índice de vigilância do cidadão (0 a 100 pontos) com base na cobertura de mandatos vigiados, deliberações oficiais checadas e auditorias realizadas.
  - **Floating Action Button (FAB MD3):** Botão flutuante de ação rápida posicionado na interface para seguir novos representantes ou auditar votações instantaneamente de qualquer tela.
- **Identidade inspirada no Google Stitch e no Material Design 3:**
  - **Tipografia Inter:** Fonte variável servida localmente em pesos de 400 a 700, sem pedidos do navegador a terceiros.
  - **Paleta Tonal M3 (`md-sys-color-*`):** Cores tonais dinâmicas adaptativas (Verde Cívico tonal 40/80, Azul Federal tonal 40/80, Ouro República tonal 40/80) com transição fluida entre Tema Claro e Tema Escuro (*Dark Mode*).
  - **Superfícies & Elevações Tonais:** Camadas de superfície escalonadas (`surface-container-lowest` até `highest`) e elevações padronizadas M3 (níveis 0 a 5).
  - **Formas & Raios M3 (`md-sys-shape-*`):** Cantos de 12px para cartões, 8px para inputs e chips, e 9999px para botões e indicadores ativos.
  - **Componentes Nativos M3:** Top App Bar (64px), Extended Floating Action Button (FAB), Navigation Rail no desktop, Navigation Bar em pílula no mobile e Switches com trilho e thumb no padrão Material You.





## Interação e acessibilidade

- **Diálogos:** entram e saem pelo mesmo caminho, fecham com Esc, prendem o foco e devolvem-no ao botão que os abriu. Em telas estreitas viram folha inferior que pode ser arrastada para baixo para fechar (acompanha o dedo, resiste para cima, projeta a inércia e anima com mola — `src/motion.js`).
- **Materiais:** cabeçalho e barra inferior translúcidos, com divisória só quando há conteúdo rolando por baixo.
- **Feedback:** resposta no pressionar; hover só em dispositivos com ponteiro; remover político pode ser desfeito pelo snackbar.
- **Preferências do sistema:** tema segue `prefers-color-scheme` até o usuário escolher; `prefers-reduced-motion` troca deslizamentos por crossfade; `prefers-reduced-transparency` e `prefers-contrast` deixam as superfícies sólidas e com contornos fortes.
- **Leitor de tela e teclado:** ícones da fonte ficam com `aria-hidden` (o nome da ligadura não é lido); ao trocar de tela o foco vai para o título; o primeiro Tab mostra "Pular para o conteúdo"; com diálogo aberto o resto do app fica `inert`. As abas (ficha, cadastro, Comparador e análise) seguem o padrão WAI-ARIA: um só ponto de Tab por grupo, setas/Home/End para trocar. No toque, chips e botões têm área clicável de 44px sem mudar o visual. Testes em `tests/e2e/a11y.spec.mjs`.

## Dados que NÃO são exibidos (por falta de fonte implementada)

Atuação como relator e financiamento de campanha foram removidos: eram valores simulados (fonte possível: prestação de contas do TSE). Presença e fidelidade existem para deputados federais e senadores (não para deputados estaduais e vereadores).

## Atualizando os dados regionais

```bash
# baixar e extrair consulta_cand_{2022,2024}.zip e bem_candidato_{2022,2024}.zip de
# https://cdn.tse.jus.br/estatistica/sead/odsele/{consulta_cand,bem_candidato}/
node scripts/build-regional-data.mjs <cand2022> <cand2024> <bem2022> <bem2024>
```

## Executivo, STF e contas

- **Presidente, governadores e prefeitos das capitais:** `scripts/build-executive-data.mjs` gera `src/data/executivo.json` a partir do
  `consulta_cand` do TSE (2022 e 2024) e aplica por cima `src/data/titulares.json`, que registra quem ocupa o cargo hoje (renúncias para
  disputar 2026, sucessões, interinos e a eleição indireta do Amazonas). Quem assumiu no lugar do eleito aparece sem a ficha do TSE, com a
  data de posse e o nome de quem venceu a eleição. A data da conferência aparece no Painel. Para atualizar, edite `titulares.json` e rode
  `node scripts/build-executive-data.mjs <consulta_cand_2022> <consulta_cand_2024>`.
- **Cidades-polo (as duas maiores economias de cada estado, fora a capital):** `scripts/build-cidades.mjs` consulta o IBGE (SIDRA: PIB dos
  Municípios, tabela 5938, e população do Censo 2022, tabela 4709), escolhe as duas maiores cidades por PIB em cada um dos 26 estados com
  capital municipal (o DF é uma cidade só) e junta os prefeitos e vereadores eleitos em 2024 (TSE). Gera `src/data/cidades.json` (catálogo
  de capitais e polos, com PIB, população, PIB por habitante e posição no estado), `src/data/cidades/{uf}.json` (vereadores) e
  `src/data/prefeitos-cidades.json`. Os arquivos das capitais não são tocados. Nas cidades-polo o nome do prefeito é o de quem foi eleito:
  só as capitais têm o ocupante de hoje conferido em `titulares.json`. Uso: `node scripts/build-cidades.mjs <consulta_cand_2024> <bem_candidato_2024>`.
- **Ocupantes das cidades-polo:** `src/data/titulares.json` (chave `prefeitosCidades`) registra, por código IBGE, quem ocupa a prefeitura hoje
  quando mudou desde a eleição (cassação, renúncia, afastamento, sucessão, troca de partido), com nota e data da pesquisa. Os dados do TSE de 2024
  já trazem eleições suplementares (Cabedelo-PB, 2026); o script usa a data da eleição de cada registro. Cidade que não aparece no arquivo não
  teve mudança encontrada, mas a conferência é por notícias e pode ficar velha: ela é mostrada na tela com a data.
- **Cota dos senadores (CEAPS):** `scripts/build-ceaps.mjs` resume o dado aberto do Senado (~10 MB por ano, sem filtro por senador) em
  `src/data/ceaps.json` (~300 KB): total e principais tipos por ano e as despesas grandes (a partir de R$ 5.000) mais recentes de cada senador.
  O perfil do senador ganha a aba "Cota (CEAPS)", com a data do resumo, e os Alertas avisam das despesas grandes dos últimos 90 dias de quem se
  acompanha. Para atualizar: `node scripts/build-ceaps.mjs` (padrão: ano anterior e atual). A API traz lançamentos com data futura; eles são ignorados.
- **Gastos por Poder** (`#/poderes`, aberta pelo Painel > Contas; no Expo, a tela `poderes`): a despesa líquida com pessoal do Executivo, do
  Legislativo e do Judiciário na União, nos 27 estados, nas 26 capitais e nas 52 cidades-polo, e quanto do limite da LRF ela consome (alerta aos 90%,
  prudencial aos 95%). `scripts/build-poderes.mjs` lê o RGF (Anexo 01) do Siconfi, soma os órgãos de cada Poder (ex.: Assembleia + Tribunal de Contas;
  todos os tribunais do Judiciário) e grava `src/data/poderes.json` (~80 KB). Município não tem Judiciário. É gasto com pessoal, não o gasto total do Poder.
  O Executivo federal vem sem comparação: o relatório dele no Siconfi cobre só uma parcela. Para atualizar: `node scripts/build-poderes.mjs` (~2 min) e,
  no Expo, `node expo-app/scripts/sync-data.mjs`.
  **Fase 2 (despesa total por função):** o mesmo `poderes.json` traz, por ente, a despesa liquidada por função de governo (DCA, Anexo I-E, ano mais recente:
  2025 em 105 dos 106 entes): Legislativa, Judiciária, Essencial à Justiça, Encargos especiais e as demais funções. É o gasto total, mas função não é Poder
  (aposentadorias e outros gastos de um Poder podem estar em outras funções), e a tela diz isso. O comparativo entre estados ganhou essas medidas.
- **Contratos das prefeituras (PNCP):** na aba Contas, a prefeitura de cada capital e cidade-polo ganha o botão "Contratos recentes": consulta ao vivo o
  Portal Nacional de Contratações Públicas (`pncp.gov.br`, sem chave, com CORS) pelo CNPJ da prefeitura (`src/data/cnpjs.json`, de `scripts/build-cnpjs.mjs`, a
  partir do cadastro de entes do Siconfi). Mostra o total dos últimos 30 dias, a soma dos valores informados, os maiores contratos e os mais recentes (com a marca
  de emenda parlamentar quando o contrato traz uma). A API só filtra por CNPJ do órgão, aceita até 365 dias e devolve do mais antigo ao mais novo: o app lê a
  última página para trás, até 500 contratos. Só prefeituras: governos estaduais, câmaras e assembleias têm vários CNPJs ou CNPJs próprios e ficam de fora por ora.
- **Fotos, bandeiras dos partidos e naturalidade do STF:** os CSVs de candidatos do TSE não trazem foto, e a CSP só aceita imagens do próprio app e da
  Câmara e do Senado; por isso governadores, prefeitos, deputados estaduais e vereadores apareciam só com as iniciais (e o STF, que é digitado à mão,
  também). `scripts/build-fotos.mjs` lê dos zips de fotos do TSE (dados abertos, por estado e eleição), por HTTP Range e sem baixar os zips (chegam a
  2 GB), só as fotos de quem está nos dados, reduz cada uma (96×134, ~3 KB) e grava em `fotos/tse/{ano}/{sq}.jpg`, com `photo` em cada pessoa;
  rode depois dos scripts que geram os dados do TSE. `scripts/build-stf.mjs` completa `stf.json` com a naturalidade (Wikidata, conferida pela data de
  nascimento) e a foto de cada ministro (Wikimedia Commons, com autor e licença em `fotoCredito`). `scripts/build-simbolos.mjs` baixa as bandeiras dos
  partidos e dos estados do Commons (só arquivos livres; qual arquivo vale para cada um está em `scripts/simbolos-fontes.json`) e gera
  `src/data/simbolos.js`. Nos cartões e nas fichas, quem tem partido mostra a bandeira e a sigla; **magistrados não têm vínculo partidário: no lugar do
  partido aparece o estado onde nasceram**, com a bandeira dele. Os créditos ficam em "Créditos das imagens", no fim do Painel. Precisa do ImageMagick
  (`convert`). Fotos de quem assumiu no lugar de um eleito ficam com as iniciais (a ficha do TSE é de outra pessoa).
- **Emendas parlamentares:** `scripts/build-emendas.mjs` lê o download aberto do Portal da Transparência (CGU, ~32 MB, sem chave) e grava
  `src/data/emendas.json` (~600 KB): desde 2023, por parlamentar (emendas individuais: empenhado e pago por ano, emendas Pix, municípios e favorecidos
  que mais receberam) e por cidade monitorada (total e autores que mais enviaram). O perfil de deputado e de senador ganha a aba "Emendas" e o bloco
  "A cidade" mostra o que a cidade recebeu. O dado traz o nome parlamentar do autor, não o código da Câmara ou do Senado: a ligação é pelo nome.
  Para atualizar: `node scripts/build-emendas.mjs [pasta-do-zip-extraído]` (sem argumento, baixa e extrai com `unzip`).
- **Frentes parlamentares e comissões:** o perfil do deputado federal lista as frentes da legislatura atual (API da Câmara) e o do senador
  mostra as comissões em que atua hoje (API do Senado), ambas consultadas ao vivo.
- **STF:** `src/data/stf.json` (composição, posse, quem indicou e ano da aposentadoria compulsória). Ministros não têm mandato nem ficha eleitoral.
- **Contas (aba Contas do Painel):** consultadas ao vivo no Siconfi (`apidatalake.tesouro.gov.br`), sem chave. Governo Federal, estados e
  capitais e cidades-polo mostram receita arrecadada e despesa empenhada, liquidada e paga no período mais recente entregue; Câmara, Senado, STF,
  assembleias e câmaras municipais mostram o gasto com pessoal em 12 meses e o peso na receita corrente líquida. Os códigos IBGE ficam em
  `src/data/entes.json`. Dois cuidados com o Siconfi: o espaço da URL vai como `%20` (com `+` a resposta vem sem CORS), e cada
  consulta leva `&origem=<host do app>`, porque a CDN deles guarda o cabeçalho CORS de quem pediu a URL primeiro e o repete para todos.
