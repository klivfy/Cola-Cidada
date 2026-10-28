# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Estrutura de pastas

Expo SDK 57, TypeScript (`strict`) e Expo Router com navegação por abas.

```
src/
  app/                    rotas (cada arquivo vira uma tela)
    _layout.tsx           raiz: tema, splash e uma pilha (Stack)
    (tabs)/               grupo das abas; "(tabs)" não aparece na URL
      _layout.tsx         monta a barra de abas
      index.tsx           Painel        → /             todos os cargos abertos, sem cadastro (Presidência, STF, Senado,
                                                        Câmara, governadores, assembleias, prefeitos e vereadores das capitais e das duas maiores cidades de cada estado)
      politicos.tsx       Acompanho     → /politicos    quem a pessoa escolheu acompanhar depois de ver o perfil
      comparador.tsx      Comparador    → /comparador   votações da Câmara e do Senado abertas (placar, voto por partido e de cada
                                                        parlamentar), filtros e confronto 1 contra 1 entre quaisquer deputados
      alertas.tsx         Alertas       → /alertas      votações do Plenário para todos; votos, gastos e projetos de quem se acompanha
      perfil.tsx          Perfil        → /perfil
    politico/[id].tsx     perfil: dados oficiais, cargo, TSE e o botão Acompanhar
  components/
    app-tabs.tsx          barra de abas nativa (iOS e Android)
    app-tabs.web.tsx      barra de abas da web
    themed-text.tsx, themed-view.tsx, ui/…   componentes compartilhados
  lib/                    dados e regras, sem dependência de tela
    api.ts                APIs de Dados Abertos da Câmara e do Senado (retry e cache)
    directory.ts          diretório do Painel (APIs + dados locais do TSE, Executivo e STF)
    contas.ts             contas públicas pelo Siconfi (RREO e RGF) e contratos das prefeituras pelo PNCP: aba Contas do Painel
    emendas.ts            emendas parlamentares desde 2023, por parlamentar e por cidade (instantâneo emendas.json)
    simbolos.ts           bandeiras dos partidos e dos estados, estado de nascimento do STF e fotos empacotadas (assets/ é gerado por sync-data)
    poderes.ts            gastos por Poder (Executivo, Legislativo, Judiciário): pessoal e limite da LRF, do instantâneo poderes.json
    votes.ts, alerts.ts   votações abertas e alertas (mesma lógica do PWA)
  data/                   cópia dos dados públicos do PWA (../src/data): rode `node scripts/sync-data.mjs` ao atualizá-los
    state.ts, store.tsx   estado (reducer) e persistência no AsyncStorage
    mandate.ts            mandatos padrão e progresso
    __tests__/            testes (npm test)
  constants/theme.ts      cores, espaçamentos
  hooks/                  use-color-scheme, use-theme
assets/                   ícones, splash e imagens
```

### Como acrescentar

- **Nova aba:** crie `src/app/(tabs)/perfil.tsx` e registre-a em `src/components/app-tabs.tsx` (um `NativeTabs.Trigger name="perfil"` com rótulo e ícone) e em `app-tabs.web.tsx` (um `TabTrigger`).
- **Tela fora da barra** (detalhe, modal): crie-a ao lado de `(tabs)`, por exemplo `src/app/modal.tsx`, e declare-a na pilha de `src/app/_layout.tsx` com `<Stack.Screen name="modal" options={{ presentation: 'modal' }} />`.
- **Tela com parâmetro:** `src/app/item/[id].tsx`.
- Rotas tipadas (`typedRoutes`) estão ligadas: `href` é conferido pelo TypeScript depois que o servidor gera os tipos em `.expo/types`.
- As abas nativas usam `expo-router/unstable-native-tabs` (SDK 55 a 57); no SDK 58 o caminho passa a ser `expo-router/native-tabs`.

## Privacidade (LGPD)

Nada é escolhido antes de ver: o Painel abre direto, com todos os cargos. "Acompanhar" é opcional, fica dentro do perfil e não
declara voto; a lista fica só no aparelho (AsyncStorage, mesma chave e formato do PWA).

O CI (`.github/workflows/ci.yml`, job "App Expo") roda tipos, lint, testes e confere se `src/data` está igual ao do PWA.

## Notificações

Os alertas aparecem na tela e são consultados quando a pessoa toca em "Verificar agora". Os avisos no aparelho são **opt-in**:
em Alertas, "Avisar quando houver alerta novo" pede a permissão do sistema, guarda sem avisar o que já existe e agenda uma
tarefa em segundo plano (`expo-background-task`, no mínimo a cada 15 minutos no Android; o sistema decide o horário, então o
aviso pode atrasar). A tarefa consulta as APIs públicas no próprio aparelho, guarda o que é novo e dispara uma notificação
local: até 3 avisos, ou um resumo se forem mais. Nada vai a servidor. A decisão do que avisar fica em `src/lib/notify-core.ts`
(testada em Node); o envio e a tarefa, em `src/lib/notifications.ts`. No navegador o interruptor fica desligado.

Verificado só no build web e em Node: a tarefa em segundo plano precisa de um aparelho (ou de um build de desenvolvimento) para ser testada.

### Builds nativos

Os perfis EAS ficam em `eas.json`. Use o perfil `development` para testar notificações e tarefas em segundo plano em um aparelho:

```bash
npx eas-cli@latest build --profile development
```

Antes de criar um build distribuível, configure no `app.json` os identificadores oficiais de Android e iOS (`android.package` e `ios.bundleIdentifier`). Eles dependem do cadastro da aplicação nas lojas e não são inferidos pelo projeto.

## Scripts

```bash
npm run start       # servidor de desenvolvimento
npm run android     # abre no Android
npm run ios         # abre no iOS (exige macOS)
npm run web         # abre na web
npm test            # jest (regras e camada de dados)
npm run lint        # expo lint
npx tsc --noEmit    # checagem de tipos
npx expo-doctor     # diagnóstico de dependências e configuração
```

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
