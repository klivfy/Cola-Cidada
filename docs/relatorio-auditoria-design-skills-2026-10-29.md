# Auditoria de design e experiência — 29/10/2026

Base: `ef37b8b` (`main`). Escopo: PWA em `src/` e inspeção de código do app Expo em `expo-app/src/`. O produto é um painel cívico de consulta e acompanhamento, com dados oficiais, uso frequente e identidade brasileira definida pelo Stitch. A tela deve responder rapidamente **o que aconteceu, com quem, quando e em qual fonte**.

## Método e limites

- **Apple Design:** leitura da Skill e das referências de acessibilidade, layout, tipografia, cor, iOS, navegação, feedback e tradução para React Native. As recomendações Apple são aplicadas ao Expo e, na web, aos princípios gerais de legibilidade e adaptação; não se pressupõe que a PWA deva copiar componentes iOS.
- **Impeccable:** comando `context` executado; confirmou sistema visual existente e ausência de `PRODUCT.md` e `DESIGN.md`. Playbook de auditoria técnica lido. Detector em `src/views/painel.js` retornou `[]`; isso cobre padrões de código que ele reconhece, não prova a ausência de problemas visuais.
- **Emil Design Engineering:** revisão dos critérios de resposta, estados, velocidade e movimento da Skill. A tabela abaixo segue o formato Antes/Depois/Por quê exigido por ela.
- **Taste Skill:** lint de `src/` executado, com **43 FAIL e 41 WARN**. A inspeção visual automatizada `inspect.mjs --app` foi tentada, mas o Chromium local abortou por configuração do sandbox (`chrome-sandbox`), antes de capturar telas. Os números do lint são sinais para revisão, não 84 defeitos confirmados: várias regras são opinião estética da Skill e algumas se destinam a páginas de marketing, não a painéis de trabalho.

Nenhuma tela foi alterada nesta auditoria. Não houve teste em iPhone/Android físico, leitor de tela nativo, comparação pixel a pixel com o ZIP Stitch ou medição de contraste em imagem renderizada. O CI anterior passou em 131 testes unitários e 122 testes de navegador; isso sustenta os fluxos cobertos, não uma nota visual.

## Diagnóstico

A direção Stitch está presente: paleta semântica verde/azul/ouro, Inter local, temas claro e escuro, navegação móvel e conteúdo responsivo (`docs/design-stitch.md`, `src/styles.css`, `expo-app/src/constants/theme.ts`). O maior ganho agora está na clareza do trabalho cívico cotidiano: fonte e data junto ao dado, estados de erro distintos de ausência de registros, menos peso visual em superfícies repetidas e ações consistentes entre PWA e Expo.

| Prioridade | Antes, evidência no código | Depois proposto | Por quê / referência |
| --- | --- | --- | --- |
| P0 | O feed em `src/views/inicio.js` captura erro e mostra falha genérica, enquanto a agenda pode mostrar “Nenhum evento” após erro. `src/views/painel.js` já oferece “Tentar de novo” para PNCP e Tesouro. | Padronizar por fonte os estados carregando, vazio confirmado, falha, dado antigo e tentativa de novo; exibir a última consulta. | Impede que indisponibilidade seja interpretada como ausência de atividade. Apple HIG `feedback.md › Best practices`; Taste `app-screens.md › Empty, zero, loading and error states`. Relaciona-se a M08 do plano existente. |
| P0 | `src/views/perfil.js` usa `window.confirm` para restaurar backup, exibindo só contagens antes de substituir o estado. | Prévia com categorias, origem/versão, contagens e consequências; confirmação clara e retorno após falha. | Restauração envolve dados pessoais locais e precisa de contexto suficiente. Apple HIG `feedback.md › Best practices`; M02–M03. |
| P1 | O PWA tem múltiplos `box-shadow` e `backdrop-filter` em `src/styles.css`; o lint Taste marca 26 sombras, 19 ocorrências de vidro e quatro gradientes. | Revisar componentes em uso real; reservar relevo para sobreposições e usar superfícies tonais simples em cartões repetidos. Manter efeitos com função comprovada. | Reduz competição visual com os dados e custo de pintura; os números do lint incluem declarações e variantes, não 49 componentes distintos. Taste `app-screens.md › Surfaces`; julgamento de design, não violação automática. |
| P1 | A legenda do acompanhamento informa votos e aponta gastos para perfis; as seções de despesa estão espalhadas por perfis e alertas (`src/views/inicio.js`, `src/views/politicos.js`). | Criar resumo rastreável das últimas mudanças, agrupado por pessoa e tipo, com fonte, data e link para o detalhe. | Torna o acompanhamento útil em uma visita curta sem recompor várias telas. Taste `app-screens.md › Inventory the data and the jobs`; N01 existente. |
| P1 | `expo-app/src/constants/theme.ts` define tokens paralelos aos da web; a ficha Expo ainda não oferece backup e edição de localidade equivalentes à PWA (`docs/plano-evolucao-aplicacao.md`, M22). | Criar matriz de tokens e fluxos por plataforma; implementar primeiro backup/localidade no Expo e testar escalonamento de texto e áreas seguras. | Mesma tarefa deve manter significado e saída nas duas interfaces. Apple HIG `layout.md › Adaptability`, `accessibility.md › Vision`; `cross-platform.md › Conventions to check`. |
| P1 | `src/utilities.css:252` usa `transition:all`; `src/styles.css:2394` usa `ease-in-out` em shimmer contínuo; há animação longa de brilho no Expo (`expo-app/src/components/animated-icon.tsx`). | Nomear propriedades animadas, verificar repetição e custo, reduzir ou eliminar movimento frequente, preservar alternativas de movimento reduzido. | Melhora previsibilidade e evita trabalho visual sem informar estado. Emil `Animation Decision Framework`; a animação do ícone pode ser pontual e requer observação antes de removê-la. |
| P2 | O lint Taste encontra “eyebrow” em três vistas e um emoji em `src/analysis.js:339`. Os rótulos podem ter função real de orientação. | Conferir cada rótulo na tela; retirar apenas os redundantes e substituir o emoji por ícone/texto sem perda de sentido. | Evita padronização estética cega. Taste `lint.mjs`; Apple HIG `writing.md › Best practices`. |
| P2 | O comparador, alertas, painel público e perfil têm várias ações e filtros (`src/views/*`, `expo-app/src/app/(tabs)/*`). | Revisar a tarefa principal de cada tela e colocar ações frequentes no primeiro nível; mover ações raras para opções secundárias sem esconder fonte e cobertura. | Reduz decisões iniciais e preserva verificabilidade. Apple HIG `layout.md › Visual hierarchy`; Taste `app-screens.md › The run for an app screen`. |

### O que já funciona

- A paleta usa papéis de cor, não apenas cores soltas; existe tema escuro nas duas interfaces.
- Fontes e ícones web são locais, o que evita pedidos desnecessários a terceiros.
- A PWA já tem navegação móvel, foco, suporte a movimento reduzido e testes de acessibilidade. O PNCP e o Tesouro já mostram falha e ação de repetição, um bom padrão a ampliar.
- O conteúdo fictício de despesa foi retirado do feed antes desta auditoria. O avanço de design deve preservar a distinção entre fato oficial, estimativa e ausência de registro.

## Novas funções propostas a partir da auditoria

| Ordem | Função | Primeira entrega verificável | Dependência |
| --- | --- | --- | --- |
| 1 | **O que mudou desde a última visita** | Linha do tempo com eventos novos das pessoas acompanhadas, fonte e data, sem inventar registros. | M08, M11; N01 do plano existente. |
| 2 | **Central de fontes e atualização** | Estado por órgão: última consulta, período coberto, disponível/indisponível, botão de tentar de novo. | M08–M11. |
| 3 | **Consulta salva** | Guardar combinação de filtros e retomar em um toque, incluída no backup. | M02–M03; N04. |
| 4 | **Favoritos de registros** | Salvar votação, projeto, nota ou contrato por ID oficial; acesso por uma lista privada local. | M04, M11; N06. |
| 5 | **Minha região** | Reunir representantes e dados do município/UF escolhidos, com cobertura informada. | M11, M22; N02. |
| 6 | **Busca unificada** | Pesquisar pessoas, proposições e órgãos com tipo e fonte explícitos no resultado. | M09; N03. |
| 7 | **Prévia de backup e restauração por categorias** | Conferir o que será substituído e restaurar dados selecionados, com validação antes da troca. | M02–M03; expansão do fluxo existente. |
| 8 | **Preferências de apresentação** | Ajustar densidade e tamanho de texto sem alterar semântica, persistindo localmente e respeitando acessibilidade do sistema. | M23, M26. |

## Sequência recomendada

1. **Integridade e estados:** concluir M02–M08, inclusive erro versus vazio, segurança de dados, verificação de pacote/versão pública. O bloqueio Cloudflare `9109` permanece externo ao design.
2. **Fluxo diário:** fontes/atualização e “O que mudou”, seguidos de consultas salvas e favoritos. Validar com dados controlados e ausência de rede.
3. **Coerência visual:** fotografar todas as rotas PWA em 390/768/1440 px e Expo em aparelho, temas claro/escuro e texto ampliado; medir contraste e alvos; então revisar cartões, relevo, filtros e microinterações com um orçamento visual comum.
4. **Expansão:** Minha região, busca unificada e preferências de apresentação. Confirmar cobertura das fontes antes de prometer uma nova integração.

O plano de 30 melhorias e 30 funções em `docs/plano-evolucao-aplicacao.md` continua sendo o registro geral; este relatório identifica quais delas ganham força após a revisão das quatro Skills e acrescenta uma prévia de backup por categorias e preferências de apresentação como propostas específicas de experiência.
