// Cliente das APIs de Dados Abertos da Câmara dos Deputados e do Senado Federal (as mesmas do PWA).
import type { DeputyProfile, DeputyResult, Proposition, SenatorResult } from './types';
import { currentLegislature } from './legislature';

export const CAMARA_BASE = 'https://dadosabertos.camara.leg.br/api/v2';
export const SENADO_BASE = 'https://legis.senado.leg.br/dadosabertos';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { json: unknown; at: number }>();

export function clearApiCache() {
  cache.clear();
  senatorsCache = null;
  deputiesCache = null;
}

/**
 * A API da Câmara derruba conexões sob rajadas: repete falhas de rede, 429 e 5xx com espera crescente.
 * Respostas ficam em cache por 5 minutos.
 */
export async function getJson<T = any>(url: string, retryDelayMs = 600): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.json as T;
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} para ${url}`);
        continue;
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} para ${url}`), { final: true });
      const json = await res.json();
      cache.set(url, { json, at: Date.now() });
      return json as T;
    } catch (err) {
      if ((err as { final?: boolean }).final) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

/* ================= CÂMARA DOS DEPUTADOS ================= */

export async function searchDeputies(name: string): Promise<DeputyResult[]> {
  const q = encodeURIComponent(name.trim());
  const { dados } = await getJson(`${CAMARA_BASE}/deputados?nome=${q}&itens=8&ordem=ASC&ordenarPor=nome`);
  return (dados || []).map((d: any) => ({
    camaraId: d.id,
    name: d.nome,
    party: d.siglaPartido,
    uf: d.siglaUf,
    photo: d.urlFoto,
  }));
}

export async function deputyProfile(camaraId: number): Promise<DeputyProfile> {
  const { dados } = await getJson(`${CAMARA_BASE}/deputados/${camaraId}`);
  const g = dados.ultimoStatus?.gabinete;
  return {
    civilName: dados.nomeCivil,
    electoralName: dados.ultimoStatus?.nomeEleitoral || dados.nomeCivil,
    electoralCondition: dados.ultimoStatus?.condicaoEleitoral || 'Titular',
    status: dados.ultimoStatus?.situacao || 'Exercício',
    birthDate: dados.dataNascimento,
    birthCity: dados.municipioNascimento ? `${dados.municipioNascimento}/${dados.ufNascimento}` : '',
    schooling: dados.escolaridade || 'Não informada',
    cabinet: g ? { room: g.sala, building: g.predio, floor: g.andar, phone: g.telefone, email: g.email } : null,
  };
}

export async function deputyPropositions(camaraId: number, limit = 8): Promise<Proposition[]> {
  const { dados } = await getJson(
    `${CAMARA_BASE}/proposicoes?idDeputadoAutor=${camaraId}&siglaTipo=PL,PEC&ordem=DESC&ordenarPor=id&itens=${limit}`
  );
  return (dados || []).map((p: any) => ({
    id: p.id,
    type: p.siglaTipo,
    number: p.numero,
    year: p.ano,
    summary: p.ementa,
    date: p.dataApresentacao,
    url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
  }));
}

let deputiesCache: DeputyResult[] | null = null;

/** Todos os deputados em exercício: a API entrega até 100 por página (≈ 6 páginas), então a lista é montada uma vez. */
export async function allDeputies(): Promise<DeputyResult[]> {
  if (deputiesCache) return deputiesCache;
  const list: any[] = [];
  for (let page = 1; page <= 10; page++) {
    const { dados } = await getJson(`${CAMARA_BASE}/deputados?itens=100&pagina=${page}&ordem=ASC&ordenarPor=nome`);
    list.push(...(dados || []));
    if (!dados || dados.length < 100) break;
  }
  deputiesCache = list.map((d) => ({ camaraId: d.id, name: d.nome, party: d.siglaPartido, uf: d.siglaUf, photo: d.urlFoto }));
  return deputiesCache;
}

/* ================= SENADO FEDERAL ================= */

let senatorsCache: SenatorResult[] | null = null;

export async function allSenators(): Promise<SenatorResult[]> {
  if (senatorsCache) return senatorsCache;
  const data = await getJson(`${SENADO_BASE}/senador/lista/atual.json`);
  const list: any[] = data?.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar || [];
  senatorsCache = list.map((item) => {
    const id = item.IdentificacaoParlamentar;
    const man = item.Mandato;
    const leg1 = man?.PrimeiraLegislaturaDoMandato;
    const leg2 = man?.SegundaLegislaturaDoMandato;
    return {
      senadoId: Number(id.CodigoParlamentar),
      name: id.NomeParlamentar,
      fullName: id.NomeCompletoParlamentar,
      party: id.SiglaPartidoParlamentar,
      uf: id.UfParlamentar,
      photo: id.UrlFotoParlamentar,
      email: id.EmailParlamentar,
      mandate: [leg1?.DataInicio || '2023-02-01', leg2?.DataFim || leg1?.DataFim || '2027-01-31'] as [string, string],
    };
  });
  return senatorsCache;
}

/** Filtra os 81 senadores por nome, UF (exata) ou partido. Sem texto, devolve os primeiros. */
export async function searchSenators(query: string): Promise<SenatorResult[]> {
  const list = await allSenators();
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, 8);
  return list
    .filter((s) => s.name.toLowerCase().includes(q) || s.uf.toLowerCase() === q || s.party.toLowerCase().includes(q))
    .slice(0, 8);
}

/* ================= VOTAÇÕES ================= */

/**
 * Votações nominais do Plenário (órgão 180), mais recentes primeiro. As simbólicas não têm lista de votos, e a
 * descrição das nominais traz o placar "Sim: N". Páginas em sequência: encerra com votações suficientes.
 */
export async function recentNominalVotings(limit = 20): Promise<any[]> {
  const since = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const out: any[] = [];
  for (let page = 1; page <= 6 && out.length < limit; page++) {
    const url = `${CAMARA_BASE}/votacoes?ordem=DESC&ordenarPor=dataHoraRegistro&itens=100&pagina=${page}&idOrgao=180&dataInicio=${since}`;
    const dados = await getJson(url).then((r) => r.dados || [], () => []);
    if (!dados.length) break;
    out.push(...dados.filter((v: any) => v.aprovacao !== null && /Sim:\s*\d+/.test(v.descricao || '')));
  }
  return out.slice(0, limit);
}

export interface Expense {
  type: string;
  supplier: string;
  docNumber?: string;
  date?: string;
  value: number;
  receiptUrl?: string;
}

/** Notas da cota parlamentar (CEAP) mais recentes de um deputado. */
export async function deputyExpenses(camaraId: number, limit = 30): Promise<Expense[]> {
  const { dados } = await getJson(
    `${CAMARA_BASE}/deputados/${camaraId}/despesas?idLegislatura=${currentLegislature()}&itens=${limit}&ordem=DESC&ordenarPor=dataDocumento`
  );
  return (dados || []).map((d: any) => ({
    type: d.tipoDespesa,
    supplier: d.nomeFornecedor,
    docNumber: d.numDocumento,
    date: d.dataDocumento,
    value: d.valorLiquido,
    receiptUrl: d.urlDocumento,
  }));
}

export async function votesOf(votingId: string | number): Promise<any[]> {
  const { dados } = await getJson(`${CAMARA_BASE}/votacoes/${votingId}/votos`);
  return dados || [];
}

export async function recentProvisionalMeasures(limit = 10): Promise<Proposition[]> {
  const { dados } = await getJson(`${CAMARA_BASE}/proposicoes?siglaTipo=MPV&ordem=DESC&ordenarPor=id&itens=${limit}`);
  return (dados || []).map((p: any) => ({
    id: p.id,
    type: p.siglaTipo,
    number: p.numero,
    year: p.ano,
    summary: p.ementa,
    date: p.dataApresentacao,
    url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
  }));
}

export const SENATE_WINDOW_DAYS = 180;

/** Mesmas datas na mesma janela => mesma URL => resposta reaproveitada do cache. */
export function senateWindow(now = new Date()) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { since: iso(new Date(now.getTime() - SENATE_WINDOW_DAYS * 86400000)), until: iso(now) };
}

export async function senateNominalVotings(since: string, until: string): Promise<any[]> {
  const list = await getJson(`${SENADO_BASE}/votacao?dataInicio=${since}&dataFim=${until}`);
  return Array.isArray(list) ? list : [];
}
