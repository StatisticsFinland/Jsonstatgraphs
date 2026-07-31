export interface LocaleStrings {
  source: string;
  updated: string;
  unit: string;
  titleVariable: string;
  titleVariablePlural: string;
  tableValue: string;
  tableCaption: string;
  chartMenuLabel: string;
  downloadCSV: string;
  downloadSVG: string;
  downloadPNG: string;
  toggleTableModeOnText: string;
  toggleTableModeOffText: string;
  toggleAccessibilityModeOn: string;
  toggleAccessibilityModeOff: string;
  externalLink: string;
}

const STRINGS: Record<string, LocaleStrings> = {
  en: {
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
  },
  fi: {
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
  },
  sv: {
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
  },
};

export function getLocaleStrings(locale?: string): LocaleStrings {
  const lang = locale ? locale.substring(0, 2).toLowerCase() : 'en';
  return STRINGS[lang] ?? STRINGS['en'];
}
