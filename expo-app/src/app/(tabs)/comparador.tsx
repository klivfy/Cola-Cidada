import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { useStore } from '@/lib/store';
import type { CamaraVoting, CastVote, Category, Politician, SenateVoting } from '@/lib/types';
import { CATEGORY_LABELS, confront, loadCamaraComparison, loadSenateVotings, partyBreakdown } from '@/lib/votes';

type House = 'camara' | 'senado' | 'confronto';
const HOUSES: { key: House; label: string }[] = [
  { key: 'camara', label: 'Câmara' },
  { key: 'senado', label: 'Senado' },
  { key: 'confronto', label: '1 contra 1' },
];
const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

const shortName = (n: string) => n.split(' ').slice(0, 2).join(' ');
const fmtDate = (d?: string) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function Chip({ label, a11y, on, onPress }: { label: string; a11y?: string; on: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? theme.primaryContainer : theme.backgroundElement, borderColor: on ? theme.primary : theme.border }]}>
      <ThemedText type="small" style={{ color: on ? theme.primary : theme.text, fontWeight: on ? '700' : '400' }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function VoteTag({ vote }: { vote?: string | null }) {
  const theme = useTheme();
  const v = vote?.toLowerCase();
  const color = v === 'sim' ? theme.primary : v === 'não' ? theme.danger : theme.textSecondary;
  return (
    <ThemedText type="smallBold" style={{ color }}>
      {vote || 'Sem registro de voto'}
    </ThemedText>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>{children}</View>;
}

function Status({ loading, error, empty, onRetry, children }: { loading: boolean; error?: Error; empty?: string; onRetry: () => void; children?: React.ReactNode }) {
  if (loading) return <ActivityIndicator accessibilityLabel="Carregando votações" />;
  if (error)
    return (
      <Card>
        <ThemedText type="small">Não foi possível consultar as votações agora.</ThemedText>
        <Button label="Tentar de novo" variant="secondary" onPress={onRetry} />
      </Card>
    );
  if (empty)
    return (
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          {empty}
        </ThemedText>
      </Card>
    );
  return <>{children}</>;
}

/** Quem a pessoa acompanha, em destaque no cartão da votação. */
function Followed({ members, votes }: { members: Politician[]; votes: Record<string, string | null | undefined> }) {
  if (!members.length) return null;
  return (
    <View style={styles.members}>
      <ThemedText type="smallBold">Quem você acompanha</ThemedText>
      {members.map((p) => (
        <View key={p.id} style={styles.row}>
          <ThemedText type="small" numberOfLines={1} style={styles.flex}>
            {shortName(p.name)} ({p.party}/{p.uf})
          </ThemedText>
          <VoteTag vote={votes[p.id]} />
        </View>
      ))}
    </View>
  );
}

/** Tabela por partido e lista de todos os votos. Só é montada quando a pessoa abre (centenas de nomes por votação). */
function AllVotes({ votes, who }: { votes: CastVote[]; who: 'deputado' | 'senador' }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const parties = useMemo(() => (open ? partyBreakdown(votes) : []), [open, votes]);
  const list = useMemo(() => {
    if (!open) return [];
    const term = fold(q).trim();
    return [...votes]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .filter((v) => !term || fold(`${v.name} ${v.party} ${v.uf}`).includes(term))
      .slice(0, 60);
  }, [open, votes, q]);

  return (
    <View style={styles.gap}>
      <Button label={open ? 'Ocultar votos' : `Ver como votou cada partido e cada ${who} (${votes.length})`} variant="secondary" onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }} />
      {open ? (
        <>
          <View style={styles.gap} accessibilityLabel="Votos por partido">
            <View style={styles.row}>
              <ThemedText type="smallBold" style={styles.flex}>
                Partido
              </ThemedText>
              <ThemedText type="smallBold" style={styles.num}>Sim</ThemedText>
              <ThemedText type="smallBold" style={styles.num}>Não</ThemedText>
              <ThemedText type="smallBold" style={styles.num}>Outros</ThemedText>
            </View>
            {parties.map((p) => (
              <View key={p.party} style={styles.row} accessible accessibilityLabel={`${p.party}: ${p.Sim} sim, ${p.Não} não, ${p.Outros} outros`}>
                <ThemedText type="small" style={styles.flex}>
                  {p.party}
                </ThemedText>
                <ThemedText type="small" style={styles.num}>{p.Sim}</ThemedText>
                <ThemedText type="small" style={styles.num}>{p.Não}</ThemedText>
                <ThemedText type="small" style={styles.num}>{p.Outros}</ThemedText>
              </View>
            ))}
          </View>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={`Procurar ${who} nesta votação`}
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={`Procurar ${who} nesta votação`}
            autoCorrect={false}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
          />
          {list.map((v, i) => (
            <View key={`${v.id ?? v.name}-${i}`} style={styles.row} accessible accessibilityLabel={`${v.name}, ${v.party} ${v.uf}: ${v.vote}`}>
              <ThemedText type="small" style={styles.flex} numberOfLines={1}>
                {v.name} <ThemedText type="small" themeColor="textSecondary">{v.party}/{v.uf}</ThemedText>
              </ThemedText>
              <VoteTag vote={v.vote} />
            </View>
          ))}
          {votes.length > list.length && !q ? (
            <ThemedText type="small" themeColor="textSecondary">
              Mostrando 60 de {votes.length}. Use a busca para achar quem você procura.
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function CamaraCard({ v, deputies }: { v: CamaraVoting; deputies: Politician[] }) {
  const total = v.tally.Sim + v.tally.Não + v.tally.Outros || 1;
  const pct = Math.round((v.tally.Sim / total) * 100);
  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        {v.siglaOrgao} · {v.approved ? 'Aprovada' : 'Rejeitada'} · {fmtDate(v.data)}
      </ThemedText>
      <ThemedText type="smallBold" accessibilityRole="header">
        {v.descricao}
      </ThemedText>
      <ProgressBar pct={pct} label={`Sim ${pct}%`} />
      <ThemedText type="small" themeColor="textSecondary">
        Sim {v.tally.Sim} · Não {v.tally.Não} · Outros {v.tally.Outros}
      </ThemedText>
      <Followed members={deputies} votes={v.byPol} />
      <AllVotes votes={v.votes} who="deputado" />
    </Card>
  );
}

function SenateCard({ v, senators }: { v: SenateVoting; senators: Politician[] }) {
  const pct = Math.round((v.yes / (v.yes + v.no || 1)) * 100);
  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        {v.matter}{v.round ? ` (${v.round})` : ''} · {v.result || 'Deliberado'} · {fmtDate(v.date)}
      </ThemedText>
      <ThemedText type="smallBold" accessibilityRole="header">
        {v.summary || 'Deliberação no Senado Federal'}
      </ThemedText>
      {v.secret ? (
        <ThemedText type="small" themeColor="textSecondary">
          Votação secreta: a lista mostra quem votou, não como votou.
        </ThemedText>
      ) : v.yes + v.no > 0 ? (
        <>
          <ProgressBar pct={pct} label={`Sim ${pct}%`} />
          <ThemedText type="small" themeColor="textSecondary">
            Sim {v.yes} · Não {v.no}
          </ThemedText>
        </>
      ) : null}
      <Followed members={senators} votes={v.bySenator} />
      <AllVotes votes={v.votes} who="senador" />
    </Card>
  );
}

function Filters({ query, setQuery, category, setCategory }: { query: string; setQuery: (q: string) => void; category: Category; setCategory: (c: Category) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.gap}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar por palavra-chave"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Buscar votações por palavra-chave"
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={CATEGORY_LABELS[c]} on={category === c} onPress={() => setCategory(c)} />
        ))}
      </ScrollView>
    </View>
  );
}

function CamaraList({ deputies, all, query, category }: { deputies: Politician[]; all: Politician[]; query: string; category: Category }) {
  const ids = deputies.map((d) => d.camaraId).join(',');
  const res = useAsync(() => loadCamaraComparison(all, 12), [ids]);
  const q = fold(query).trim();
  const rows = (res.data ?? []).filter((v) => (!q || fold(v.descricao).includes(q)) && (category === 'geral' || v.category === category));
  return (
    <Status loading={res.loading && !res.data} error={res.error} onRetry={res.reload} empty={!rows.length ? 'Nenhuma votação nominal encontrada.' : undefined}>
      {rows.map((v) => (
        <CamaraCard key={v.id} v={v} deputies={deputies} />
      ))}
    </Status>
  );
}

function SenateList({ senators, all, query, category }: { senators: Politician[]; all: Politician[]; query: string; category: Category }) {
  const ids = senators.map((s) => s.senadoId).join(',');
  const res = useAsync(() => loadSenateVotings(all, 12), [ids]);
  const q = fold(query).trim();
  const rows = (res.data ?? []).filter((v) => (!q || fold(`${v.matter} ${v.summary}`).includes(q)) && (category === 'geral' || v.category === category));
  return (
    <Status loading={res.loading && !res.data} error={res.error} onRetry={res.reload} empty={!rows.length ? 'Nenhuma votação nominal encontrada.' : undefined}>
      {rows.map((v) => (
        <SenateCard key={v.key} v={v} senators={senators} />
      ))}
    </Status>
  );
}

/** Escolhe um deputado entre todos que votaram: busca por nome ou partido e mostra poucos resultados por vez. */
function DeputyPicker({ title, options, value, onChange }: { title: string; options: CastVote[]; value?: number; onChange: (id: number) => void }) {
  const theme = useTheme();
  const [q, setQ] = useState('');
  const picked = options.find((o) => o.id === value);
  const term = fold(q).trim();
  const matches = useMemo(
    () => (term ? options.filter((o) => fold(`${o.name} ${o.party} ${o.uf}`).includes(term)).slice(0, 6) : []),
    [options, term]
  );
  return (
    <View style={styles.gap}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" accessibilityLiveRegion="polite">
        {picked ? `${picked.name} (${picked.party}/${picked.uf})` : 'Nenhum escolhido'}
      </ThemedText>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Buscar por nome ou partido"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={`${title}: buscar por nome ou partido`}
        autoCorrect={false}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
      />
      {matches.map((o) => (
        <Chip
          key={o.id}
          label={`${shortName(o.name)} · ${o.party}/${o.uf}`}
          a11y={`${o.name}, ${o.party} ${o.uf}`}
          on={o.id === value}
          onPress={() => {
            onChange(o.id!);
            setQ('');
          }}
        />
      ))}
    </View>
  );
}

function Confronto({ followed }: { followed: Politician[] }) {
  const theme = useTheme();
  const res = useAsync(() => loadCamaraComparison(followed, 16), [followed.map((d) => d.camaraId).join(',')]);
  const [picks, setPicks] = useState<{ a?: number; b?: number }>({});

  const everyone = useMemo(() => {
    const all = new Map<number, CastVote>();
    for (const r of res.data ?? []) for (const v of r.votes) if (v.id && !all.has(v.id)) all.set(v.id, v);
    return [...all.values()].sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'));
  }, [res.data]);

  // sem escolha, começa por quem a pessoa acompanha (dois primeiros) ou pelos dois primeiros da lista
  const ids = followed.map((d) => d.camaraId!).filter((id) => everyone.some((o) => o.id === id));
  const defaults = ids.length >= 2 ? [ids[0], ids[1]] : [everyone[0]?.id, everyone[1]?.id];
  const a = picks.a ?? defaults[0];
  const b = picks.b ?? defaults[1];
  const result = res.data && a && b && a !== b ? confront(res.data, a, b) : null;
  const name = (id?: number) => (everyone.find((o) => o.id === id)?.name ?? '').split(' ')[0];

  return (
    <Status loading={res.loading && !res.data} error={res.error} onRetry={res.reload} empty={everyone.length < 2 ? 'Ainda não há votações suficientes para comparar.' : undefined}>
      <View style={styles.gap}>
        <ThemedText type="small" themeColor="textSecondary">
          Escolha dois deputados federais quaisquer para comparar os votos nas votações nominais recentes.
        </ThemedText>
        <DeputyPicker title="Deputado(a) A" options={everyone} value={a} onChange={(id) => setPicks((p) => ({ ...p, a: id }))} />
        <DeputyPicker title="Deputado(a) B" options={everyone} value={b} onChange={(id) => setPicks((p) => ({ ...p, b: id }))} />
        {a && a === b ? (
          <ThemedText type="small" themeColor="textSecondary">
            Escolha dois deputados diferentes.
          </ThemedText>
        ) : null}
        {result ? (
          <>
            <Card>
              <ThemedText type="small" themeColor="textSecondary">
                Convergência
              </ThemedText>
              <ThemedText type="heading" style={{ color: theme.primary }} accessibilityLabel={`${result.pct}% de alinhamento`}>
                {result.pct}% de alinhamento
              </ThemedText>
              <ProgressBar pct={result.pct} label="Alinhamento" />
              <ThemedText type="small" themeColor="textSecondary">
                {result.items.length} votações em comum: {result.matches} iguais, {result.diffs} divergentes.
              </ThemedText>
            </Card>
            {result.items.map((i) => (
              <Card key={i.id}>
                <ThemedText type="small" themeColor="textSecondary">
                  {i.same ? 'Votos iguais' : 'Divergência'} · {fmtDate(i.date)}
                </ThemedText>
                <ThemedText type="smallBold">{i.matter}</ThemedText>
                <View style={styles.row}>
                  <ThemedText type="small">{name(a)}</ThemedText>
                  <VoteTag vote={i.voteA} />
                </View>
                <View style={styles.row}>
                  <ThemedText type="small">{name(b)}</ThemedText>
                  <VoteTag vote={i.voteB} />
                </View>
              </Card>
            ))}
            {!result.items.length ? (
              <ThemedText type="small" themeColor="textSecondary">
                Nenhuma votação recente em que os dois tenham votado.
              </ThemedText>
            ) : null}
          </>
        ) : null}
      </View>
    </Status>
  );
}

export default function ComparadorScreen() {
  const router = useRouter();
  const { state } = useStore();
  const all = state.politicians;
  const deputies = all.filter((p) => p.camaraId);
  const senators = all.filter((p) => p.senadoId);
  const [house, setHouse] = useState<House>('camara');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('geral');

  return (
    <Screen title="Comparador Cívico" subtitle="Votações nominais recentes da Câmara e do Senado, abertas: placar, voto por partido e voto de cada parlamentar. Quem você acompanha aparece em destaque.">
      <View style={[styles.chips, styles.wrap]} accessibilityRole="tablist">
        {HOUSES.map((h) => (
          <Chip key={h.key} label={h.label} on={house === h.key} onPress={() => setHouse(h.key)} />
        ))}
      </View>
      {house !== 'confronto' ? <Filters query={query} setQuery={setQuery} category={category} setCategory={setCategory} /> : null}
      {house === 'camara' ? <CamaraList deputies={deputies} all={all} query={query} category={category} /> : null}
      {house === 'senado' ? <SenateList senators={senators} all={all} query={query} category={category} /> : null}
      {house === 'confronto' ? <Confronto followed={deputies} /> : null}
      {!all.length && house !== 'confronto' ? (
        <Button label="Abrir o Painel público" variant="secondary" onPress={() => router.navigate('/')} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: Spacing.two },
  wrap: { flexWrap: 'wrap' },
  chips: { flexDirection: 'row', gap: Spacing.two },
  chip: { minHeight: 44, paddingHorizontal: Spacing.three, borderRadius: 22, borderWidth: 1, justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.three, gap: Spacing.two },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: Spacing.three, fontSize: 16 },
  members: { gap: Spacing.one },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two, minHeight: 32 },
  num: { width: 48, textAlign: 'right' },
});
