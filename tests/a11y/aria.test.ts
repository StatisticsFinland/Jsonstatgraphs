import {
  applyChartAriaAttributes,
  applySeriesGroupAttributes,
  applyDataPointAttributes,
} from '../../src/a11y/aria';

describe('applyChartAriaAttributes', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('sets role to region', () => {
    applyChartAriaAttributes(container, 'My Chart');
    expect(container.getAttribute('role')).toBe('region');
  });

  it('sets aria-label', () => {
    applyChartAriaAttributes(container, 'Population by Region');
    expect(container.getAttribute('aria-label')).toBe('Population by Region');
  });
});

describe('applySeriesGroupAttributes', () => {
  let group: SVGGElement;

  beforeEach(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    group = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
    svg.appendChild(group);
    document.body.appendChild(svg);
  });

  afterEach(() => {
    group.closest('svg')?.remove();
  });

  it('sets role to list', () => {
    applySeriesGroupAttributes(group, 'Sales', 0);
    expect(group.getAttribute('role')).toBe('list');
  });

  it('sets aria-label with series name', () => {
    applySeriesGroupAttributes(group, 'Revenue', 1);
    expect(group.getAttribute('aria-label')).toContain('Revenue');
  });

  it('localizes the series label', () => {
    applySeriesGroupAttributes(group, 'Myynti', 0, 'fi');
    expect(group.getAttribute('aria-label')).toBe('Sarja: Myynti');
  });
});

describe('applyDataPointAttributes', () => {
  let rect: SVGRectElement;

  beforeEach(() => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect') as SVGRectElement;
    svg.appendChild(rect);
    document.body.appendChild(svg);
  });

  afterEach(() => {
    rect.closest('svg')?.remove();
  });

  it('sets role to listitem', () => {
    applyDataPointAttributes(rect, 'Q1', '1000');
    expect(rect.getAttribute('role')).toBe('listitem');
  });

  it('sets aria-roledescription to localized data point', () => {
    applyDataPointAttributes(rect, 'Q1', '1000');
    expect(rect.getAttribute('aria-roledescription')).toBe('Data point');
    applyDataPointAttributes(rect, 'Q1', '1000', 'fi');
    expect(rect.getAttribute('aria-roledescription')).toBe('Datapiste');
  });

  it('sets aria-label with label and value', () => {
    applyDataPointAttributes(rect, 'Q1', '1000');
    expect(rect.getAttribute('aria-label')).toBe('Q1: 1000');
  });

  it('handles special characters in aria-label safely', () => {
    const specialLabel = '<Region> & "North"';
    const specialValue = 'val>0';
    applyDataPointAttributes(rect, specialLabel, specialValue);
    // setAttribute stores the raw string; the browser escapes on serialization
    expect(rect.getAttribute('aria-label')).toBe(`${specialLabel}: ${specialValue}`);
  });

  it('works with both SVG and HTML elements', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    applyDataPointAttributes(rect, 'SVG', '42');
    expect(rect.getAttribute('aria-label')).toBe('SVG: 42');

    applyDataPointAttributes(div, 'HTML', '99');
    expect(div.getAttribute('aria-label')).toBe('HTML: 99');

    div.remove();
  });
});
