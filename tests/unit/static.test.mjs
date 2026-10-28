// Verificações estáticas: sintaxe, ícones da fonte subconjunto e textos fictícios removidos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const sources = [
  ...readdirSync(new URL('src/', root)).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`),
  ...readdirSync(new URL('src/views/', root)).filter((f) => f.endsWith('.js')).map((f) => `src/views/${f}`),
  'sw.js',
  'server.js',
];

test('todos os scripts têm sintaxe válida', () => {
  for (const f of sources) execFileSync(process.execPath, ['--check', new URL(f, root).pathname]);
});

test('ícones escritos literalmente estão no subconjunto da fonte', () => {
  const list = read('fonts/icon-names.txt').split('\n').filter(Boolean);
  assert.deepEqual([...list].sort(), list, 'icon-names.txt precisa estar em ordem alfabética');
  const known = new Set(list);
  const missing = new Set();
  for (const f of sources) {
    for (const m of read(f).matchAll(/class="mi[^"]*"[^>]*>\s*([a-z0-9_]+)\s*</g)) if (!known.has(m[1])) missing.add(`${m[1]} (${f})`);
  }
  assert.deepEqual([...missing], []);
});

test('service worker guarda todos os módulos do app', () => {
  const sw = read('sw.js');
  for (const f of sources.filter((f) => f.startsWith('src/'))) assert.ok(sw.includes(`'/${f}'`), `${f} fora do APP_SHELL`);
});

test('textos fictícios não voltaram', () => {
  const banned = /Eleitor\(a\) Biométrico|Identificador Cívico|Framework Cívico|Atualizado a cada|ao vivo|Sincronia Oficial|Painel Ativo|Quórum Nominal|Eleitor Regular|Cidadão Conectado|Protocolo Cívico|Chave Criptográfica|Encerramento Automático|Total Auditado|Selo Digital|Aderência LAI|Impacto Financeiro|Quem Ganha e Quem Paga/i;
  for (const f of sources) {
    const hit = read(f).match(banned);
    assert.equal(hit, null, `${f}: "${hit?.[0]}"`);
  }
});

test('sem style= no HTML gerado: a CSP não aceita estilo inline', () => {
  for (const f of sources.filter((f) => f.startsWith('src/'))) assert.doesNotMatch(read(f), /\sstyle=["']/, `${f} voltou a usar style=`);
  assert.doesNotMatch(read('index.html'), /\sstyle=["']|<style/);
  const csp = JSON.parse(read('vercel.json')).headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
  assert.doesNotMatch(csp.match(/style-src[^;]*/)[0], /unsafe-inline/);
});

test('toda classe utilitária u-* usada nas views existe em utilities.css', () => {
  const css = read('src/utilities.css');
  const defined = new Set([...css.matchAll(/\.(u-[\w-]+)\{/g)].map((m) => m[1]));
  const missing = new Set();
  for (const f of sources.filter((f) => f.startsWith('src/'))) {
    for (const m of read(f).matchAll(/\b(u-[a-z0-9_-]+)/g)) if (!defined.has(m[1])) missing.add(`${m[1]} (${f})`);
  }
  assert.deepEqual([...missing], []);
});

test('ícones da fonte ficam fora do leitor de tela (o nome da ligadura seria lido)', () => {
  for (const f of sources.filter((f) => f.startsWith('src/'))) {
    const bare = [...read(f).matchAll(/<span class="mi[ "][^>]*>/g)].map((m) => m[0]).filter((t) => !t.includes('aria-hidden="true"'));
    assert.deepEqual(bare, [], `${f}: ícone sem aria-hidden`);
  }
});

test('fontes são servidas do próprio app: nenhum pedido ao Google (LGPD) e nenhum arquivo faltando', () => {
  for (const f of ['index.html', 'src/styles.css', 'vercel.json', 'sw.js']) assert.doesNotMatch(read(f), /fonts\.(googleapis|gstatic)\.com/, `${f} chama o Google Fonts`);
  const css = read('src/styles.css');
  const files = [...css.matchAll(/url\('\.\.\/(fonts\/[^']+)'\)/g)].map((m) => m[1]);
  assert.ok(files.length >= 2);
  const sw = read('sw.js');
  for (const f of files) {
    assert.ok(readFileSync(new URL(f, root)).length > 5000, `${f} vazio`);
    assert.ok(sw.includes(`'/${f}'`), `${f} fora do APP_SHELL`);
  }
});

test('deploy Cloudflare não publica dependências nem código de desenvolvimento', () => {
  const ignore = read('.assetsignore');
  for (const entry of ['node_modules/', 'expo-app/', 'tests/', 'scripts/']) assert.match(ignore, new RegExp(`^${entry.replace('/', '\/')}$`, 'm'));
  for (const entry of ['src/', 'fonts/', 'fotos/', 'partidos/', 'bandeiras/']) assert.doesNotMatch(ignore, new RegExp(`^${entry.replace('/', '\/')}$`, 'm'));
  const config = JSON.parse(read('wrangler.jsonc'));
  assert.equal(config.assets.directory, '.');
});
