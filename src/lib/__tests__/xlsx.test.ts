import { crc32 as zlibCrc32 } from 'node:zlib';

import { buildXlsx } from '../xlsx';

/** Reads the entries (name → bytes, stored CRC) back out of the ZIP the builder wrote. */
function readZip(bytes: Uint8Array): { name: string; data: Uint8Array; crc: number }[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: { name: string; data: Uint8Array; crc: number }[] = [];
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const crc = view.getUint32(at + 14, true);
    const size = view.getUint32(at + 22, true);
    const nameLength = view.getUint16(at + 26, true);
    const extraLength = view.getUint16(at + 28, true);
    const nameStart = at + 30;
    const dataStart = nameStart + nameLength + extraLength;
    entries.push({ name: new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength)), data: bytes.subarray(dataStart, dataStart + size), crc });
    at = dataStart + size;
  }
  return entries;
}

describe('buildXlsx', () => {
  const bytes = buildXlsx('Persone', ['Nome', 'Voto'], [
    ['Marina Karina', 5],
    ['=1+1 & <b>', null],
  ]);
  const entries = readZip(bytes);
  const text = (name: string): string => new TextDecoder().decode(entries.find((e) => e.name === name)?.data);

  it('writes the parts an Excel file needs', () => {
    expect(entries.map((e) => e.name)).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']);
  });

  it('stores a correct checksum for every file', () => {
    for (const e of entries) expect(e.crc).toBe(zlibCrc32(e.data));
  });

  it('puts the header, the rows and the filters in the sheet', () => {
    const sheet = text('xl/worksheets/sheet1.xml');
    expect(sheet).toContain('Nome');
    expect(sheet).toContain('Marina Karina');
    expect(sheet).toContain('<v>5</v>');
    expect(sheet).toContain('<autoFilter ref="A1:B3"/>');
    expect(sheet).toContain('state="frozen"');
  });

  it('keeps text that looks like a formula as plain text, escaped', () => {
    const sheet = text('xl/worksheets/sheet1.xml');
    expect(sheet).toContain('t="inlineStr"');
    expect(sheet).toContain('=1+1 &amp; &lt;b&gt;');
    expect(sheet).not.toContain('<f>');
  });

  it('cleans the sheet name', () => {
    const named = readZip(buildXlsx('Ore: coach/1?', ['A'], []));
    expect(new TextDecoder().decode(named.find((e) => e.name === 'xl/workbook.xml')?.data)).toContain('name="Ore  coach 1"');
  });
});
