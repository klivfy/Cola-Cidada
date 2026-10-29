import { recentNominalVotings, votesOf, senatorVotes, senateNominalVotings, senateWindow } from './api.js';

// A API da Câmara derruba conexões em rajadas: no máximo `limit` consultas ao mesmo tempo.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const tallyOf = (votes) => {
  const t = { Sim: 0, Não: 0, Outros: 0 };
  for (const v of votes) t[v.vote === 'Sim' || v.vote === 'Não' ? v.vote : 'Outros']++;
  return t;
};

// Quantos de cada partido votaram Sim, Não ou outra coisa (obstrução, abstenção, art. 17...), maiores bancadas primeiro.
export function partyBreakdown(votes) {
  const map = new Map();
  for (const v of votes) {
    const k = v.party || 'Sem partido';
    if (!map.has(k)) map.set(k, { party: k, Sim: 0, Não: 0, Outros: 0, total: 0 });
    const row = map.get(k);
    row[v.vote === 'Sim' || v.vote === 'Não' ? v.vote : 'Outros']++;
    row.total++;
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.party.localeCompare(b.party, 'pt-BR'));
}

// Votações nominais recentes da Câmara com o voto de todos os deputados (dado público) e, à parte,
// o de quem a pessoa acompanha (byPol), para os cartões e os alertas.
export async function loadComparison(politicians = [], limit = 8, onPartial = () => {}) {
  const deputies = politicians.filter((p) => p.camaraId);
  // só votações nominais do Plenário: as simbólicas não têm lista de votos
  const votings = await recentNominalVotings(limit + 4);
  let failed = 0;
  const rows = await mapLimit(votings, 3, async (v) => {
    try {
      const raw = await votesOf(v.id);
      if (!raw.length) return null;
      const votes = raw.map((x) => ({
        id: x.deputado_?.id,
        name: x.deputado_?.nome || 'Deputado(a)',
        party: x.deputado_?.siglaPartido || '',
        uf: x.deputado_?.siglaUf || '',
        vote: x.tipoVoto,
      }));
      const byPol = {};
      for (const d of deputies) byPol[d.id] = votes.find((x) => x.id === d.camaraId)?.vote ?? null;
      return { ...v, votes, tally: tallyOf(votes), byPol, category: getThematicCategory(v.descricao || '') };
    } catch {
      failed += 1;
      return null;
    }
  });
  if (failed && failed === votings.length) throw new Error('Falha ao consultar os votos da Câmara');
  if (failed) onPartial(failed);
  return rows.filter(Boolean).slice(0, limit);
}

const SENATE_RESULT = { A: 'Aprovado', R: 'Rejeitado' };

// "…, em primeiro turno." → "1º turno": a mesma matéria tem votações diferentes por turno.
export function roundOf(description = '') {
  const m = String(description).match(/em (primeiro|segundo|terceiro|único) turno/i)?.[1]?.toLowerCase();
  return m ? { primeiro: '1º turno', segundo: '2º turno', terceiro: '3º turno', único: 'turno único' }[m] : '';
}

// Votações nominais recentes do Plenário do Senado com o voto de todos os senadores presentes.
// Voto secreto aparece como tal; quem não estava (NA) fica de fora.
export async function loadSenatePublic(politicians = [], limit = 10) {
  const senators = politicians.filter((p) => p.senadoId);
  const { since, until } = senateWindow();
  const votings = await senateNominalVotings(since, until);
  return votings
    .filter((v) => (v.votos || []).length)
    .sort((a, b) => String(b.dataSessao).localeCompare(String(a.dataSessao)))
    .slice(0, limit)
    .map((v) => {
      const secret = v.votacaoSecreta === 'S';
      const votes = (v.votos || [])
        .filter((x) => x.siglaVotoParlamentar && x.siglaVotoParlamentar !== 'NA')
        .map((x) => ({
          id: x.codigoParlamentar,
          name: x.nomeParlamentar || 'Senador(a)',
          party: x.siglaPartidoParlamentar || '',
          uf: x.siglaUFParlamentar || '',
          vote: secret && x.siglaVotoParlamentar === 'Votou' ? 'Voto secreto' : x.siglaVotoParlamentar,
        }));
      const tally = tallyOf(votes);
      const bySenator = {};
      for (const s of senators) bySenator[s.id] = votes.find((x) => x.id === Number(s.senadoId))?.vote ?? null;
      return {
        key: v.codigoSessaoVotacao,
        matter: v.identificacao || 'Matéria',
        round: roundOf(v.descricaoVotacao),
        summary: v.ementa || v.descricaoVotacao || '',
        date: v.dataSessao || '',
        result: SENATE_RESULT[v.resultadoVotacao] || v.resultadoVotacao || '',
        secret,
        yes: Number(v.totalVotosSim ?? tally.Sim) || tally.Sim,
        no: Number(v.totalVotosNao ?? tally.Não) || tally.Não,
        votes,
        tally,
        bySenator,
        category: getThematicCategory(`${v.identificacao || ''} ${v.ementa || ''}`),
      };
    });
}

// Retorna votações nominais consolidadas do Senado Federal para os senadores monitorados.
export async function loadSenateComparison(politicians, limit = 10) {
  const senators = politicians.filter((p) => p.senadoId);
  if (!senators.length) return [];

  const results = await Promise.all(
    senators.map(async (s) => {
      const votes = await senatorVotes(s.senadoId, limit);
      return { senator: s, votes };
    })
  );

  const map = new Map();
  for (const { senator, votes } of results) {
    for (const v of votes) {
      const key = v.matter || v.summary || v.code;
      if (!map.has(key)) {
        map.set(key, {
          matter: v.matter,
          summary: v.summary,
          date: v.date,
          result: v.result,
          yes: v.yes,
          no: v.no,
          category: getThematicCategory(`${v.matter} ${v.summary}`),
          bySenator: {},
        });
      }
      map.get(key).bySenator[senator.id] = v.vote;
    }
  }

  return Array.from(map.values()).slice(0, limit);
}

// Categorizador temático de matérias
export function getThematicCategory(text = '') {
  const t = text.toLowerCase();
  if (
    t.includes('tribut') ||
    t.includes('impost') ||
    t.includes('financ') ||
    t.includes('orçament') ||
    t.includes('fiscal') ||
    t.includes('receita') ||
    t.includes('ldo') ||
    t.includes('loa')
  ) {
    return 'economia';
  }
  if (
    t.includes('inteligência') ||
    t.includes('ia') ||
    t.includes('tecnolog') ||
    t.includes('digital') ||
    t.includes('internet') ||
    t.includes('dado') ||
    t.includes('software')
  ) {
    return 'tecnologia';
  }
  if (
    t.includes('indígen') ||
    t.includes('terra') ||
    t.includes('ambient') ||
    t.includes('florest') ||
    t.includes('clima') ||
    t.includes('carbon') ||
    t.includes('solar')
  ) {
    return 'meio-ambiente';
  }
  if (
    t.includes('saúde') ||
    t.includes('medicament') ||
    t.includes('hospital') ||
    t.includes('sus') ||
    t.includes('educa') ||
    t.includes('escola') ||
    t.includes('criança') ||
    t.includes('idoso')
  ) {
    return 'social-saude';
  }
  if (t.includes('seguran') || t.includes('penal') || t.includes('crime') || t.includes('polícia') || t.includes('arm')) {
    return 'seguranca';
  }
  return 'geral';
}
