# Direção visual: Cola Cidadã e Stitch

O material Stitch orienta a hierarquia editorial, as superfícies tonais, os cartões, os filtros e a navegação inferior móvel. A identidade em produção usa os tokens semânticos de `src/styles.css` e `expo-app/src/constants/theme.ts`: verde para ações, azul para seleção, ouro para destaques e superfícies cinza claras. Os temas claro e escuro são definidos separadamente.

Os valores do material exportado divergem entre o documento e as telas; por isso, antes de trocar um par de cores, verifique o contraste no contexto real. Texto normal deve alcançar 4,5:1 e texto grande 3:1. Alertas e estados devem ter texto ou ícone além da cor.

O layout segue margens móveis de 16 px, escala de espaçamento baseada em 4 e 8 px e conteúdo central com largura máxima de 1200 px. A web usa barra lateral fixa no desktop, três colunas no painel de acompanhamento e navegação inferior no celular. Navegação e filtros precisam continuar acessíveis por teclado e indicar seu estado também para tecnologias assistivas. Inter e os ícones são servidos localmente.

As telas Stitch de login e cadastro de voto são propostas visuais, não funcionalidades confirmadas. A aplicação continua usando seus fluxos e dados reais; não introduzir conta ou coleta de dados apenas para reproduzir o protótipo.
