import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PoliticianCard } from '@/components/politician-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ScreenHeader, screenContent } from '@/components/ui/screen';
import { useSnackbar } from '@/components/ui/snackbar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/lib/store';

export default function PoliticosScreen() {
  const router = useRouter();
  const theme = useTheme();
  const snackbar = useSnackbar();
  const { state, ready, remove } = useStore();

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <FlatList
          data={state.politicians}
          keyExtractor={(p) => p.id}
          contentContainerStyle={screenContent}
          ListHeaderComponent={
            <View style={styles.header}>
              <ScreenHeader
                title="Quem acompanho"
                subtitle="Atalhos para quem você escolheu acompanhar depois de ver o perfil. A lista fica só neste aparelho e não diz em quem você votou."
              />
              <Button label="Abrir o Painel público" variant="secondary" onPress={() => router.navigate('/')} />
              {ready && state.politicians.length > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {state.politicians.length} {state.politicians.length === 1 ? 'pessoa acompanhada' : 'pessoas acompanhadas'}
                </ThemedText>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            ready ? (
              <View style={[styles.empty, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText type="smallBold" accessibilityRole="header">
                  Você ainda não acompanha ninguém
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Todos os cargos estão abertos no Painel público. Abra um perfil e toque em “Acompanhar”, se quiser.
                </ThemedText>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <PoliticianCard
              politician={item}
              onPress={() => router.push({ pathname: '/politico/[id]', params: { id: item.id } })}
              onRemove={() => {
                const undo = remove(item.id);
                snackbar.show(`Você deixou de acompanhar ${item.name}.`, { label: 'Desfazer', onPress: undo });
              }}
            />
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { gap: Spacing.three, marginBottom: Spacing.one },
  empty: { borderRadius: 12, borderWidth: 1, padding: Spacing.four, gap: Spacing.two },
});
