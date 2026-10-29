# Plano de ação — design, conteúdo e qualidade

Pendências levantadas na varredura de design (outubro/2026). As que já foram feitas estão no PR #3; este plano cobre o que ficou.

Ordem sugerida: **P0** antes do deploy, **P1** logo em seguida, **P2** quando houver tempo.

## P0 — antes do deploy

### 1. Confirmar os dados da empresa no rodapé — ✅ feito (dados não confirmados removidos)
- **Problema:** o rodapé mostra CNPJ 68.027.889/0001-34 (dígitos verificadores válidos), endereço na Rua Pais Leme, 215, dois telefones e `contato@mestrys.com.br`. Não há como confirmar daqui se são os dados reais da Mestry's Tecnologia.
- **Ação:** a empresa confirma cada dado. O que não for real sai do rodapé.
- **Feito:** como não havia como confirmar os dados, saíram do rodapé o CNPJ, o endereço e os dois telefones. Ficaram o nome da empresa, a descrição e o e-mail `contato@mestrys.com.br`. Para voltar com algum dado, basta a empresa confirmá-lo e incluí-lo em `src/main.js` (bloco `footer-top`).
- **Esforço:** minutos. **Quem decide:** a empresa.

### 2. Conteúdo editorial gerado por palavras-chave — ✅ feito
- **Problema:** dois recursos geram textos que parecem análise do caso específico, mas são frases prontas escolhidas por palavras-chave.
  - `src/analysis.js` (Sumário, "Impacto financeiro", "Quem ganha e quem paga", Scanner de Jabutis): o mesmo parágrafo genérico aparece para qualquer proposição do mesmo tema. Já ganhou um aviso de "estimativa automática".
  - `src/votes.js` (`getCitizenExplanation`, "Linguagem Cidadã"): textos fixos de "Votou SIM para…/Votou NÃO…" que atribuem motivações ao voto. Num app apartidário, isso é posicionamento editorial.
- **Opções:**
  - (a) Manter, com o aviso visível também na Linguagem Cidadã e redação revisada por alguém com critério editorial.
  - (b) Trocar as frases por dados oficiais (ementa, situação da tramitação, link do inteiro teor).
  - (c) Remover os quadros.
- **Recomendação:** (b) para "Impacto/Quem ganha" e (a) para a Linguagem Cidadã, com revisão de cada texto.
- **Feito:**
  - (b) Os quadros "O que muda na prática", "Impacto Financeiro" e "Quem Ganha e Quem Paga" saíram. A aba virou "Resumo Oficial": ementa, número, data de apresentação e link para a ficha de tramitação e o inteiro teor (só links de camara.leg.br e senado.leg.br). O tema segue estimado por palavras-chave e está rotulado assim; o aviso de estimativa automática foi para o Scanner de Jabutis.
  - (a) A Linguagem Cidadã ganhou um aviso visível (`EXPLANATION_NOTE` em `src/votes.js`) nos dois lugares em que aparece: texto fixo por tema, não é declaração do parlamentar.
- **Decisão final:** a Linguagem Cidadã foi removida por inteiro (`getCitizenExplanation`, `EXPLANATION_NOTE`, os quadros do Início e do Comparador e o CSS). Os quatro textos atribuíam motivos aos votos e eram frases fixas por palavra-chave. Votações seguem com resultado oficial, placar e voto individual. Itens vindos do feed do Início não trazem link (a API do feed não devolve o id da proposição).
- **Esforço:** (a) 1–2 h de código, mais a revisão; (b) cerca de 1 dia.

### 3. Data de início do mandato estadual — ✅ feito
- **Problema:** `defaultMandate('dep-estadual')` usa 15/03/2023 a 14/03/2027, que é a regra da ALESP, para todas as assembleias. A maioria começa em 01/02/2023.
- **Efeito:** o percentual cumprido e os dias restantes aparecem errados fora de SP.
- **Feito:** SP 15/03/2023–31/01/2027 (a PEC da Alesp antecipou a posse da 21ª legislatura para 01/02/2027); demais UFs 01/02/2023–31/01/2027. Cadastros antigos com a data errada são recalculados ao exibir. Só SP foi confirmada como exceção; as demais seguem a regra de 1º de fevereiro.
- **Esforço:** 1–2 h.

### 4. Domicílio eleitoral ignorado no cadastro — ✅ feito
- **Problema:** o store grava `domicile.state`, mas `addPolitician.js` lê `domicile.uf`. O cadastro sempre abre em SP, mesmo com outro estado configurado no Perfil.
- **Feito:** o cadastro lê `domicile.state`, e o seletor do Perfil passou de 9 para as 27 UFs.
- **Esforço:** minutos, mais um teste.

## P1 — logo após o deploy

### 5. Fonte Actor sem negrito real — ✅ feito com Inter local
- **Problema:** a Actor só tem peso 400. Todo `font-weight: 600/700/800` é negrito sintético, borrado e mais largo. Também não há itálico real.
- **Opções:**
  - (a) Actor só em títulos e marca, e uma fonte com pesos reais no corpo (fonte do sistema, Inter, Atkinson Hyperlegible).
  - (b) Manter a Actor e trocar o negrito por tamanho e cor na hierarquia.
- **Recomendação:** (a) com a fonte do sistema no corpo: zero download e melhor legibilidade em textos densos.
- **Feito:** a interface web usa Inter variável local em pesos de 400 a 700. A fonte integra o sistema visual do Stitch, não faz pedidos a terceiros e elimina o negrito sintético da Actor. O Expo usa a fonte do sistema em cada plataforma, com a mesma escala e paleta semântica.
- **Validação:** testes estáticos impedem o retorno de fontes externas e verificam a presença dos arquivos locais.

### 6. Fonte de ícones de cerca de 1 MB — ✅ feito
- **Problema:** a Material Symbols é baixada inteira (woff2 de cerca de 975 KB, com quatro eixos variáveis) para uns 60 ícones.
- **Ação:**
  - Listar os ícones usados, inclusive os dinâmicos (`routes`, `TOAST_ICONS`, ícones montados por expressão).
  - Pedir o subconjunto com `&icon_names=` e fixar só os eixos usados (FILL 0..1, wght 400..500).
  - Criar um teste que falha se aparecer um ícone fora da lista.
- **Feito:** 64 ícones via `&icon_names=` e eixos fixos (opsz 24, wght 400–500, GRAD 0): de 975 KB para 17 KB. Testes unitários e de navegador falham se um ícone usado ficar fora da lista.
- **Esforço:** meio dia.

### 7. Testes automatizados e CI — ✅ feito
- **Problema:** não há testes nem workflow de CI. As verificações deste PR foram scripts manuais em Playwright.
- **Ação:**
  - Versionar os testes de fumaça: abrir cada tela, abas da ficha, folha arrastável, Esc e foco, Desfazer, CSP sem violações.
  - Validar o formato dos JSON de `src/data`.
  - Rodar tudo em GitHub Actions a cada PR.
- **Feito:** `npm test` roda 66 testes unitários (lógica, dados do TSE, ícones, textos fictícios) e 30 de navegador em desktop e celular, com as APIs públicas bloqueadas para não depender delas. Workflow em `.github/workflows/ci.yml`.

### 8. Auditoria de contraste (WCAG AA) — ✅ feito
- **Problema:** não fiz medição sistemática. Pontos suspeitos:
  - texto `on-surface-variant` sobre `surface-container`;
  - chips roxo e verde-azulado no escuro;
  - textos de 10–11 px.
- **Feito:** axe-core (WCAG 2.1 AA) nas cinco telas e em três diálogos, nos dois temas, em desktop e celular. Contraste: nenhuma reprovação; o axe não consegue avaliar texto sobre gradiente e superfície translúcida (4 a 10 casos por tela). Corrigidos: interruptores sem rótulo (tema e preferências de alertas) e galeria rolável sem foco por teclado no Comparador. O teste roda no CI.
- **Segunda rodada (leitor de tela, teclado e toque):** nomes de ícone lidos em voz alta (47 por tela), foco perdido ao trocar de tela, falta de link de pulo, busca do Comparador sem rótulo, títulos pulando de h1 para h3, landmarks (`aside` com role de navegação, faixa de fontes fora de landmark), fundo dos diálogos sem `inert` e alvos de toque de 32–40px. O axe passou a checar também as boas práticas nas telas.

## P2 — quando houver tempo

### 9. Tamanhos fixos e 617 estilos inline — ✅ feito
- **Problema:** tipografia e espaçamentos em `px` e 617 atributos `style=` espalhados pelas views.
- **Efeitos:**
  - o app ignora o tamanho de fonte configurado no aparelho;
  - a CSP precisa de `'unsafe-inline'` em `style-src`;
  - qualquer ajuste visual vira caça a ocorrências.
- **Ação, por etapas:**
  1. ✅ Converter a escala tipográfica e os espaçamentos de `styles.css` para `rem` (204 valores; visual idêntico no tamanho padrão). Com isso 66% do texto passa a acompanhar o tamanho de fonte do aparelho (antes 0%); o resto depende da etapa 2. Testado sem quebra de layout com fonte de 24 px.
  2. ✅ Os 626 `style=` das views viraram classes atômicas em `src/utilities.css` (239 classes, `!important` para valer mais que os componentes, como o estilo inline valia). Os tamanhos de fonte, espaçamentos e `line-height` dessas classes já saem em `rem`, então o texto das views passa a acompanhar o tamanho de fonte do aparelho. Larguras de barra calculadas (`data-w="42"`) são aplicadas por `src/dynamic.js` pelo CSSOM, que a CSP permite. Cores condicionais viraram variantes de classe (`.verdict.bad`, `.step-dot.on`, `.cola-item.matched`…).
  3. ✅ `'unsafe-inline'` saiu de `style-src` na CSP; o teste de CSP no navegador passa sem violações.
- **Esforço:** 3–5 dias, em PRs pequenos.

### 10. Cache das estatísticas de presença — ✅ feito
- **Problema:** `plenaryDataset()` e `senateDataset()` guardam a promessa pela sessão inteira. As respostas HTTP já expiram em 5 min, mas o conjunto calculado não.
- **Ação:** mesma validade de 5 min, ou recálculo ao tocar em atualizar.
- **Esforço:** 1 h.

### Extra. Botão flutuante duplicado — ✅ feito
- O botão "Seguir Político" repetia o botão de cadastro de quase toda tela e, no celular, cobria conteúdo. Agora só aparece em Alertas, a única tela sem botão próprio (`ownAdd` em `src/main.js`).

### 11. Foto do deputado no card de compartilhamento
- **Problema:** o servidor de fotos da Câmara não envia CORS. O canvas não pode usar a imagem sem ficar bloqueado para exportar, e o card sai sem foto (os senadores funcionam).
- **Opções:**
  - (a) Aceitar e manter as iniciais.
  - (b) Um proxy de imagem próprio, por exemplo uma função no Vercel. Contraria a proposta de não ter servidor.
- **Recomendação:** (a), salvo pedido explícito.

### 12. Atraso no onboarding — ✅ feito
- **Problema:** o onboarding abre com `setTimeout(500)` depois da tela. É meio segundo de espera e uma tela que "pula".
- **Ação:** abrir junto da primeira renderização.
- **Esforço:** minutos.

## Resumo

| # | Item | Prioridade | Esforço | Precisa de decisão? |
|---|------|-----------|---------|---------------------|
| 1 | ~~Dados da empresa no rodapé~~ ✅ (não confirmados, removidos) | P0 | feito | — |
| 2 | ~~Conteúdo por palavras-chave~~ ✅ (Linguagem Cidadã removida) | P0 | feito | — |
| 3 | ~~Mandato estadual por UF~~ ✅ | P0 | feito | — |
| 4 | ~~Domicílio no cadastro~~ ✅ | P0 | feito | — |
| 5 | ~~Fonte com pesos reais~~ ✅ (Inter local) | P1 | feito | — |
| 6 | ~~Subconjunto da fonte de ícones~~ ✅ | P1 | feito | — |
| 7 | ~~Testes e CI~~ ✅ | P1 | feito | — |
| 8 | ~~Contraste WCAG AA~~ ✅ | P1 | feito | — |
| 9 | ~~`rem` e fim dos estilos inline~~ ✅ | P2 | feito | — |
| 10 | ~~Validade do cache de presença~~ ✅ | P2 | feito | — |
| 11 | Foto no card de compartilhamento | P2 | — | Sim |
| 12 | ~~Atraso no onboarding~~ ✅ | P2 | feito | — |
