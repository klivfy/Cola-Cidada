// Alertas: o que mudou no Congresso desde a última verificação. Tudo é calculado neste aparelho a partir das APIs
// públicas; quem a pessoa acompanha nunca sai daqui.
import { deputyExpenses, deputyPropositions, senatorCeaps } from './api.js';
import { loadComparison, loadSenatePublic, mapLimit } from './votes.js';

export const EXPENSE_THRESHOLD = 5000;
export const unreadCount = (alerts = []) => alerts.filter((a) => a.read !== true).length;
const CEAPS_WINDOW_DAYS = 90;

const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dateBr = (iso) => new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR');
const short = (s, n = 140) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

// Preferências antigas não têm `plenario`: ausente conta como ligado.
export const prefOn = (prefs, k) => prefs?.[k] !== false;

/**
 * Reúne os alertas novos possíveis. `deps` permite trocar as consultas nos testes.
 * Cada alerta: { id, ts, kind: 'plenario'|'votacao'|'gasto'|'proposicao', text, politicianId?, url? }
 */
export async function collectAlerts({ politicians = [], prefs = {} }, deps = {}) {
  const {
    camara = loadComparison,
    senado = loadSenatePublic,
    expenses = deputyExpenses,
    bills = deputyPropositions,
    ceaps = senatorCeaps,
  } = deps;
  const deputies = politicians.filter((p) => p.camaraId);
  const senators = politicians.filter((p) => p.senadoId);
  const wantPlenary = prefOn(prefs, 'plenario');
  const wantVotes = prefOn(prefs, 'rollcall') && (deputies.length || senators.length);
  const out = [];
  const failures = [];

  if (wantPlenary || wantVotes) {
    const [cam, sen] = await Promise.allSettled([camara(politicians, 10), senado(politicians, 10)]);
    if (cam.status === 'fulfilled') {
      for (const v of cam.value) {
        const ts = v.dataHoraRegistro || v.data || new Date().toISOString();
        if (wantPlenary && cam.value.indexOf(v) < 6) {
          out.push({ id: `plen-camara:${v.id}`, ts, kind: 'plenario', text: `Câmara — ${short(v.descricao || 'Votação nominal no Plenário')}` });
        }
        if (wantVotes)
          for (const d of deputies) {
            const vote = v.byPol?.[d.id];
            if (vote)
              out.push({
                id: `camara:${v.id}:${d.id}`, ts, kind: 'votacao', politicianId: d.id,
                text: `${d.name} (${d.party}/${d.uf}) votou ${vote.toUpperCase()} na Câmara — ${short(v.descricao || 'Votação nominal no Plenário')}`,
              });
          }
      }
    } else failures.push('Câmara');
    if (sen.status === 'fulfilled') {
      sen.value.forEach((v, i) => {
        const ts = v.date || new Date().toISOString();
        if (wantPlenary && i < 6) {
          const placar = v.secret ? 'votação secreta' : `Sim ${v.yes}, Não ${v.no}`;
          out.push({ id: `plen-senado:${v.key}`, ts, kind: 'plenario', text: `Senado — ${v.matter}${v.round ? ` (${v.round})` : ''}: ${v.result || 'votado'} (${placar}). ${short(v.summary, 110)}` });
        }
        if (wantVotes)
          for (const s of senators) {
            const vote = v.bySenator?.[s.id];
            if (vote)
              out.push({
                id: `senado:${v.key}:${s.id}`, ts, kind: 'votacao', politicianId: s.id,
                text: `${s.name} (${s.party}/${s.uf}) votou ${vote.toUpperCase()} no Senado — ${v.matter}${v.round ? ` (${v.round})` : ''}: ${short(v.summary, 90)}`,
              });
          }
      });
    } else failures.push('Senado');
  }

  // Projetos só existem na API da Câmara (deputados federais); gastos dos deputados também.
  // (Os gastos dos senadores vêm do resumo da cota, mais abaixo.)
  if (deputies.length && (prefOn(prefs, 'expenses') || prefOn(prefs, 'bills'))) {
    await mapLimit(deputies, 3, async (d) => {
      if (prefOn(prefs, 'expenses')) {
        try {
          for (const e of await expenses(d.camaraId, 30)) {
            if (!(e.value >= EXPENSE_THRESHOLD)) continue;
            out.push({
              id: `ceap:${d.camaraId}:${e.docNumber || ''}:${e.date}:${e.value}`, ts: e.date || new Date().toISOString(), kind: 'gasto',
              politicianId: d.id, url: e.receiptUrl || undefined,
              text: `${d.name} (${d.party}/${d.uf}) usou ${brl(e.value)} da cota parlamentar${e.date ? ` em ${dateBr(e.date)}` : ''} — ${e.type}${e.supplier ? `, ${e.supplier}` : ''}`,
            });
          }
        } catch {
          failures.push(`gastos de ${d.name}`);
        }
      }
      if (prefOn(prefs, 'bills')) {
        try {
          for (const p of await bills(d.camaraId, 5)) {
            out.push({
              id: `prop:${p.id}:${d.camaraId}`, ts: p.date || new Date().toISOString(), kind: 'proposicao',
              politicianId: d.id, url: p.url,
              text: `${d.name} (${d.party}/${d.uf}) é autor(a) do ${p.type} ${p.number}/${p.year} — ${short(p.summary, 120)}`,
            });
          }
        } catch {
          failures.push(`projetos de ${d.name}`);
        }
      }
    });
  }

  // Cota dos senadores: o resumo do app traz as despesas grandes mais recentes (scripts/build-ceaps.mjs).
  if (senators.length && prefOn(prefs, 'expenses')) {
    const since = new Date(Date.now() - CEAPS_WINDOW_DAYS * 864e5).toISOString().slice(0, 10);
    for (const s of senators) {
      try {
        const entry = await ceaps(s.senadoId);
        for (const e of entry?.grandes || []) {
          if (e.data < since || !(e.valor >= EXPENSE_THRESHOLD)) continue;
          out.push({
            id: `ceaps:${s.senadoId}:${e.id}`, ts: e.data, kind: 'gasto', politicianId: s.id,
            text: `${s.name} (${s.party}/${s.uf}) usou ${brl(e.valor)} da cota parlamentar em ${dateBr(e.data)} — ${e.tipo}${e.fornecedor ? `, ${e.fornecedor}` : ''}`,
          });
        }
      } catch {
        failures.push(`cota de ${s.name}`);
      }
    }
  }

  out.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  return { alerts: out, failures };
}
