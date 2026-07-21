import { transformTableData } from '../data/table-transform';
import { getLocaleStrings } from '../locale/strings';
import { JsonStatDataset } from '../types';
import { buildExportFilename, downloadBlob } from './exportUtils';

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function encodeUtf8(value: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value);
  }

  const encoded = unescape(encodeURIComponent(value));
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    bytes[i] = encoded.charCodeAt(i);
  }
  return bytes;
}

function product(values: number[]): number {
  return values.reduce((acc, value) => acc * value, 1);
}

function decodeCombo(comboIdx: number, sizes: number[]): number[] {
  const indices: number[] = new Array(sizes.length);
  let remaining = comboIdx;
  for (let i = sizes.length - 1; i >= 0; i--) {
    indices[i] = remaining % sizes[i];
    remaining = Math.floor(remaining / sizes[i]);
  }
  return indices;
}

function getMetricUnit(dataset: JsonStatDataset): string | null {
  const metricCodes = dataset.role?.metric ?? dataset.id;
  for (const dimCode of metricCodes) {
    const dim = dataset.dimension[dimCode];
    if (!dim?.category?.unit) continue;
    const unitEntries = Object.values(dim.category.unit);
    const unitLabel = unitEntries.find(entry => entry?.label)?.label;
    if (unitLabel) return unitLabel;
  }
  return null;
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function toExcelColumnName(index: number): string {
  let column = '';
  let value = index;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
}

function toCellReference(rowIndex: number, columnIndex: number): string {
  return `${toExcelColumnName(columnIndex + 1)}${rowIndex + 1}`;
}

function createWorksheetRows(dataset: JsonStatDataset, locale: string): (string | number | null)[][] {
  const strings = getLocaleStrings(locale);
  const tableData = transformTableData(dataset);
  const rows: (string | number | null)[][] = [];

  rows.push([dataset.label ?? '']);

  const rowDims = tableData.rowDimensions;
  const colDims = tableData.columnDimensions;
  const colDimSizes = colDims.map(dim => dim.categories.length);

  for (let level = 0; level < colDims.length; level++) {
    const row: (string | number | null)[] = new Array(rowDims.length).fill('');
    const innerProduct = product(colDimSizes.slice(level + 1));
    const outerProduct = product(colDimSizes.slice(0, level));

    for (let outer = 0; outer < outerProduct; outer++) {
      for (const cat of colDims[level].categories) {
        for (let repeat = 0; repeat < innerProduct; repeat++) {
          row.push(cat.label);
        }
      }
    }

    rows.push(row);
  }

  const rowDimSizes = rowDims.map(dim => dim.categories.length);
  const totalRows = product(rowDimSizes);
  const totalCols = product(colDimSizes);

  for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
    const rowIndices = decodeCombo(rowIndex, rowDimSizes);
    const row: (string | number | null)[] = [];

    for (let dimIndex = 0; dimIndex < rowDims.length; dimIndex++) {
      const category = rowDims[dimIndex].categories[rowIndices[dimIndex]];
      row.push(category?.label ?? '');
    }

    const rowValues = tableData.values[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < totalCols; colIndex++) {
      row.push(rowValues[colIndex]);
    }

    rows.push(row);
  }

  const unitLabel = getMetricUnit(dataset);
  if (unitLabel) {
    rows.push([`${strings.unit}: ${unitLabel}`]);
  }

  if (dataset.source) {
    rows.push([`${strings.source}: ${dataset.source}`]);
  }

  return rows;
}

function createWorksheetXml(rows: (string | number | null)[][]): string {
  const xmlRows: string[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const cells: string[] = [];

    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      const value = row[colIndex];
      if (value === null || value === undefined || value === '') continue;

      const cellReference = toCellReference(rowIndex, colIndex);

      if (typeof value === 'number') {
        cells.push(`<c r="${cellReference}"><v>${value}</v></c>`);
      } else {
        cells.push(`<c r="${cellReference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`);
      }
    }

    xmlRows.push(`<row r="${rowIndex + 1}">${cells.join('')}</row>`);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<sheetData>${xmlRows.join('')}</sheetData>`,
    '</worksheet>',
  ].join('');
}

function createWorkbookXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>',
    '</workbook>',
  ].join('');
}

function createWorkbookRelationshipsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
    '</Relationships>',
  ].join('');
}

function createRootRelationshipsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    '</Relationships>',
  ].join('');
}

function createContentTypesXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    '</Types>',
  ].join('');
}

function toDosDateTime(now: Date): { time: number; date: number } {
  const year = Math.min(Math.max(now.getFullYear(), 1980), 2107);
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = Math.floor(now.getSeconds() / 2);

  const time = (hours << 11) | (minutes << 5) | seconds;
  const date = ((year - 1980) << 9) | (month << 5) | day;

  return { time, date };
}

function createCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const index = (crc ^ data[i]) & 0xff;
    crc = (crc >>> 8) ^ CRC32_TABLE[index];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function createStoredZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const { time, date } = toDosDateTime(now);

  for (const entry of entries) {
    const nameBytes = encodeUtf8(entry.name);
    const data = entry.data;
    const dataLength = data.length;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, time);
    writeUint16(localHeader, 12, date);
    writeUint32(localHeader, 14, crc);
    writeUint32(localHeader, 18, dataLength);
    writeUint32(localHeader, 22, dataLength);
    writeUint16(localHeader, 26, nameBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(nameBytes, 30);

    const localOffset = offset;
    localParts.push(localHeader, data);
    offset += localHeader.length + dataLength;

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, time);
    writeUint16(centralHeader, 14, date);
    writeUint32(centralHeader, 16, crc);
    writeUint32(centralHeader, 20, dataLength);
    writeUint32(centralHeader, 24, dataLength);
    writeUint16(centralHeader, 28, nameBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, localOffset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
  }

  const centralDirectory = concatUint8Arrays(centralParts);
  const centralOffset = offset;
  const endOfCentralDirectory = new Uint8Array(22);
  writeUint32(endOfCentralDirectory, 0, 0x06054b50);
  writeUint16(endOfCentralDirectory, 4, 0);
  writeUint16(endOfCentralDirectory, 6, 0);
  writeUint16(endOfCentralDirectory, 8, entries.length);
  writeUint16(endOfCentralDirectory, 10, entries.length);
  writeUint32(endOfCentralDirectory, 12, centralDirectory.length);
  writeUint32(endOfCentralDirectory, 16, centralOffset);
  writeUint16(endOfCentralDirectory, 20, 0);

  return concatUint8Arrays([...localParts, centralDirectory, endOfCentralDirectory]);
}

export function createXlsxBytes(dataset: JsonStatDataset, locale: string): Uint8Array {
  const worksheetRows = createWorksheetRows(dataset, locale);
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: encodeUtf8(createContentTypesXml()) },
    { name: '_rels/.rels', data: encodeUtf8(createRootRelationshipsXml()) },
    { name: 'xl/workbook.xml', data: encodeUtf8(createWorkbookXml()) },
    { name: 'xl/_rels/workbook.xml.rels', data: encodeUtf8(createWorkbookRelationshipsXml()) },
    { name: 'xl/worksheets/sheet1.xml', data: encodeUtf8(createWorksheetXml(worksheetRows)) },
  ];

  return createStoredZip(entries);
}

export function exportXlsx(dataset: JsonStatDataset, locale: string): void {
  const bytes = createXlsxBytes(dataset, locale);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, buildExportFilename(dataset, 'xlsx'));
}
