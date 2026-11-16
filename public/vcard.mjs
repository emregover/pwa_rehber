function* unfoldLines(text) {
  let previous = '';
  let quotedPrintable = false;
  for (const line of text.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)) {
    if (quotedPrintable && previous.endsWith('=')) {
      previous = previous.slice(0, -1) + line.replace(/^[ \t]/, '');
    } else if (line.startsWith(' ') || line.startsWith('\t')) {
      previous += line.slice(1);
    } else {
      if (previous) yield previous;
      previous = line;
      quotedPrintable = /;ENCODING="?QUOTED-PRINTABLE"?(?:;|:)/i.test(line);
    }
  }
  if (previous) yield previous;
}

function decodeQuotedPrintable(value, charset) {
  let decoder;
  try {
    decoder = new TextDecoder(charset || 'utf-8');
  } catch {
    decoder = new TextDecoder();
  }
  return value.replace(/(?:=[\da-f]{2})+/gi, sequence => {
    const bytes = sequence.split('=').slice(1).map(byte => parseInt(byte, 16));
    return decoder.decode(Uint8Array.from(bytes));
  });
}

function unescapeText(value) {
  return value.replace(/\\([nN,;\\])/g, (_, character) =>
    /n/i.test(character) ? '\n' : character);
}

export function parseVCard(text) {
  const contacts = [];
  let card;
  for (const line of unfoldLines(text)) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const header = line.slice(0, separator);
    const [property, ...params] = header.split(';');
    const key = property.split('.').pop().toUpperCase();
    let value = line.slice(separator + 1).trim();
    if (key === 'BEGIN' && value.toUpperCase() === 'VCARD') {
      card = { name: '', fallbackName: '', numbers: new Set(), kind: '' };
      continue;
    }
    if (!card) continue;
    if (key === 'END' && value.toUpperCase() === 'VCARD') {
      if (card.kind !== 'group') {
        contacts.push({ name: card.name || card.fallbackName, numbers: [...card.numbers] });
      }
      card = undefined;
      continue;
    }
    if (!['FN', 'N', 'TEL', 'KIND', 'X-ADDRESSBOOKSERVER-KIND'].includes(key)) continue;
    if (params.some(parameter => /^ENCODING="?QUOTED-PRINTABLE"?$/i.test(parameter))) {
      const charset = params.find(parameter => /^CHARSET=/i.test(parameter));
      value = decodeQuotedPrintable(value, charset?.slice(8).replace(/"/g, ''));
    }
    if (key === 'FN') card.name ||= unescapeText(value);
    if (key === 'N') {
      const [family, given, additional, prefix, suffix] = value.split(/(?<!\\);/);
      card.fallbackName = [prefix, given, additional, family, suffix]
        .filter(Boolean).map(unescapeText).join(' ');
    }
    if (key === 'TEL' && value) card.numbers.add(unescapeText(value.replace(/^tel:/i, '')));
    if (key === 'KIND' || key === 'X-ADDRESSBOOKSERVER-KIND') card.kind = value.toLowerCase();
  }
  return contacts;
}
