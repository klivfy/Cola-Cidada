// Baixa as fontes do Google Fonts para fonts/ (o app as serve do próprio domínio: nenhum pedido a terceiros em uso).
// Ícones: só os de fonts/icon-names.txt (um por linha, em ordem alfabética). Ao usar um ícone novo, inclua-o lá e rode:
//   node scripts/build-fonts.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');
mkdirSync(root, { recursive: true });
// o Google só devolve woff2 a navegadores modernos
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const get = async (url, binary = false) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} em ${url}`);
  return binary ? Buffer.from(await res.arrayBuffer()) : res.text();
};

const icons = readFileSync(join(root, 'icon-names.txt'), 'utf8').split('\n').filter(Boolean);
if ([...icons].sort().join() !== icons.join()) throw new Error('icon-names.txt precisa estar em ordem alfabética');

const css = await get(
  `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400..500,0..1,0&icon_names=${icons.join(',')}&display=block`
);
const iconUrl = css.match(/url\((https:[^)]+)\)/)?.[1];
if (!iconUrl) throw new Error('fonte de ícones não veio na resposta');
writeFileSync(join(root, 'material-symbols.woff2'), await get(iconUrl, true));

// Inter variável (texto): subconjuntos latinos que cobrem o português.
const inter = await get('https://fonts.googleapis.com/css2?family=Inter:wght@400..700&display=swap');
for (const block of inter.split('/* ').slice(1)) {
  const name = block.slice(0, block.indexOf(' */'));
  if (name !== 'latin' && name !== 'latin-ext') continue;
  writeFileSync(join(root, `inter-${name}.woff2`), await get(block.match(/url\((https:[^)]+)\)/)[1], true));
  console.log(`inter-${name}: ${block.match(/unicode-range: ([^;]+);/)[1]}`);
}
console.log(`${icons.length} ícones`);
