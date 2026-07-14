import { getLocaleStrings } from '../../src/locale/strings';

describe('getLocaleStrings', () => {
  it('returns English strings by default', () => {
    expect(getLocaleStrings()).toEqual({ source: 'Source', updated: 'Updated', unit: 'Unit', titleVariable: 'by', titleVariablePlural: 'by variables', tableValue: 'Value', tableCaption: 'Data table' });
  });

  it('returns English strings for "en" locale', () => {
    expect(getLocaleStrings('en')).toEqual({ source: 'Source', updated: 'Updated', unit: 'Unit', titleVariable: 'by', titleVariablePlural: 'by variables', tableValue: 'Value', tableCaption: 'Data table' });
  });

  it('returns Finnish strings for "fi" locale', () => {
    expect(getLocaleStrings('fi')).toEqual({ source: 'Lähde', updated: 'Päivitetty', unit: 'Yksikkö', titleVariable: 'muuttujana', titleVariablePlural: 'muuttujina', tableValue: 'Arvo', tableCaption: 'Taulukko' });
  });

  it('returns Swedish strings for "sv" locale', () => {
    expect(getLocaleStrings('sv')).toEqual({ source: 'Källa', updated: 'Uppdaterad', unit: 'Enhet', titleVariable: 'efter', titleVariablePlural: 'efter variablerna', tableValue: 'Värde', tableCaption: 'Tabell' });
  });

  it('uses first two characters of locale tag', () => {
    expect(getLocaleStrings('fi-FI')).toEqual({ source: 'Lähde', updated: 'Päivitetty', unit: 'Yksikkö', titleVariable: 'muuttujana', titleVariablePlural: 'muuttujina', tableValue: 'Arvo', tableCaption: 'Taulukko' });
  });

  it('falls back to English for unknown locale', () => {
    expect(getLocaleStrings('de')).toEqual({ source: 'Source', updated: 'Updated', unit: 'Unit', titleVariable: 'by', titleVariablePlural: 'by variables', tableValue: 'Value', tableCaption: 'Data table' });
  });

  it('is case-insensitive', () => {
    expect(getLocaleStrings('FI')).toEqual({ source: 'Lähde', updated: 'Päivitetty', unit: 'Yksikkö', titleVariable: 'muuttujana', titleVariablePlural: 'muuttujina', tableValue: 'Arvo', tableCaption: 'Taulukko' });
  });
});
