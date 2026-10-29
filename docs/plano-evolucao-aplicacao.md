# Plano de evolução da Cola Cidadã

Referência: 28/10/2026. Base analisada: `a912f837b9c7abaccd867020795e197644f12f4f` (`main`).

Este documento propõe **30 melhorias de recursos existentes e 30 novas funções**, com prioridades, critérios de aceite, dependências e ordem de execução. A fase 0 foi iniciada em 29/10/2026: o gasto fictício foi removido (M01), a restauração passou a validar estrutura e URLs e a gravação preserva o estado em caso de falha (parte de M02–M04). Os cabeçalhos da Cloudflare foram configurados e verificados no preview local (parte de M05). O pacote público isolado foi gerado e validado pelo Wrangler (M07, pendente confirmar em produção). O deploy autenticado continua bloqueado pelo código Cloudflare `9109`, devido à restrição de IP do token. Os demais critérios de conclusão seguem pendentes. Publicação web no plano gratuito da Cloudflare e dados pessoais mantidos no dispositivo são as premissas iniciais.

## 1. Diagnóstico do projeto

A aplicação tem duas interfaces: PWA em JavaScript/CSS, sem bundler, e Expo SDK 57 com React Native/TypeScript. Ambas consultam fontes públicas e mantêm a lista de acompanhamento no aparelho. Já existem Painel Público, perfis, acompanhamento, votações da Câmara e Senado, comparação entre deputados, alertas, contas públicas, contratos do PNCP, emendas, créditos de imagens e temas claro/escuro. Na web também existem backup JSON, relatório para impressão/PDF, cards de compartilhamento e ferramentas de análise textual.

O [CI do commit analisado](https://github.com/klivfy/Cola-Cidada/actions/runs/40808127323) está aprovado: 131 testes unitários web, 83 testes Expo, 118 testes de navegador aprovados e 12 ignorados por plataforma, além de tipagem, lint e exportação web do Expo. Isso demonstra a estabilidade dos caminhos cobertos; não confirma a exatidão de toda a informação exibida nem a publicação em produção.

### Problemas confirmados e limites da análise

| Evidência | Constatação | Consequência |
|---|---|---|
| [Feed](../src/views/inicio.js), bloco que adiciona a auditoria CEAP | Insere R$ 2.450, fornecedor fixo, data relativa ao momento e os selos “Validada” e “Preço Médio Regional”, sem fonte. Reproduzido no Chromium com resposta vazia da API. | Pode atribuir um gasto inexistente à pessoa acompanhada. É a primeira correção. |
| [Compartilhamento](../src/share.js) | Chama `strokeRoundRect` e `fillRoundRect`, sem implementação no projeto. Reproduzido: `ctx.strokeRoundRect is not a function`. Também mantém Actor e cores anteriores. | O PNG falha antes de lidar com a foto; o problema vai além de CORS. |
| [Estado web](../src/store.js) | `importJson` aceita `{"alerts":42,"prefs":null,"politicians":[]}`; reproduzido em contexto descartável de navegador. A gravação altera o estado antes de confirmar persistência. | Um backup malformado pode quebrar a interface ou substituir dados válidos. |
| [Cabeçalhos Vercel](../vercel.json), [Wrangler](../wrangler.jsonc), [fixtures](../tests/e2e/fixtures.mjs) | CSP e regras de cache estão configuradas para Vercel; não há `_headers` equivalente versionado. Testes utilizam a CSP da Vercel. | Falta comprovar as mesmas políticas na hospedagem Cloudflare. Não foi possível inspecionar a configuração remota autenticada. |
| Histórico da tentativa de publicação | Último deploy recebeu erro Cloudflare `9109`, por restrição de IP do token. | Publicação precisa de credencial compatível com a origem autorizada e de verificação da versão pública. Não basta o CI verde. |
| [Cliente de APIs](../src/api.js), [contas](../src/contas.js) | Alguns erros viram listas vazias; há caches por sessão sem validade. PNCP já possui timeout, enquanto o cliente principal não aplica o mesmo padrão. | Uma falha pode parecer ausência de registros; “atualizar” pode reapresentar dados antigos. |
| [Refresh](../src/refresh.js) | Atualiza apenas campos faltantes de ministros do STF acompanhados. | Partido, mandato, situação e titularidade de outras pessoas salvas podem ficar desatualizados. |
| [Comparador](../src/views/comparador.js) e [feed](../src/views/inicio.js) | Ausência de voto no mapa pode ser apresentada como “Ausente”. | É necessário diferenciar falta de registro, voto secreto, situação funcional e ausência confirmada. |
| [Alertas](../src/alerts.js), [tela](../src/views/alertas.js), [cabeçalho](../src/main.js) | Limiar fixo de R$ 5 mil; total de alertas tratado como não lidos; textos ainda dizem que gastos só cobrem deputados apesar de CEAPS implementada. | Preferências e contadores não representam completamente o funcionamento real. |
| [Atualização de dados](../.github/workflows/atualizar-dados.yml) | Agenda mensal; CEAPS, poderes e emendas da base analisada foram gerados em 15/10/2026. O próprio workflow alerta que PR aberto com GITHUB_TOKEN não dispara automaticamente o CI. | Precisa de cadência por fonte, validação da atualização e acompanhamento de falhas. A data de geração não é a competência de cada indicador. |
| [Perfil Expo](../expo-app/src/app/(tabs)/perfil.tsx), [store Expo](../expo-app/src/lib/store.tsx) | Não oferece a mesma edição de localidade e transferência de backup da web; falhas de gravação são silenciadas. | Paridade funcional e recuperação de dados ainda estão incompletas. |
| [README Expo](../expo-app/README.md), [app.json](../expo-app/app.json) | Não há confirmação de testes de notificações em dispositivo real; faltam identificadores oficiais para distribuição nativa. | Exportação web aprovada não comprova operação em Android/iOS. |
| [Testes estáticos](../tests/unit/static.test.mjs) | A proibição de textos fictícios é uma lista de expressões; não detectou o gasto simulado. Não foram encontrados snapshots visuais nem testes específicos de geração do PNG e importação inválida. | Cobertura deve validar conteúdo e resultado dos fluxos, além de renderização. |

Os testes adicionais desta análise usaram dados fictícios apenas em um contexto local descartável, nunca em produção. Não foi refeita uma auditoria de todas as APIs ao vivo, nem uma comparação visual completa de todas as telas com os arquivos Stitch. As propostas de integrações novas dependem de confirmar cobertura, licença, identificadores, CORS e custo da fonte.

## 2. Critérios de prioridade

- **P0 — corrigir antes de ampliar o uso:** informação falsa, perda de dados, política de segurança ou publicação sem confirmação.
- **P1 — uso diário:** encontrar informação, atualizar com confiança, retomar uma consulta e acompanhar mudanças sem ruído.
- **P2 — amadurecimento:** análises mais completas, experiência consistente e manutenção sustentável.
- **P3 — expansão:** integrações e jornadas novas com dependência externa ou maior custo.

Esforço indicativo por item, incluindo implementação e teste: **P = 1–2 dias úteis; M = 3–5; G = 6–10; X = mais de 10, após investigação**. Não são prazos prometidos. As estimativas não incluem espera por credenciais, decisões de produto, dados ausentes ou aprovação de lojas. Prioridade mede urgência; a fase considera também dependências.

## 3. Trinta melhorias de recursos existentes

| ID | Prioridade / esforço | Melhoria e motivo | Critério de conclusão |
|---|---|---|---|
| M01 | P0 / M | **Eliminar a despesa fictícia do feed.** Usar exclusivamente CEAP/CEAPS identificável e retirar selos de validação sem método ou evidência. | API vazia não produz despesas; valor, fornecedor, data e parlamentar correspondem à fonte; falha parcial não inventa registro. |
| M02 | P0 / M | **Validar e proteger a restauração de backup.** Schema, versão, limites de tamanho, tipos e prévia do que será substituído. | Arquivo inválido mantém o estado anterior; importação válida preserva dados; substituição é confirmada e recuperável. |
| M03 | P0 / M | **Tornar a persistência resiliente.** Tratar falta de espaço, indisponibilidade e corrupção em localStorage/AsyncStorage; migrar versões do estado. | Usuário recebe aviso acionável; falha de gravação não anuncia sucesso; migração mantém acompanhados e preferências. |
| M04 | P0 / M | **Validar URLs em dados importados e externos.** Escapar HTML não restringe esquemas de URL. Centralizar política de links e imagens. | `javascript:` e esquemas indevidos são rejeitados; links oficiais HTTPS e contatos previstos continuam funcionando. |
| M05 | P0 / M | **Aplicar cabeçalhos para Cloudflare.** Transportar CSP, política de referência, proteção contra MIME incorreto e regras do service worker para configuração compatível. | Testes no preview real de Wrangler verificam cabeçalhos, CSP e carregamento; depois repetir na URL pública. |
| M06 | P0 / M | **Concluir publicação rastreável.** Resolver autenticação autorizada, identificar commit publicado, verificar rotas e preparar reversão para versão conhecida. | URL pública entrega a revisão esperada, teste de instalação/atualização passa e procedimento de reversão está documentado. |
| M07 | P0 / M | **Isolar o pacote público.** Gerar diretório de assets por lista de inclusão e verificar limites vigentes do plano gratuito. | Manifesto contém somente arquivos públicos, com quantidade e tamanhos conferidos; dependências e arquivos privados não entram. |
| M08 | P0 / M | **Separar erro de consulta de resultado vazio.** Preservar informação sobre falha, carregamento parcial e dado ausente nos adaptadores e telas. | Falha de rede mostra indisponibilidade e nova tentativa; zero só aparece quando a fonte retornou zero ou lista vazia válida. |
| M09 | P1 / M | **Uniformizar resiliência de rede.** Timeout, cancelamento ao sair, deduplicação de requisições simultâneas, recuo em 429 e respeito a Retry-After. | Consulta não fica indefinidamente carregando; sair da tela cancela trabalho dispensável; taxa e erros são testados. |
| M10 | P1 / M | **Fazer “Atualizar” obter dados novos.** Definir validade dos caches de diretórios, Siconfi e PNCP e permitir atualização explícita. | Atualizar invalida o cache pertinente; dado reaproveitado mostra horário; falha mantém a última consulta identificada. |
| M11 | P1 / M | **Padronizar fonte, período e cobertura.** Mostrar competência, consulta, geração de arquivo, tamanho da amostra e limitações onde se lê o número. | Indicadores distinguem soma parcial e total; valores ausentes ficam explícitos; cada seção oferece sua fonte. |
| M12 | P1 / G | **Aprimorar atualização dos dados estáticos.** Cadência conforme a fonte, alertas de atraso, validação de diferenças e CI para os PRs gerados. | Falhas ficam visíveis à manutenção; arquivo incompleto não substitui o anterior; revisão de atualização é testada antes da publicação. |
| M13 | P1 / M | **Atualizar fichas de acompanhados.** Reconciliar pessoas por IDs oficiais, preservar escolha local e revisar exercício/mandato, inclusive transição de 2027. | Mudanças de partido ou situação são refletidas com data; não se transfere acompanhamento silenciosamente a um substituto. |
| M14 | P1 / M | **Corrigir semântica de voto e presença.** Diferenciar ausência confirmada, não participante, sem registro, licença e sigilo. | Falta de um voto no mapa não basta para rotular “Ausente”; comparações informam a amostra comum válida. |
| M15 | P1 / M | **Corrigir contadores e ciclo de leitura dos alertas.** Persistir lidos/não lidos e atualizar o indicador do cabeçalho. | Quantidade exibida corresponde aos não lidos, inclusive após recarregar, verificar ou restaurar backup. |
| M16 | P1 / P | **Revisar textos operacionais dos alertas e filtros.** Explicar consulta manual na PWA, restrições nativas, cobertura CEAPS e significado dos estados. | Interface não promete “alto impacto” nem envio em segundo plano sem suporte; rótulos correspondem aos dados realmente consultados. |
| M17 | P1 / M | **Restaurar o PNG de compartilhamento.** Corrigir operações do canvas, carregar Inter e aplicar a paleta Stitch também ao arquivo exportado. | Geração, prévia e download produzem PNG válido; nomes longos não se sobrepõem; testes cobrem a ausência de Web Share. |
| M18 | P2 / M | **Resolver a foto nos cards.** Preferir cópia pública local autorizada com crédito e atualização; oferecer iniciais quando a foto não puder ser usada. | PNG continua exportável com CORS bloqueado, sem foto ou com timeout; imagem não fica vinculada à pessoa errada. |
| M19 | P1 / M | **Aprimorar a verificabilidade do dossiê.** Hash do conteúdo canônico realmente exportado, fontes e períodos por seção, falhas parciais explícitas. | Alterar valor altera o hash; recomputação reproduz o código; texto não sugere certificação ou assinatura do órgão público. |
| M20 | P1 / G | **Revisar totais e cobertura do PNCP/Siconfi.** Paginação, duplicatas, identificação de instrumento e somas comparáveis. | Amostra de até 500 registros é distinguida do universo; contratos/aditivos não são somados como se fossem sempre despesa nova. |
| M21 | P1 / P | **Remover controles sem conteúdo correspondente.** Ex.: filtro “Comissões” do feed sem itens desse tipo e classificação temática sem indicação de estimativa. | Toda opção disponível produz conteúdo ou explica seu alcance; filtros preservam contexto e estado acessível. |
| M22 | P1 / G | **Completar paridade funcional do Expo.** Levar edição da localidade e backup/restauração já existentes na web para o app nativo. | Mesmos dados pessoais podem ser exportados e restaurados nos dois clientes; mudança de localidade altera os filtros pertinentes. |
| M23 | P2 / G | **Completar a coerência visual entre web, Expo e Stitch.** Matriz de componentes, tipografia, densidade, estados vazios e navegação, adaptada à plataforma. | Checklist por tela aprova claro/escuro, texto grande e estados com dados; diferenças intencionais são documentadas. |
| M24 | P1 / G | **Cobrir os fluxos que escaparam do CI.** Dados reais simulados por fixtures controladas, ausência de gastos inventados, backup, PNG, PDF e regressão visual. | Os defeitos M01/M02/M17 fazem os testes falhar antes das correções; snapshots usam dados estáveis, sem chamadas externas. |
| M25 | P1 / M | **Monitorar contratos das APIs oficiais.** Verificações pequenas e agendadas de formato, cobertura e disponibilidade, separadas do CI determinístico. | Mudança incompatível ou ausência anormal de dados gera diagnóstico por fonte sem tornar todos os PRs dependentes de serviço externo. |
| M26 | P2 / G | **Validar acessibilidade e operação em mais plataformas.** Firefox, WebKit, leitores de tela e aparelhos Android/iOS, incluindo notificações e restauração. | Matriz registra resultados e limitações reais; tarefas nativas são verificadas em build próprio, com identificadores oficiais. |
| M27 | P1 / G | **Controlar o ciclo de vida do cache offline.** Limites de armazenamento, política de expiração, atualização de versão e limpeza coerente com a ação de apagar dados. | Atualizar não deixa mistura de versões; volume fica limitado; escopo de exclusão é explicado e verificado. |
| M28 | P2 / G | **Reduzir custo de abertura e listas longas.** Carregamento por rota, imagens sob demanda, renderização incremental e orçamento de desempenho. | Medir antes/depois em perfil móvel fixo; evitar downloads de áreas não abertas e manter rolagem/foco estáveis. |
| M29 | P2 / G | **Reduzir divergência de regras web/Expo.** Extrair gradualmente schemas, normalização, IDs e cálculos testáveis; dividir views extensas. | Mesmas entradas geram os mesmos resultados nas duas interfaces; migração ocorre por domínio sem reescrita integral. |
| M30 | P2 / M | **Manter documentação e inventário de recursos verificáveis.** Matriz por plataforma, fonte, versão e cobertura; retirar trechos obsoletos e instruções de template. | Cada recurso documentado aponta para implementação e validação; limitações e pendências têm responsável e critério de encerramento. |

## 4. Trinta novas funções

“Nova” significa uma jornada que ainda não está completa no produto. Quando há algo relacionado, a diferença é indicada. Nenhuma função exige inferir em quem o usuário votou ou criar classificação partidária do cidadão.

| ID | Prioridade / esforço | Função e benefício cotidiano | Primeira entrega verificável / dependência |
|---|---|---|---|
| N01 | P1 / G | **Resumo “O que mudou desde sua última visita”.** Votações, gastos e projetos novos das pessoas acompanhadas. | Marco temporal local e agrupamento sem duplicatas; usa somente eventos rastreáveis. Depende de M01, M08, M11 e M15. |
| N02 | P1 / G | **Página “Minha região”.** Reunir representantes e contas da cidade/UF escolhidas. | Seleção explícita por código IBGE; cobertura não disponível é informada; sem exigir localização GPS. Depende de M11 e M22. |
| N03 | P1 / G | **Busca global.** Encontrar pessoas, órgãos e proposições disponíveis em uma única entrada. | Resultado mostra tipo, fonte e escopo pesquisado; busca atual por tela continua útil. Depende de M09 e identificadores estáveis. |
| N04 | P1 / M | **Consultas e filtros salvos.** Retomar uma combinação de casa legislativa, estado, tema e período após fechar o app. | Presets nomeados, editáveis e persistidos; não se limitam ao estado temporário já preservado por algumas telas. Depende de M02/M03. |
| N05 | P2 / M | **Listas temáticas de acompanhamento.** Organizar pessoas em grupos como município, saúde ou educação. | Mesma pessoa pode pertencer a várias listas; excluir lista não remove acompanhados sem decisão explícita. Depende de M03. |
| N06 | P1 / M | **Salvar registros para ler depois.** Favoritar votação, projeto, contrato ou nota fiscal, além de pessoas. | Favorito preserva ID, link, fonte e data; removível e incluído no backup. Depende de M02/M03. |
| N07 | P2 / M | **Anotações privadas por registro.** Registrar dúvidas e observações pessoais durante uma consulta. | Texto local associado a ID estável, editável, exportável e apagável; nenhum envio automático. Depende de N06 e M04. |
| N08 | P1 / M | **Pesquisa no histórico de alertas.** Buscar por pessoa, palavra, tipo e intervalo. | Combinar filtros e localizar alertas já lidos; explicar retenção de registros. Depende de M15 e M27. |
| N09 | P1 / M | **Regras pessoais de alerta.** Escolher limiar de gasto, categoria e pessoas, em lugar do único corte fixo. | Regra mostra seu alcance e uma prévia; valor alto não é rotulado como irregularidade. Depende de M16. |
| N10 | P2 / G | **Resumo periódico local e atualização ao retornar ao app.** Reduzir o esforço de tocar em verificar a cada uso. | Opt-in, intervalo mínimo e agrupamento; PWA atualiza quando aberta, Expo respeita agendamento do sistema. Depende de M09/M15/M26. |
| N11 | P1 / G | **Acompanhar proposições individuais.** Receber mudanças de tramitação mesmo sem acompanhar o autor. | Seguir/deixar de seguir por ID oficial; mostrar etapa atual e novo andamento documentado. Depende de M09/M11 e validação dos endpoints. |
| N12 | P2 / G | **Assinaturas de temas.** Acompanhar saúde, educação ou termo escolhido independentemente da pessoa. | Explicar por que o registro correspondeu ao tema; permitir editar/excluir critérios. Classificação estimada é identificada. Depende de N11. |
| N13 | P2 / G | **Calendário legislativo unificado.** Expandir a agenda curta da Câmara para calendário com Câmara e Senado. | Navegação por data, comissão e casa; estado de cancelamento/adiamento visível. Integração Senado exige prova da fonte. |
| N14 | P2 / M | **Lembretes de eventos e exportação de agenda.** Levar uma reunião ou audiência à agenda pessoal. | Exportação ICS com fuso e link oficial; lembrete opt-in e atualização de cancelamentos quando o app consultar a fonte. Depende de N13. |
| N15 | P1 / G | **Links diretos públicos para perfis e registros.** Abrir exatamente a pessoa ou votação compartilhada. | URL web reproduz contexto em sessão limpa, sem expor preferências privadas; integrar rotas Expo quando possível. Depende de M04. |
| N16 | P2 / G | **Comparação entre senadores.** Completar o confronto 1 contra 1 hoje disponível para deputados. | Mesma janela e votações comuns; sigilo e indisponibilidade não viram discordância. Depende de M14. |
| N17 | P2 / G | **Comparação entre três a cinco parlamentares.** Enxergar diferenças num grupo da mesma casa. | Matriz com período e amostra iguais, sem misturar cargos ou criar nota geral de “qualidade”. Depende de M14 e N16. |
| N18 | P2 / G | **Histórico de gastos por mês e categoria.** Superar a consulta das últimas despesas/amostras. | Escolher período e consultar composição com paginação/cobertura explícitas; CEAP e CEAPS identificadas. Depende de M10/M11/M20. |
| N19 | P3 / X | **Explorador de fornecedores por CNPJ.** Cruzar registros empresariais públicos já publicados em despesas e contratos. | Ligação por identificador, nunca só por nome; origem e cobertura visíveis; não concluir irregularidade pela relação. Depende de N18/N22. |
| N20 | P2 / G | **Séries históricas de receita e despesa pública.** Comparar evolução de um ente ao longo dos anos. | Mesma métrica e competência; mudanças metodológicas marcadas; opção real depende de índice oficial identificado. Depende de M11/M20. |
| N21 | P2 / G | **Comparador de municípios semelhantes.** Orçamento, execução e pessoal no mesmo período e, quando cabível, por habitante. | População/ano explícitos, cobertura municipal definida, sem ranking automático de melhor gestão. Depende de N02/N20. |
| N22 | P2 / G | **Explorador de contratos.** Pesquisar objeto, fornecedor, órgão, valor e período, além dos cinco contratos exibidos hoje. | Paginação utilizável, registro completo e fonte; nenhuma promessa de cobertura nacional integral no primeiro lançamento. Depende de M20. |
| N23 | P3 / X | **Linha do tempo de contrato e aditivos.** Acompanhar vigência, alterações e encerramento publicados. | Vínculos por identificadores oficiais; lacunas declaradas; aviso de alteração não implica suspeita. Depende de N22 e validação da API. |
| N24 | P3 / X | **Trilha de emenda até o destino e a execução.** Ligar parlamentar, beneficiário, transferência e contrato quando houver evidência. | Exibir separadamente os elos comprovados e os desconhecidos; não ligar só por nome ou coincidência de valor. Depende de N22/N23 e fontes adicionais. |
| N25 | P2 / M | **Exportar resultados em CSV/JSON aberto.** Baixar a consulta de votos, gastos ou contratos, sem exportar preferências privadas. | Arquivo inclui fonte, período e cobertura; neutraliza fórmulas perigosas em células CSV. Depende de M11/M20. |
| N26 | P2 / G | **Pacotes offline por região ou lista.** Escolher o que levar para uma conexão limitada. | Mostrar tamanho antes de baixar, data da última atualização e opção de remover pacote. Depende de M07/M27. |
| N27 | P3 / M | **Assistente de pedido de informação pela LAI.** Preparar texto a partir de uma lacuna encontrada. | Rascunho com órgão, período e referências; usuário revisa e envia pelo canal oficial. Não encaminha mensagens automaticamente. Depende de N02/N15. |
| N28 | P2 / M | **Comunicar possível erro com evidências.** Preparar relato sobre pessoa, valor ou fonte inconsistente. | Prévia com versão, link e trecho relevante, sem lista privada de acompanhados; envio só após ação explícita. Depende de M06/M11/N15. |
| N29 | P3 / X | **Ampliar cobertura municipal e legislativa regional.** Adicionar municípios e pilotos de votações estaduais/municipais. | Primeira cidade/assembleia com conector testado, fonte e manutenção definidas; expansão por cobertura comprovada. Depende de M12/M25/M29. |
| N30 | P2 / G | **Backup criptografado por senha.** Transferir arquivo entre aparelhos com proteção opcional. | Criptografia autenticada, parâmetros versionados, testes de senha incorreta/integridade e aviso sobre perda da senha. Sem sincronização central obrigatória. Depende de M02/M03/M22. |

## 5. Plano de ação faseado

A numeração abaixo define a sequência. Cada fase entrega incrementos menores; não é necessário esperar todos os 60 itens para publicar valor. Não iniciar uma expansão de fontes enquanto a origem e a integridade dos dados da base estiverem indefinidas.

| Fase | Itens, sem duplicação | Resultado e condição de saída |
|---|---|---|
| **0 — Informação confiável e publicação controlada** | M01–M08 | Remover o gasto fictício; proteger importação/persistência/links; distinguir erro e vazio; validar pacote, cabeçalhos e versão pública. A parte de publicação depende de resolver a autenticação Cloudflare. Entregar as correções locais mesmo enquanto essa dependência estiver aberta. |
| **1 — Estabilizar o uso diário** | M09–M17, M20–M21, M24, M27 | Atualização efetiva, origem e período legíveis, totais com cobertura correta, dados acompanhados atuais, presença correta, alertas coerentes e PNG funcional. Testes passam a cobrir os defeitos encontrados e a atualização offline. |
| **2 — Retomar e acompanhar em poucos passos** | M22, N01–N04, N06, N08–N09, N11, N15 | Região, busca, consultas salvas, favoritos, resumo de novidades, regras de alerta, projetos acompanhados e links diretos. Validar jornadas com usuários e backup entre plataformas. |
| **3 — Experiência consistente e manutenção previsível** | M18–M19, M23, M25–M26, M28–M30, N05, N07, N10, N26, N28, N30 | Design e exportações consistentes, verificabilidade dos relatórios, testes de fontes/aparelhos, desempenho e manutenção; listas, notas, pacotes offline e backup protegido. |
| **4 — Consulta e comparação aprofundadas** | N12–N14, N16–N18, N20–N22, N25 | Temas, calendário, comparações compatíveis, evolução financeira e exploração/exportação de contratos, usando a base de totais e cobertura validada em M20. |
| **5 — Novas fontes e participação** | N19, N23–N24, N27, N29 | Fornecedores, ciclo contratual, trilha de emendas, pedidos de informação e cobertura regional adicional. Cada integração começa com prova pequena de dados e custo. |

### Primeira rodada recomendada

1. **M01 imediatamente:** retirar o gasto fictício e criar um teste de comportamento com fonte vazia e com despesa identificada. Se a fonte real exigir mais trabalho, ocultar apenas o bloco sem evidência e entregar a correção.
2. **M02–M04:** schema versionado, importação com recuperação, gravação consistente e validação de URLs. Provar que arquivos inválidos não alteram a lista atual.
3. **M08:** conservar o motivo de falha na camada de dados e oferecer nova tentativa. Conferir Câmara, Senado e contas.
4. **M05–M07:** produzir o pacote público isolado, aplicar cabeçalhos Cloudflare, conferir limites atuais e testar em Wrangler. Publicar após liberar a credencial, verificar commit público e atualização de uma PWA já instalada.
5. **M17 e M24, antecipados da fase 1:** corrigir geração do card e automatizar os caminhos quebrados para que não escapem novamente do CI.

A correção emergencial M01 pode ser pequena e independente. A rodada inteira deve ser estimada após dividir M02–M08 em tarefas; não deve ser prometida como uma única alteração rápida. Não reservar prazo fixo para a liberação do token.

### Primeira rodada de novas funções

Depois de a fase 1 atingir seus critérios, entregar **N01, N02, N04, N06, N08, N09 e N15** primeiro. Esse conjunto atende à rotina “voltar, ver novidades, encontrar minha região, salvar algo e receber menos ruído”. N03 e N11 entram em seguida por exigirem mais busca e integração de dados.

## 6. Arquitetura, custos e limites do plano gratuito

- **Priorizar a PWA hospedada na Cloudflare.** A distribuição Expo é uma frente própria: builds, identificadores e contas das lojas não estão incluídos no plano gratuito de hospedagem web.
- **Manter os dados privados locais.** Filtros, notas, favoritos, regras e listas não precisam de login ou banco remoto. Se sincronização remota for proposta futuramente, avaliar separadamente autenticação, retenção, exclusão, proteção dos dados e custo.
- **Usar uma saída pública dedicada.** Publicar somente assets necessários. O log anterior de 65.976 arquivos “lidos” não prova quantos seriam publicados; contar o manifesto final, por tipo e tamanho, antes de comparar com os limites vigentes.
- **Evitar servidor por conveniência visual.** Para fotos, tentar assets locais autorizados e fallback. Proxy, Worker com lógica, D1, KV ou filas somente quando uma função provar a necessidade e tiver orçamento de requisições/armazenamento.
- **Atualizar dados públicos fora da navegação pesada.** Arquivos resumidos podem continuar sendo gerados por tarefas agendadas, com revisão e validação. Controlar tempo de CI e tamanho dos pacotes; quotas externas também precisam ser observadas.
- **Não prometer tempo real ou cobertura integral.** Câmara, Senado, Siconfi, PNCP e cadastros regionais têm disponibilidade, atraso e granularidade diferentes. Cada função apresenta o que consegue comprovar.
- **Notificações web e nativas têm escopos diferentes.** Sem serviço de push, a PWA pode verificar ao abrir/retornar. O sistema operacional decide a execução de tarefas nativas; não prometer horário exato.
- **Neutralidade dos indicadores.** Não criar nota única de “bom político”, inferir corrupção pelo valor de um contrato ou apresentar heurística como conclusão jurídica. Mostrar método, contexto e dados de origem.

## 7. Como medir se o plano melhorou o cotidiano

Metas iniciais a validar em ambiente controlado e sessões voluntárias; não são medições atuais nem exigem rastreamento de preferências políticas.

| Indicador | Meta inicial proposta |
|---|---|
| Integridade dos dados | Nenhum registro de gasto sem referência; todas as somas com período e cobertura. |
| Recuperação | Importação inválida nunca altera estado; backup válido recompõe lista e preferências. |
| Encontrar uma informação | Usuário encontra representante ou conta local em até 3 ações a partir da página inicial, após escolher a região. |
| Retomar a rotina | Resumo distingue novidades desde a última visita; contagem de alertas é verificável. |
| Conexão instável | Consulta tem timeout e recuperação; último dado é identificado como armazenado, nunca como recém-consultado. |
| Desempenho | Estabelecer baseline; buscar LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 no perfil móvel acordado, medindo a estrutura inicial separadamente da API externa. |
| Acessibilidade | Sem falhas graves nos cenários automatizados e revisão manual de teclado/leitor de tela nos fluxos prioritários. |
| Publicação | Commit da URL pública identificável, smoke test aprovado e versão anterior recuperável. |
| Operação | Atualizações públicas com fonte e competência; atraso gera aviso para manutenção. |

## 8. Responsabilidade e definição de pronto

- **Desenvolvimento:** implementar por item, preservar dados existentes e registrar testes/limitações.
- **Produto/design:** validar as tarefas de uso diário e a fidelidade visual ao Stitch, sem copiar dados demonstrativos.
- **Responsável pelos dados:** conferir fontes, períodos, ligações por ID e mudanças de ocupantes.
- **Responsável pela infraestrutura:** habilitar credenciais e domínio, confirmar quotas e verificar a publicação. A restrição Cloudflare é uma dependência externa identificada, não uma falha de CSS ou motivo para refazer a aplicação.

Um item só será encerrado com critério de aceite atendido, teste proporcional ao risco e documentação coerente. Quando envolver publicação, também exige verificação na URL real. CI aprovado sozinho não encerra uma verificação de conteúdo ou produção.

O trabalho anterior corrigiu regressões de fonte e teste offline, mas a conclusão de que restava somente deploy era incompleta. Esta análise inclui defeitos funcionais e de integridade confirmados e preserva a revisão Expo/Stitch como trabalho a concluir.
