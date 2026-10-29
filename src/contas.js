// Contas públicas pelo Siconfi (Tesouro Nacional): o que cada ente arrecadou e gastou (RREO) e quanto cada órgão
// gasta com pessoal (RGF). Mesmos dados que estados, municípios e União entregam por lei (LRF), sem chave de acesso.
import { FEDERATION_UNITS } from './api.js';

const SICONFI = 'https://apidatalake.tesouro.gov.br/ords/siconfi/tt';
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const SICONFI_TIMEOUT_MS = 15_000;

export function clearAccountsCache() {
  cache.clear();
  contractCache.clear();
}

async function getItems(path, params) {
  // espaço como %20: com "+" (o padrão de URLSearchParams) o Siconfi responde sem o cabeçalho CORS
  const query = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  // A CDN do Siconfi guarda a resposta com o CORS de quem pediu primeiro e a entrega a todos: sem uma chave própria,
  // outro site que consultasse a mesma URL antes bloquearia o app. O Siconfi ignora parâmetros que não conhece.
  // Só o host, sem "https://": um endereço completo na URL faz o firewall do Tesouro responder 403.
  const key = typeof location === 'undefined' ? 'node' : location.host.replace(/[^a-z0-9.-]/gi, '-');
  const url = `${SICONFI}/${path}?${query}&origem=${key}`;
  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.json;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 800 * attempt));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SICONFI_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!res.ok) throw new Error(`Siconfi respondeu ${res.status}`);
      const json = { ...await res.json(), consultedAt: new Date().toISOString() };
      cache.set(url, { json, at: Date.now() });
      return json;
    } catch (err) {
      lastError = err?.name === 'AbortError' ? new Error(`Siconfi excedeu ${SICONFI_TIMEOUT_MS / 1000}s`) : err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

// Do período mais recente para trás: o relatório de um período sai até 30 dias depois de ele fechar.
function recentPeriods(per, size, now = new Date()) {
  const y = now.getFullYear();
  const closed = Math.floor(now.getMonth() / size); // períodos já encerrados no ano
  const list = [];
  for (let p = Math.min(closed, per); p >= 1; p--) list.push([y, p]);
  list.push([y - 1, per], [y - 1, per - 1]);
  return list;
}

const esferaOf = (ente) => (ente.kind === 'uniao' ? 'U' : ente.kind === 'municipio' ? 'M' : 'E');
const value = (items, conta, coluna) => items.find((i) => i.cod_conta === conta && i.coluna.startsWith(coluna))?.valor ?? null;

// Balanço orçamentário (RREO, anexo 1): receita realizada e despesa empenhada, liquidada e paga no ano.
export async function budgetSummary(ente) {
  for (const [year, period] of recentPeriods(6, 2)) {
    const { items, consultedAt } = await getItems('rreo', {
      an_exercicio: year,
      nr_periodo: period,
      co_tipo_demonstrativo: 'RREO',
      no_anexo: 'RREO-Anexo 01',
      co_esfera: esferaOf(ente),
      id_ente: ente.ibge,
    });
    if (!items?.length) continue;
    return {
      year,
      period,
      periodLabel: `${period}º bimestre de ${year}`,
      consultedAt,
      institution: items[0].instituicao,
      revenueForecast: value(items, 'TotalReceitas', 'PREVISÃO ATUALIZADA'),
      revenue: value(items, 'TotalReceitas', 'Até o Bimestre'),
      budget: value(items, 'TotalDespesas', 'DOTAÇÃO ATUALIZADA'),
      committed: value(items, 'TotalDespesas', 'DESPESAS EMPENHADAS ATÉ'),
      liquidated: value(items, 'TotalDespesas', 'DESPESAS LIQUIDADAS ATÉ'),
      paid: value(items, 'TotalDespesas', 'DESPESAS PAGAS ATÉ'),
    };
  }
  return null;
}

// Despesa com pessoal por órgão (RGF, anexo 1), nos 12 meses até o quadrimestre. `match` escolhe o órgão
// dentro do Poder (ex.: a Assembleia, e não o Tribunal de Contas que entra no mesmo relatório do Legislativo).
export async function personnelSpending(ente, poder, match) {
  for (const [year, period] of recentPeriods(3, 4)) {
    const found = [];
    let consultedAt;
    for (let offset = 0; offset < 20000; offset += 5000) {
      const page = await getItems('rgf', {
        an_exercicio: year,
        in_periodicidade: 'Q',
        nr_periodo: period,
        co_tipo_demonstrativo: 'RGF',
        no_anexo: 'RGF-Anexo 01',
        co_esfera: esferaOf(ente),
        co_poder: poder,
        id_ente: ente.ibge,
        ...(offset ? { offset } : {}),
      });
      const items = page.items || [];
      consultedAt = page.consultedAt;
      found.push(...items.filter((i) => match.test(i.instituicao)));
      // o órgão já apareceu inteiro nesta página, ou acabou: não baixa o resto
      if (!page.hasMore || (found.length && !items.slice(-1).some((i) => match.test(i.instituicao)))) break;
    }
    if (!found.length) continue;
    const total = found.find((i) => i.cod_conta === 'DespesaComPessoalBruta' && i.coluna.startsWith('TOTAL'));
    const net = found.find((i) => i.cod_conta === 'DespesaComPessoalTotal' && i.coluna.startsWith('TOTAL'));
    const rcl = found.find((i) => i.cod_conta === 'DespesaComPessoalTotal' && i.coluna.startsWith('% sobre a RCL'));
    return {
      year,
      period,
      periodLabel: `12 meses até o ${period}º quadrimestre de ${year}`,
      consultedAt,
      institution: found[0].instituicao,
      gross: total?.valor ?? null,
      net: net?.valor ?? null,
      rclPct: rcl?.valor ?? null,
    };
  }
  return null;
}

/* ================= Órgãos acompanhados ================= */

export const UNIAO = { kind: 'uniao', ibge: 1 };

// Cada órgão sabe de onde vêm as contas dele e onde fica o portal oficial de transparência.
export function federalBodies() {
  return [
    {
      key: 'presidencia', name: 'Presidência da República (Governo Federal)', icon: 'account_balance',
      ente: UNIAO, budget: true,
      portal: 'https://portaldatransparencia.gov.br/', portalLabel: 'Portal da Transparência',
    },
    {
      key: 'camara', name: 'Câmara dos Deputados', icon: 'how_to_vote',
      ente: UNIAO, poder: 'L', match: /^Câmara dos Deputados/i,
      portal: 'https://www2.camara.leg.br/transparencia', portalLabel: 'Transparência da Câmara',
    },
    {
      key: 'senado', name: 'Senado Federal', icon: 'groups',
      ente: UNIAO, poder: 'L', match: /^Senado Federal/i,
      portal: 'https://www12.senado.leg.br/transparencia', portalLabel: 'Transparência do Senado',
    },
    {
      key: 'stf', name: 'Supremo Tribunal Federal', icon: 'gavel',
      ente: UNIAO, poder: 'J', match: /^Supremo Tribunal Federal/i, heavy: true,
      portal: 'https://portal.stf.jus.br/transparencia/', portalLabel: 'Transparência do STF',
    },
  ];
}

// `cidades` é o catálogo de src/data/cidades.json: com ele, as duas cidades-polo do estado entram depois da capital.
// `cnpjs` (src/data/cnpjs.json) liga a prefeitura ao PNCP: só os órgãos com CNPJ conhecido mostram contratos.
export function stateBodies(uf, entes, cidades = [], cnpjs = {}) {
  const u = FEDERATION_UNITS.find((x) => x.uf === uf);
  const ids = entes.ufs[uf];
  if (!u || !ids) return [];
  const estado = { kind: 'estado', ibge: ids.estado };
  const list = [
    {
      key: `gov-${uf}`, name: uf === 'DF' ? 'Governo do Distrito Federal' : `Governo do Estado — ${u.name}`, icon: 'flag',
      ente: estado, budget: true,
    },
    {
      key: `al-${uf}`, name: `${u.house} (${u.assembly})`, icon: 'apartment',
      ente: estado, poder: 'L', match: /^(Assembleia Legislativa|Câmara Legislativa)/i,
      portal: u.domain ? `https://${u.domain}` : null, portalLabel: `Site da ${u.assembly}`,
    },
  ];
  if (ids.capital) {
    const municipio = { kind: 'municipio', ibge: ids.capital };
    list.push(
      { key: `pref-${uf}`, name: `Prefeitura de ${u.capital}`, icon: 'location_city', ente: municipio, budget: true, cnpj: cnpjs[ids.capital] },
      {
        key: `cm-${uf}`, name: u.councilName || `Câmara Municipal de ${u.capital}`, icon: 'diversity_3',
        ente: municipio, poder: 'L', match: /^C[âa]mara/i,
      }
    );
  }
  for (const c of cidades.filter((x) => x.uf === uf && x.kind === 'polo')) {
    const municipio = { kind: 'municipio', ibge: c.ibge };
    const note = `${c.rankPib}ª maior economia do estado`;
    list.push(
      { key: `pref-${c.ibge}`, name: `Prefeitura de ${c.nome}`, icon: 'location_city', ente: municipio, budget: true, note, cnpj: cnpjs[c.ibge] },
      { key: `cm-${c.ibge}`, name: `Câmara Municipal de ${c.nome}`, icon: 'diversity_3', ente: municipio, poder: 'L', match: /^C[âa]mara/i, note }
    );
  }
  return list;
}

/* ================= Contratos (PNCP) ================= */

// Portal Nacional de Contratações Públicas: contratos que a prefeitura publicou, consultados na hora (sem chave, com CORS).
// A API só filtra contratos pelo CNPJ do órgão, aceita no máximo 365 dias e devolve do mais antigo para o mais novo:
// por isso lê a primeira página (para saber quantas há) e depois a última.
const PNCP = 'https://pncp.gov.br/api/consulta/v1';
const PNCP_TIMEOUT_MS = 20_000;
const contractCache = new Map();
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');

async function pncpPage(cnpj, from, to, page, size) {
  const url = `${PNCP}/contratos?dataInicial=${from}&dataFinal=${to}&cnpjOrgao=${cnpj}&pagina=${page}&tamanhoPagina=${size}`;
  let last;
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
      last = err?.name === 'AbortError' ? new Error(`PNCP excedeu o tempo limite de ${PNCP_TIMEOUT_MS / 1000}s`) : err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw last;
}

export function toContract(c) {
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

const MAX_PAGES = 10;

/**
 * Contratos publicados nos últimos `days` dias: o total, a soma dos valores informados, os maiores e os mais recentes.
 * Lê da última página para trás, até `MAX_PAGES` páginas (os 500 mais recentes, com `size` 50); `partial` avisa quando há mais.
 */
export async function recentContracts(cnpj, { days = 30, keep = 5, size = 50, now = new Date() } = {}) {
  const key = `${cnpj}:${days}`;
  const cached = contractCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;
  // O PNCP rejeita páginas menores que 10 e maiores que 50.
  const pageSize = Math.min(50, Math.max(10, Math.trunc(size) || 50));
  const from = ymd(new Date(now.getTime() - days * 864e5));
  const to = ymd(now);
  const first = await pncpPage(cnpj, from, to, 1, pageSize);
  const total = first.totalRegistros || 0;
  const pages = first.totalPaginas || 1;
  const rows = pages === 1 ? [...(first.data || [])] : [];
  if (pages > 1) {
    const wanted = [];
    for (let p = pages; p >= Math.max(1, pages - MAX_PAGES + 1); p--) wanted.push(p);
    for (let i = 0; i < wanted.length; i += 3) {
      const got = await Promise.all(wanted.slice(i, i + 3).map((p) => (p === 1 ? first : pncpPage(cnpj, from, to, p, pageSize))));
      for (const g of got) rows.push(...(g.data || []));
    }
  }
  const all = rows.map(toContract);
  const sum = all.reduce((acc, c) => acc + (c.value || 0), 0);
  const out = {
    days,
    consultedAt: new Date().toISOString(),
    total,
    partial: all.length < total,
    sum,
    biggest: [...all].filter((c) => c.value != null).sort((a, b) => b.value - a.value).slice(0, keep),
    items: [...all].sort((a, b) => b.date.localeCompare(a.date)).slice(0, keep),
  };
  contractCache.set(key, { data: out, at: Date.now() });
  return out;
}

export const PNCP_URL = 'https://pncp.gov.br/app/contratos';
export const SICONFI_URL = 'https://siconfi.tesouro.gov.br/siconfi/index.jsf';
