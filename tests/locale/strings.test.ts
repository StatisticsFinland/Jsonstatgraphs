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
  downloadCSV: 'Download table (csv)',
  downloadSVG: 'Download figure (svg)',
  downloadPNG: 'Download figure (png)',
  toggleTableModeOnText: 'View table',
  toggleTableModeOffText: 'View chart',
  toggleAccessibilityModeOn: 'Show symbols in the figure',
  toggleAccessibilityModeOff: 'Remove symbols from the figure',
  externalLink: 'External link',
  series: 'Series',
  dataPoint: 'Data point',
  noData: 'No data',
  chartLoaded: 'Chart loaded',
  chartData: 'Chart data',
  seriesControls: 'Series controls',
  toggleSeries: 'Toggle series',
  regions: 'regions',
  chartTypes: {
    line: 'Line chart',
    verticalBar: 'Vertical bar chart',
    horizontalBar: 'Horizontal bar chart',
    groupedVerticalBar: 'Grouped vertical bar chart',
    groupedHorizontalBar: 'Grouped horizontal bar chart',
    stackedVerticalBar: 'Stacked vertical bar chart',
    stackedHorizontalBar: 'Stacked horizontal bar chart',
    percentVerticalBar: 'Percent vertical bar chart',
    percentHorizontalBar: 'Percent horizontal bar chart',
    pie: 'Pie chart',
    scatterPlot: 'Scatter plot',
    pyramid: 'Pyramid chart',
    keyFigure: 'Key figure',
    table: 'Data table',
    map: 'Map',
  },
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
  downloadCSV: 'Lataa taulukko (csv)',
  downloadSVG: 'Lataa kuvio (svg)',
  downloadPNG: 'Lataa kuvio (png)',
  toggleTableModeOnText: 'Näytä taulukko',
  toggleTableModeOffText: 'Näytä kuvio',
  toggleAccessibilityModeOn: 'Näytä kuviossa symbolit',
  toggleAccessibilityModeOff: 'Poista kuviosta symbolit',
  externalLink: 'Ulkoinen linkki',
  series: 'Sarja',
  dataPoint: 'Datapiste',
  noData: 'Ei tietoa',
  chartLoaded: 'Kuvio ladattu',
  chartData: 'Kuvion tiedot',
  seriesControls: 'Sarjan valinnat',
  toggleSeries: 'Näytä tai piilota sarja',
  regions: 'aluetta',
  chartTypes: {
    line: 'Viivakaavio',
    verticalBar: 'Pystypylväskaavio',
    horizontalBar: 'Vaakapylväskaavio',
    groupedVerticalBar: 'Ryhmitelty pystypylväskaavio',
    groupedHorizontalBar: 'Ryhmitelty vaakapylväskaavio',
    stackedVerticalBar: 'Pinottu pystypylväskaavio',
    stackedHorizontalBar: 'Pinottu vaakapylväskaavio',
    percentVerticalBar: 'Prosenttiosuuksien pystypylväskaavio',
    percentHorizontalBar: 'Prosenttiosuuksien vaakapylväskaavio',
    pie: 'Ympyräkaavio',
    scatterPlot: 'Hajontakaavio',
    pyramid: 'Pyramidikaavio',
    keyFigure: 'Avainluku',
    table: 'Tietotaulukko',
    map: 'Kartta',
  },
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
  downloadCSV: 'Ladda ner tabellen (csv)',
  downloadSVG: 'Ladda ner figuren (svg)',
  downloadPNG: 'Ladda ner figuren (png)',
  toggleTableModeOnText: 'Visa tabell',
  toggleTableModeOffText: 'Visa figur',
  toggleAccessibilityModeOn: 'Visa symboler i diagrammet',
  toggleAccessibilityModeOff: 'Ta bort symbolerna från diagrammet',
  externalLink: 'Extern länk',
  series: 'Serie',
  dataPoint: 'Datapunkt',
  noData: 'Ingen uppgift',
  chartLoaded: 'Diagrammet har laddats',
  chartData: 'Diagramdata',
  seriesControls: 'Serieinställningar',
  toggleSeries: 'Visa eller dölj serie',
  regions: 'regioner',
  chartTypes: {
    line: 'Linjediagram',
    verticalBar: 'Stolpdiagram',
    horizontalBar: 'Horisontellt stapeldiagram',
    groupedVerticalBar: 'Grupperat stolpdiagram',
    groupedHorizontalBar: 'Grupperat horisontellt stapeldiagram',
    stackedVerticalBar: 'Staplat stolpdiagram',
    stackedHorizontalBar: 'Staplat horisontellt stapeldiagram',
    percentVerticalBar: 'Procentuellt stolpdiagram',
    percentHorizontalBar: 'Procentuellt horisontellt stapeldiagram',
    pie: 'Cirkeldiagram',
    scatterPlot: 'Punktdiagram',
    pyramid: 'Pyramiddiagram',
    keyFigure: 'Nyckeltal',
    table: 'Datatabell',
    map: 'Karta',
  },
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
