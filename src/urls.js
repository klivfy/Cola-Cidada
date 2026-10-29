// Links externos precisam ser HTTPS; arquivos do app usam caminhos absolutos locais.
export function safeUrl(value, { local = true } = {}) {
  if (typeof value !== 'string' || !value || /[\s\\\u0000-\u001f\u007f]/.test(value)) return '';
  if (local && value.startsWith('/') && !value.startsWith('//')) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}
