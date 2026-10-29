// Créditos das imagens do app: de onde vem cada foto e bandeira, e a licença de quem exige crédito.
import { PARTIDOS, BANDEIRAS } from './data/simbolos.js';
import { esc } from './ui.js';
import { safeUrl } from './urls.js';

const link = (url, text) => safeUrl(url) ? `<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(text)}<span class="sr-only"> (abre em nova aba)</span></a>` : esc(text);

export function creditsHtml(stf) {
  const ministros = (stf?.ministros || []).filter((m) => m.fotoCredito);
  const files = (obj) =>
    Object.values(obj)
      .map((v) => `<li>${link(v.pagina, `${v.sigla} — ${v.nome}`)}: ${esc(v.autor || 'autoria não informada')} · ${esc(v.licenca)}</li>`)
      .join('');
  return `
    <p class="xs muted">Fotos dos governadores, prefeitos, deputados estaduais e vereadores: ${link('https://dadosabertos.tse.jus.br/', 'Tribunal Superior Eleitoral')} (dados abertos das eleições de 2022 e 2024).
    Fotos dos deputados federais e senadores: Câmara dos Deputados e Senado Federal.</p>
    ${
      ministros.length
        ? `<h3 class="sm u-fw-700">Fotos dos ministros do STF (Wikimedia Commons)</h3>
           <ul class="xs muted stack u-gap-4">${ministros.map((m) => `<li>${link(m.fotoCredito.url, m.name)}: ${esc(m.fotoCredito.autor)} · ${esc(m.fotoCredito.licenca)}</li>`).join('')}</ul>`
        : ''
    }
    <h3 class="sm u-fw-700">Bandeiras dos partidos (Wikimedia Commons, domínio público)</h3>
    <ul class="xs muted stack u-gap-4">${files(PARTIDOS)}</ul>
    <h3 class="sm u-fw-700">Bandeiras dos estados (Wikimedia Commons, domínio público)</h3>
    <ul class="xs muted stack u-gap-4">${files(BANDEIRAS)}</ul>
    <p class="xs muted">Ministros do STF não têm vínculo partidário: no lugar do partido, o app mostra o estado onde nasceram (dado do Wikidata, conferido pela data de nascimento).
    Nomes, logos e bandeiras de partidos podem ser marcas registradas dos respectivos partidos; aparecem aqui apenas para identificá-los.</p>`;
}
