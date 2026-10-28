// Contas públicas pelo Siconfi (Tesouro Nacional): o que cada ente arrecadou e gastou (RREO) e quanto cada órgão gasta
// com pessoal (RGF). Mesmos dados que União, estados e municípios entregam por lei (LRF), sem chave. Lógica do PWA.
import cnpjs from '@/data/cnpjs.json';
import entes from '@/data/entes.json';

import { CITIES, UNITS } from './directory';

const SICONFI = 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt';
const cache = new Map<string, any>();

type Params = Record<string, string | number>;

async function getItems(path: string, params: Params): Promise<{ items?: any[]; hasMore?: boolean }> {
  // espaço como %20, e o nome do app em vez de um endereço: o firewall do Tesouro responde 403 a "https://" na URL
  const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  const url = `${SICONFI}/${path}?${query}&origem=app-nativo`;
  if (cache.has(url)) return cache.get(url);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 800 * attempt));
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`Siconfi respondeu ${res.status}`);
      const json = await res.json();
      cache.set(url, json);
      return json;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Do período mais recente para trás: o relatório de um período sai até 30 dias depois de ele fechar. */
export function recentPeriods(per: number, size: number, now = new Date()): [number, number][] {
  const y = now.getFullYear();
  const closed = Math.floor(now.getMonth() / size);
  const list: [number, number][] = [];
  for (let p = Math.min(closed, per); p >= 1; p--) list.push([y, p]);
  list.push([y - 1, per], [y - 1, per - 1]);
  return list;
}

export interface Ente {
  kind: 'uniao' | 'estado' | 'municipio';
  ibge: number;
}
const esfera = (e: Ente) => (e.kind === 'uniao' ? 'U' : e.kind === 'municipio' ? 'M' : 'E');
const pick = (items: any[], conta: string, coluna: string) => items.find((i) => i.cod_conta === conta && String(i.coluna).startsWith(coluna))?.valor ?? null;

export interface BudgetSummary {
  periodLabel: string;
  institution: string;
  revenueForecast: number | null;
  revenue: number | null;
  budget: number | null;
  committed: number | null;
  liquidated: number | null;
  paid: number | null;
}

/** Balanço orçamentário (RREO, anexo 1): receita realizada e despesa empenhada, liquidada e paga no ano. */
export async function budgetSummary(ente: Ente): Promise<BudgetSummary | null> {
  for (const [year, period] of recentPeriods(6, 2)) {
    const { items } = await getItems('rreo', {
      an_exercicio: year, nr_periodo: period, co_tipo_demonstrativo: 'RREO', no_anexo: 'RREO-Anexo 01', co_esfera: esfera(ente), id_ente: ente.ibge,
    });
    if (!items?.length) continue;
    return {
      periodLabel: `${period}º bimestre de ${year}`,
      institution: items[0].instituicao,
      revenueForecast: pick(items, 'TotalReceitas', 'PREVISÃO ATUALIZADA'),
      revenue: pick(items, 'TotalReceitas', 'Até o Bimestre'),
      budget: pick(items, 'TotalDespesas', 'DOTAÇÃO ATUALIZADA'),
      committed: pick(items, 'TotalDespesas', 'DESPESAS EMPENHADAS ATÉ'),
      liquidated: pick(items, 'TotalDespesas', 'DESPESAS LIQUIDADAS ATÉ'),
      paid: pick(items, 'TotalDespesas', 'DESPESAS PAGAS ATÉ'),
    };
  }
  return null;
}

export interface PersonnelSpending {
  periodLabel: string;
  institution: string;
  gross: number | null;
  rclPct: number | null;
}

/** Despesa com pessoal por órgão (RGF, anexo 1), nos 12 meses até o quadrimestre; `match` escolhe o órgão dentro do Poder. */
export async function personnelSpending(ente: Ente, poder: string, match: RegExp): Promise<PersonnelSpending | null> {
  for (const [year, period] of recentPeriods(3, 4)) {
    const found: any[] = [];
    for (let offset = 0; offset < 20000; offset += 5000) {
      const page = await getItems('rgf', {
        an_exercicio: year, in_periodicidade: 'Q', nr_periodo: period, co_tipo_demonstrativo: 'RGF', no_anexo: 'RGF-Anexo 01',
        co_esfera: esfera(ente), co_poder: poder, id_ente: ente.ibge, ...(offset ? { offset } : {}),
      });
      const items = page.items ?? [];
      found.push(...items.filter((i) => match.test(i.instituicao)));
      // o órgão já apareceu inteiro nesta página, ou acabou: não baixa o resto
      if (!page.hasMore || (found.length && !match.test(items[items.length - 1]?.instituicao ?? ''))) break;
    }
    if (!found.length) continue;
    const total = found.find((i) => i.cod_conta === 'DespesaComPessoalBruta' && String(i.coluna).startsWith('TOTAL'));
    const rcl = found.find((i) => i.cod_conta === 'DespesaComPessoalTotal' && String(i.coluna).startsWith('% sobre a RCL'));
    return { periodLabel: `12 meses até o ${period}º quadrimestre de ${year}`, institution: found[0].instituicao, gross: total?.valor ?? null, rclPct: rcl?.valor ?? null };
  }
  return null;
}

/* ================= Órgãos acompanhados ================= */

export interface Body {
  key: string;
  name: string;
  ente: Ente;
  /** true: balanço orçamentário do ente; senão, gasto com pessoal do órgão (poder + filtro) */
  budget?: boolean;
  poder?: string;
  match?: RegExp;
  heavy?: boolean;
  portal?: string;
  portalLabel?: string;
  /** linha de apoio, ex.: a posição da cidade-polo no estado */
  note?: string;
  /** CNPJ da prefeitura (Siconfi): liga o órgão aos contratos do PNCP */
  cnpj?: string;
}

const cnpjOf = (ibge: number) => (cnpjs as Record<string, string>)[String(ibge)];

export const UNIAO: Ente = { kind: 'uniao', ibge: 1 };

export const federalBodies = (): Body[] => [
  { key: 'presidencia', name: 'Presidência da República (Governo Federal)', ente: UNIAO, budget: true, portal: 'https://portaldatransparencia.gov.br/', portalLabel: 'Portal da Transparência' },
  { key: 'camara', name: 'Câmara dos Deputados', ente: UNIAO, poder: 'L', match: /^Câmara dos Deputados/i, portal: 'https://www2.camara.leg.br/transparencia', portalLabel: 'Transparência da Câmara' },
  { key: 'senado', name: 'Senado Federal', ente: UNIAO, poder: 'L', match: /^Senado Federal/i, portal: 'https://www12.senado.leg.br/transparencia', portalLabel: 'Transparência do Senado' },
  { key: 'stf', name: 'Supremo Tribunal Federal', ente: UNIAO, poder: 'J', match: /^Supremo Tribunal Federal/i, heavy: true, portal: 'https://portal.stf.jus.br/transparencia/', portalLabel: 'Transparência do STF' },
];

export function stateBodies(uf: string): Body[] {
  const u = UNITS.find((x) => x.uf === uf) as any;
  const ids = (entes as any).ufs[uf];
  if (!u || !ids) return [];
  const estado: Ente = { kind: 'estado', ibge: ids.estado };
  const list: Body[] = [
    { key: `gov-${uf}`, name: uf === 'DF' ? 'Governo do Distrito Federal' : `Governo do Estado — ${u.name}`, ente: estado, budget: true },
    { key: `al-${uf}`, name: `${u.house} (${u.assembly})`, ente: estado, poder: 'L', match: /^(Assembleia Legislativa|Câmara Legislativa)/i, portal: u.domain ? `https://${u.domain}` : undefined, portalLabel: `Site da ${u.assembly}` },
  ];
  if (ids.capital) {
    const municipio: Ente = { kind: 'municipio', ibge: ids.capital };
    list.push(
      { key: `pref-${uf}`, name: `Prefeitura de ${u.capital}`, ente: municipio, budget: true, cnpj: cnpjOf(ids.capital) },
      { key: `cm-${uf}`, name: u.councilName || `Câmara Municipal de ${u.capital}`, ente: municipio, poder: 'L', match: /^C[âa]mara/i }
    );
  }
  for (const c of CITIES.filter((x) => x.uf === uf && x.kind === 'polo')) {
    const municipio: Ente = { kind: 'municipio', ibge: c.ibge };
    const note = `${c.rankPib}ª maior economia do estado`;
    list.push(
      { key: `pref-${c.ibge}`, name: `Prefeitura de ${c.nome}`, ente: municipio, budget: true, note, cnpj: cnpjOf(c.ibge) },
      { key: `cm-${c.ibge}`, name: `Câmara Municipal de ${c.nome}`, ente: municipio, poder: 'L', match: /^C[âa]mara/i, note }
    );
  }
  return list;
}

/* ================= Contratos (PNCP) ================= */

// Portal Nacional de Contratações Públicas: contratos que a prefeitura publicou, consultados na hora (sem chave).
// A API só filtra contratos pelo CNPJ do órgão, aceita no máximo 365 dias e devolve do mais antigo para o mais novo:
// por isso lê a primeira página (para saber quantas há) e depois da última para trás. Lógica do PWA.
const PNCP = 'https://pncp.gov.br/api/consulta/v1';
const PNCP_TIMEOUT_MS = 20_000;
const MAX_PAGES = 10;
const contractCache = new Map<string, Contracts>();
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

export interface Contract {
  id: string;
  date: string;
  object: string;
  supplier: string;
  value: number | null;
  kind: string;
  emenda: boolean;
  url: string;
}
export interface Contracts {
  days: number;
  total: number;
  partial: boolean;
  sum: number;
  biggest: Contract[];
  items: Contract[];
}

async function pncpPage(cnpj: string, from: string, to: string, page: number, size: number): Promise<any> {
  const url = `${PNCP}/contratos?dataInicial=${from}&dataFinal=${to}&cnpjOrgao=${cnpj}&pagina=${page}&tamanhoPagina=${size}`;
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 800));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PNCP_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (res.status === 204) return { data: [], totalRegistros: 0, totalPaginas: 0 };
      if (!res.ok) throw new Error(`PNCP respondeu ${res.status}`);
      return await res.json();
    } catch (err) {
      last = (err as { name?: string }).name === 'AbortError' ? new Error(`PNCP excedeu o tempo limite de ${PNCP_TIMEOUT_MS / 1000}s`) : err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

export function toContract(c: any): Contract {
  return {
    id: c.numeroControlePNCP,
    date: (c.dataPublicacaoPncp || '').slice(0, 10),
    object: (c.objetoContrato || '').trim(),
    supplier: c.nomeRazaoSocialFornecedor || '',
    value: typeof c.valorGlobal === 'number' ? c.valorGlobal : null,
    kind: c.tipoContrato?.nome || '',
    emenda: Boolean(c.emendaParlamentar),
    url: `https://pncp.gov.br/app/contratos/${c.orgaoEntidade?.cnpj}/${c.anoContrato}/${c.sequencialContrato}`,
  };
}

/** Contratos publicados nos últimos `days` dias: o total, a soma dos valores informados, os maiores e os mais recentes. */
export async function recentContracts(cnpj: string, opts: { days?: number; keep?: number; size?: number; now?: Date } = {}): Promise<Contracts> {
  const { days = 30, keep = 5, size = 50, now = new Date() } = opts;
  const key = `${cnpj}:${days}`;
  const hit = contractCache.get(key);
  if (hit) return hit;
  const pageSize = Math.min(50, Math.max(10, Math.trunc(size) || 50));
  const from = ymd(new Date(now.getTime() - days * 864e5));
  const to = ymd(now);
  const first = await pncpPage(cnpj, from, to, 1, pageSize);
  const total: number = first.totalRegistros || 0;
  const pages: number = first.totalPaginas || 1;
  const rows: any[] = pages === 1 ? [...(first.data || [])] : [];
  if (pages > 1) {
    const wanted: number[] = [];
    for (let p = pages; p >= Math.max(1, pages - MAX_PAGES + 1); p--) wanted.push(p);
    for (let i = 0; i < wanted.length; i += 3) {
      const got = await Promise.all(wanted.slice(i, i + 3).map((p) => (p === 1 ? first : pncpPage(cnpj, from, to, p, pageSize))));
      for (const g of got) rows.push(...(g.data || []));
    }
  }
  const all = rows.map(toContract);
  const out: Contracts = {
    days,
    total,
    partial: all.length < total,
    sum: all.reduce((acc, c) => acc + (c.value || 0), 0),
    biggest: all.filter((c) => c.value != null).sort((a, b) => (b.value as number) - (a.value as number)).slice(0, keep),
    items: [...all].sort((a, b) => b.date.localeCompare(a.date)).slice(0, keep),
  };
  contractCache.set(key, out);
  return out;
}

export const SICONFI_URL = 'https://siconfi.tesouro.gov.br/siconfi/index.jsf';

/** Valor em reais, compacto: "R$ 1,4 bi". */
export function money(v: number | null): string {
  if (v == null) return 'não informado';
  const units: [number, string][] = [[1e12, 'tri'], [1e9, 'bi'], [1e6, 'mi'], [1e3, 'mil']];
  for (const [n, label] of units) if (Math.abs(v) >= n) return `R$ ${(v / n).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${label}`;
  return `R$ ${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
}
