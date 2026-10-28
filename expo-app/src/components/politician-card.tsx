import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { PartyChip } from '@/components/party-chip';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { mandateProgress, ROLES } from '@/lib/mandate';
import { isMagistrate, partyOrBirth } from '@/lib/simbolos';
import type { Politician } from '@/lib/types';

interface Props {
  politician: Politician;
  onPress?: () => void;
  onRemove?: () => void;
}

export function PoliticianCard({ politician: p, onPress, onRemove }: Props) {
  const theme = useTheme();
  const m = mandateProgress(p);
  const role = ROLES[p.roleKey]?.label ?? '';

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${p.name}, ${role}, ${partyOrBirth(p).replace('/', ' ')}. Abrir ficha`}
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}>
        <Avatar name={p.name} uri={p.photo} />
        <View style={styles.info}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {p.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {role}
            {isMagistrate(p) ? '' : ` • ${p.uf}`}
          </ThemedText>
          <PartyChip politician={p} />
        </View>
      </Pressable>

      <View style={styles.progress}>
        <View style={styles.progressRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Mandato{m.end ? ` até ${m.end}` : ''}
          </ThemedText>
          <ThemedText type="smallBold">{m.pct}%</ThemedText>
        </View>
        <ProgressBar pct={m.pct} label={`Mandato de ${p.name}`} />
        <ThemedText type="small" themeColor="textSecondary">
          {m.label}
        </ThemedText>
      </View>

      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${p.name} do acompanhamento`} onPress={onRemove} style={styles.remove}>
          <ThemedText type="smallBold" style={{ color: theme.danger }}>
            Remover
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: 1, padding: Spacing.three, gap: Spacing.three },
  main: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  pressed: { opacity: 0.7 },
  info: { flex: 1, gap: Spacing.half },
  progress: { gap: Spacing.one },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  remove: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: Spacing.two },
});
