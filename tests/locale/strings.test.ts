import { getLocaleStrings } from '../../src/locale/strings';

const EN_STRINGS = {
  source: 'Source',
  updated: 'Updated',
  unit: 'Unit',
  titleVariable: 'by',
  titleVariablePlural: 'by variables',
  tableValue: 'Value',
  tableCaption: 'Data table',
  chartMenuLabel: 'Chart menu',
  downloadXLSX: 'Download table (xlsx)',
  downloadCSV: 'Download table (csv)',
  downloadSVG: 'Download figure (svg)',
  downloadPNG: 'Download figure (png)',
  toggleTableModeOnText: 'View table',
  toggleTableModeOffText: 'View chart',
  toggleAccessibilityModeOn: 'Show symbols in the figure',
  toggleAccessibilityModeOff: 'Remove symbols from the figure',
  externalLink: 'External link',
};

const FI_STRINGS = {
  source: 'Lähde',
  updated: 'Päivitetty',
  unit: 'Yksikkö',
  titleVariable: 'muuttujana',
  titleVariablePlural: 'muuttujina',
  tableValue: 'Arvo',
  tableCaption: 'Taulukko',
  chartMenuLabel: 'Kuvion valikko',
  downloadXLSX: 'Lataa taulukko (xlsx)',
  downloadCSV: 'Lataa taulukko (csv)',
  downloadSVG: 'Lataa kuvio (svg)',
  downloadPNG: 'Lataa kuvio (png)',
  toggleTableModeOnText: 'Näytä taulukko',
  toggleTableModeOffText: 'Näytä kuvio',
  toggleAccessibilityModeOn: 'Näytä kuviossa symbolit',
  toggleAccessibilityModeOff: 'Poista kuviosta symbolit',
  externalLink: 'Ulkoinen linkki',
};

const SV_STRINGS = {
  source: 'Källa',
  updated: 'Uppdaterad',
  unit: 'Enhet',
  titleVariable: 'efter',
  titleVariablePlural: 'efter variablerna',
  tableValue: 'Värde',
  tableCaption: 'Tabell',
  chartMenuLabel: 'Diagrammets meny',
  downloadXLSX: 'Ladda ner tabellen (xlsx)',
  downloadCSV: 'Ladda ner tabellen (csv)',
  downloadSVG: 'Ladda ner figuren (svg)',
  downloadPNG: 'Ladda ner figuren (png)',
  toggleTableModeOnText: 'Visa tabell',
  toggleTableModeOffText: 'Visa figur',
  toggleAccessibilityModeOn: 'Visa symboler i diagrammet',
  toggleAccessibilityModeOff: 'Ta bort symbolerna från diagrammet',
  externalLink: 'Extern länk',
};

describe('getLocaleStrings', () => {
  it('returns English strings by default', () => {
    expect(getLocaleStrings()).toEqual(EN_STRINGS);
  });

  it('returns English strings for "en" locale', () => {
    expect(getLocaleStrings('en')).toEqual(EN_STRINGS);
  });

  it('returns Finnish strings for "fi" locale', () => {
    expect(getLocaleStrings('fi')).toEqual(FI_STRINGS);
  });

  it('returns Swedish strings for "sv" locale', () => {
    expect(getLocaleStrings('sv')).toEqual(SV_STRINGS);
  });

  it('uses first two characters of locale tag', () => {
    expect(getLocaleStrings('fi-FI')).toEqual(FI_STRINGS);
  });

  it('falls back to English for unknown locale', () => {
    expect(getLocaleStrings('de')).toEqual(EN_STRINGS);
  });

  it('is case-insensitive', () => {
    expect(getLocaleStrings('FI')).toEqual(FI_STRINGS);
  });
});
