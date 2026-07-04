/**
 * Decodifica texto de CSV/planos subidos por el usuario.
 * Excel en español suele exportar CSV en Latin-1/Windows-1252; forzar UTF-8 corrompe tildes (Pacífico → Pacfico).
 */
export function decodeUploadText(buffer: ArrayBuffer): string {
  const u8 = new Uint8Array(buffer);
  if (u8.length === 0) return "";

  let start = 0;
  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    start = 3;
  }

  const body = start > 0 ? u8.slice(start) : u8;
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(body);
  const utf8Replacements = countReplacementChars(utf8);

  if (utf8Replacements === 0) return utf8;

  const latin1 = new TextDecoder("latin1").decode(body);
  const latin1Replacements = countReplacementChars(latin1);

  if (latin1Replacements < utf8Replacements) return latin1;

  return utf8;
}

function countReplacementChars(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 0xfffd) n++;
  }
  return n;
}
