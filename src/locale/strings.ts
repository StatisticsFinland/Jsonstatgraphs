export interface LocaleStrings {
  source: string;
  updated: string;
  unit: string;
  titleVariable: string;
  titleVariablePlural: string;
  tableValue: string;
  tableCaption: string;
}

const STRINGS: Record<string, LocaleStrings> = {
  en: { source: 'Source', updated: 'Updated', unit: 'Unit', titleVariable: 'by', titleVariablePlural: 'by variables', tableValue: 'Value', tableCaption: 'Data table' },
  fi: { source: 'Lähde', updated: 'Päivitetty', unit: 'Yksikkö', titleVariable: 'muuttujana', titleVariablePlural: 'muuttujina', tableValue: 'Arvo', tableCaption: 'Taulukko' },
  sv: { source: 'Källa', updated: 'Uppdaterad', unit: 'Enhet', titleVariable: 'efter', titleVariablePlural: 'efter variablerna', tableValue: 'Värde', tableCaption: 'Tabell' },
};

export function getLocaleStrings(locale?: string): LocaleStrings {
  const lang = locale ? locale.substring(0, 2).toLowerCase() : 'en';
  return STRINGS[lang] ?? STRINGS['en'];
}
