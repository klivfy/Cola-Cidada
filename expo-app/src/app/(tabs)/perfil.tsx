import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useSnackbar } from '@/components/ui/snackbar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { credits, type Credit } from '@/lib/creditos';
import { useStore } from '@/lib/store';

function CreditList({ title, items }: { title: string; items: Credit[] }) {
  return (
    <View style={styles.list}>
      <ThemedText type="smallBold" accessibilityRole="header">
        {title}
      </ThemedText>
      {items.map((c) => (
        <ThemedText key={c.titulo} type="small" themeColor="textSecondary" accessibilityRole="link" onPress={() => Linking.openURL(c.url)}>
          {c.titulo}: {c.texto}
        </ThemedText>
      ))}
    </View>
  );
}

/** Créditos das imagens: fotos do STF (autor e licença), bandeiras dos partidos e dos estados. */
function CreditsCard({ style }: { style: object[] }) {
  const [open, setOpen] = useState(false);
  const c = open ? credits() : null;
  return (
    <View style={style}>
      <ThemedText type="smallBold" accessibilityRole="header">
        Créditos das imagens
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Fotos dos governadores, prefeitos, deputados estaduais e vereadores: Tribunal Superior Eleitoral (dados abertos de 2022 e 2024). Fotos dos deputados federais e senadores: Câmara dos Deputados e Senado Federal. Ministros do STF não têm vínculo partidário: no lugar do partido, o app mostra o estado onde nasceram (Wikidata, conferido pela data de nascimento).
      </ThemedText>
      <Button label={open ? 'Ocultar a lista' : 'Ver fotos do STF e bandeiras'} variant="secondary" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} />
      {c ? (
        <>
          <CreditList title="Fotos dos ministros do STF (Wikimedia Commons)" items={c.ministros} />
          <CreditList title="Bandeiras dos partidos (Wikimedia Commons, domínio público)" items={c.partidos} />
          <CreditList title="Bandeiras dos estados (Wikimedia Commons, domínio público)" items={c.estados} />
          <ThemedText type="small" themeColor="textSecondary">
            Nomes, logos e bandeiras de partidos podem ser marcas registradas dos respectivos partidos; aparecem aqui apenas para identificá-los.
          </ThemedText>
        </>
      ) : null}
    </View>
  );
}

export default function PerfilScreen() {
  const theme = useTheme();
  const snackbar = useSnackbar();
  const { state, storageError, retryStorage, purge } = useStore();
  const [confirming, setConfirming] = useState(false);
  const card = [styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  return (
    <Screen title="Perfil" subtitle="Privacidade e dados.">
      <View style={card}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Seus dados ficam só neste aparelho
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          O Cola Cidadã não tem servidor nem conta: a lista de políticos que você acompanha é guardada neste aparelho, e as consultas
          vão direto às APIs de Dados Abertos da Câmara dos Deputados e do Senado Federal.
        </ThemedText>
        <ThemedText type="small">
          Acompanhando agora: {state.politicians.length} {state.politicians.length === 1 ? 'político' : 'políticos'}.
        </ThemedText>
      </View>

      <CreditsCard style={card} />

      {storageError ? (
        <View style={card}>
          <ThemedText type="smallBold" accessibilityRole="alert">Não foi possível {storageError === 'read' ? 'ler' : 'salvar'} os dados neste aparelho</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {storageError === 'read'
              ? 'Os dados anteriores foram preservados. Tente ler novamente antes de fazer alterações.'
              : 'Confira o espaço disponível. As alterações recentes podem não estar salvas.'}
          </ThemedText>
          <Button label="Tentar novamente" variant="secondary" onPress={async () => {
            if (await retryStorage()) snackbar.show('Armazenamento disponível novamente.');
            else snackbar.show('Ainda não foi possível acessar o armazenamento.');
          }} />
        </View>
      ) : null}

      <View style={card}>
        <ThemedText type="smallBold" accessibilityRole="header">
          Apagar meus dados
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Remove a lista de políticos e as preferências deste aparelho. Não dá para desfazer.
        </ThemedText>
        {confirming ? (
          <View style={styles.row}>
            <Button label="Cancelar" variant="secondary" onPress={() => setConfirming(false)} />
            <Button
              label="Apagar tudo"
              variant="danger"
              onPress={async () => {
                if (await purge()) {
                  setConfirming(false);
                  snackbar.show('Dados apagados deste aparelho.');
                } else snackbar.show('Não foi possível apagar os dados deste aparelho.');
              }}
            />
          </View>
        ) : (
          <Button label="Apagar meus dados" variant="danger" onPress={() => setConfirming(true)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  list: { gap: Spacing.one },
});
