import { BurgerMenu } from '../../src/interaction/burger-menu';
import { FunctionalMenuItem, LinkMenuItem } from '../../src/types';
import { DEFAULT_THEME } from '../../src/theme/defaults';

const NativeBlob = globalThis.Blob;
const NativeImage = globalThis.Image;

function setupContainer(): HTMLElement {
  const container = document.createElement('div');
  container.style.position = 'relative';
  document.body.appendChild(container);
  return container;
}

function createDataset() {
  return {
    label: 'Population by Region',
    source: 'Statistics Finland',
    id: ['Region', 'Year', 'Content'],
    size: [1, 2, 1],
    dimension: {
      Region: {
        label: 'Region',
        category: {
          index: ['HEL'],
          label: { HEL: 'Helsinki' },
        },
      },
      Year: {
        label: 'Year',
        category: {
          index: ['2020', '2021'],
          label: { '2020': '2020', '2021': '2021' },
        },
      },
      Content: {
        label: 'Content',
        category: {
          index: ['POP'],
          label: { POP: 'Population' },
          unit: { POP: { label: 'persons' } },
        },
      },
    },
    value: [1.5, 2.75],
    role: { time: ['Year'], metric: ['Content'] },
  };
}

describe('BurgerMenu assertion tests', () => {
  let container: HTMLElement;
  let menu: BurgerMenu;

  beforeEach(() => {
    container = setupContainer();
  });

  afterEach(() => {
    menu?.destroy();
    container.remove();
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: NativeBlob,
    });
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      writable: true,
      value: NativeImage,
    });
    jest.restoreAllMocks();
  });

  it('renders button with menu ARIA attributes and closed state by default', () => {
    menu = new BurgerMenu({ container, locale: 'en' });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;

    expect(button).not.toBeNull();
    expect(button.getAttribute('aria-label')).toBe('Chart menu');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');
    expect(button.getAttribute('aria-controls')).toBe(list.id);
    expect(button.textContent).toBe('☰');

    expect(list.getAttribute('role')).toBe('menu');
    expect(list.getAttribute('aria-label')).toBe('Chart menu');
    expect(list.getAttribute('aria-orientation')).toBe('vertical');
    expect(list.style.display).toBe('none');
  });

  it('opens and closes menu from button click and toggles icon/expanded state', () => {
    menu = new BurgerMenu({ container, locale: 'en' });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;

    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.textContent).toBe('×');
    expect(list.style.display).toBe('block');

    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.textContent).toBe('☰');
    expect(list.style.display).toBe('none');
  });

  it('supports keyboard navigation, escape close, and roving tabindex', () => {
    menu = new BurgerMenu({ container, locale: 'en', dataset: createDataset() });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;

    button.click();

    const items = Array.from(list.querySelectorAll('.jsc-burger-menu-item')) as HTMLLIElement[];
    expect(items.length).toBeGreaterThan(2);

    expect(items[0].tabIndex).toBe(0);
    expect(items[1].tabIndex).toBe(-1);
    expect(items[0].classList.contains('jsc-burger-menu-item--active')).toBe(true);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(items[0].tabIndex).toBe(-1);
    expect(items[1].tabIndex).toBe(0);
    expect(items[0].classList.contains('jsc-burger-menu-item--active')).toBe(false);
    expect(items[1].classList.contains('jsc-burger-menu-item--active')).toBe(true);
    expect(list.getAttribute('aria-activedescendant')).toBe(items[1].id);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(items[0].tabIndex).toBe(0);

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('closes menu when clicking outside', () => {
    menu = new BurgerMenu({ container, locale: 'en' });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    button.click();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders custom items before built-ins and separators after last custom and last export', () => {
    const customAction = jest.fn();
    const customItems: (FunctionalMenuItem | LinkMenuItem)[] = [
      { text: 'Custom action', onClick: customAction },
      { text: 'Docs', url: 'https://example.com', openNewTab: true },
    ];

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    menu = new BurgerMenu({ container, locale: 'en', dataset: createDataset(), menuItemDefinitions: customItems });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const items = Array.from(list.querySelectorAll('.jsc-burger-menu-item')) as HTMLLIElement[];
    expect(items[0].textContent).toContain('Custom action');
    expect(items[1].textContent).toContain('Docs');
    expect(items[2].textContent).toContain('Download table (csv)');

    expect(items[1].style.borderBottom).toContain('solid');
    const exportPngItem = items.find(item => item.textContent?.includes('Download figure (png)'));
    expect(exportPngItem).toBeDefined();
    expect(exportPngItem!.style.borderBottom).toContain('solid');

    items[0].click();
    expect(customAction).toHaveBeenCalledTimes(1);

    button.click();
    items[1].click();
    expect(openSpy).toHaveBeenCalledWith('https://example.com/', '_blank', 'noopener,noreferrer');
  });

  it('does not open custom link item when URL is invalid and logs error', () => {
    const customItems: (FunctionalMenuItem | LinkMenuItem)[] = [
      { text: 'Bad link', url: 'javascript:alert(1)' },
    ];

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    menu = new BurgerMenu({
      container,
      locale: 'en',
      menuItemDefinitions: customItems,
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const badLinkItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Bad link')) as HTMLLIElement | undefined;

    expect(badLinkItem).toBeDefined();
    badLinkItem!.click();

    expect(openSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[JsonStatChart] Invalid URL for burger menu link item',
      'javascript:alert(1)',
    );
  });

  it('adds external link text to aria-label when custom link item is marked as external', () => {
    const customItems: (FunctionalMenuItem | LinkMenuItem)[] = [
      { text: 'Documentation', url: 'https://example.com', isExternal: true, openNewTab: true },
      { text: 'Internal page', url: 'https://example.com/internal' },
    ];

    menu = new BurgerMenu({
      container,
      locale: 'en',
      menuItemDefinitions: customItems,
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const items = Array.from(list.querySelectorAll('.jsc-burger-menu-item')) as HTMLLIElement[];
    const externalItem = items.find(item => item.textContent?.includes('Documentation'));
    const internalItem = items.find(item => item.textContent?.includes('Internal page'));

    expect(externalItem).toBeDefined();
    expect(externalItem!.getAttribute('aria-label')).toBe('Documentation (External link)');
    expect(internalItem).toBeDefined();
    expect(internalItem!.getAttribute('aria-label')).toBe('Internal page');
  });

  it('hides built-in export items when dataset is not provided', () => {
    menu = new BurgerMenu({ container, locale: 'en' });
    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;

    button.click();
    const items = Array.from(list.querySelectorAll('.jsc-burger-menu-item')) as HTMLLIElement[];
    const csvItem = items.find(item => item.textContent?.includes('Download table (csv)'));
    const xlsxItem = items.find(item => item.textContent?.includes('Download table (xlsx)'));
    const svgItem = items.find(item => item.textContent?.includes('Download figure (svg)'));
    const pngItem = items.find(item => item.textContent?.includes('Download figure (png)'));

    expect(csvItem).toBeUndefined();
    expect(xlsxItem).toBeUndefined();
    expect(svgItem).toBeUndefined();
    expect(pngItem).toBeUndefined();
  });

  it('exports XLSX when item is clicked and dataset exists', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-05T14:30:22'));

    const createObjectURLMock = jest.fn((_blob: Blob) => 'blob:xlsx');
    const revokeObjectURLMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });

    const blobCtor = jest.fn((parts: BlobPart[], options?: BlobPropertyBag) => ({ parts, type: options?.type } as unknown as Blob));
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: blobCtor,
    });

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    menu = new BurgerMenu({
      container,
      locale: 'en',
      dataset: createDataset(),
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;

    button.click();

    const xlsxItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Download table (xlsx)')) as HTMLLIElement | undefined;

    expect(xlsxItem).toBeDefined();
    xlsxItem!.click();
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }

    expect(blobCtor).toHaveBeenCalledTimes(1);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:xlsx');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Population_by_Region_20261105_143022.xlsx');

    jest.useRealTimers();
  });

  it('does not bubble arrow key events outside the menu', () => {
    const outsideKeydown = jest.fn();
    document.addEventListener('keydown', outsideKeydown);

    menu = new BurgerMenu({ container, locale: 'en', dataset: createDataset() });
    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;

    button.click();
    outsideKeydown.mockClear();

    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(outsideKeydown).not.toHaveBeenCalled();
    document.removeEventListener('keydown', outsideKeydown);
  });

  it('is prepended before existing chart content to come first in tab order', () => {
    const chartContent = document.createElement('div');
    chartContent.className = 'jsc-chart';
    chartContent.tabIndex = 0;
    container.appendChild(chartContent);

    menu = new BurgerMenu({ container, locale: 'en' });

    expect(container.firstElementChild).not.toBeNull();
    expect(container.firstElementChild!.classList.contains('jsc-burger-menu')).toBe(true);
    expect(container.children[1]).toBe(chartContent);
  });

  it('does not render table toggle item when tableToggle config is omitted', () => {
    menu = new BurgerMenu({ container, locale: 'en' });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const tableToggleItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('View table') || item.textContent?.includes('View chart'));

    expect(tableToggleItem).toBeUndefined();
  });

  it('shows accessibility toggle in chart mode and executes callback with state-dependent label', () => {
    const toggleAccessibilityMode = jest.fn();

    menu = new BurgerMenu({
      container,
      locale: 'en',
      chartType: 'line',
      tableToggle: { toggleHandler: jest.fn(), tableMode: false },
      accessibilityMode: false,
      toggleAccessibilityMode,
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const toggleItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Show symbols in the figure')) as HTMLLIElement | undefined;

    expect(toggleItem).toBeDefined();
    toggleItem!.click();
    expect(toggleAccessibilityMode).toHaveBeenCalledTimes(1);
  });

  it('shows accessibility off label when mode is enabled', () => {
    menu = new BurgerMenu({
      container,
      locale: 'en',
      chartType: 'line',
      tableToggle: { toggleHandler: jest.fn(), tableMode: false },
      accessibilityMode: true,
      toggleAccessibilityMode: jest.fn(),
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const toggleItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Remove symbols from the figure'));

    expect(toggleItem).toBeDefined();
  });

  it('hides accessibility toggle in table mode', () => {
    menu = new BurgerMenu({
      container,
      locale: 'en',
      chartType: 'line',
      tableToggle: { toggleHandler: jest.fn(), tableMode: true },
      accessibilityMode: false,
      toggleAccessibilityMode: jest.fn(),
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const toggleItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Show symbols in the figure') || item.textContent?.includes('Remove symbols from the figure'));

    expect(toggleItem).toBeUndefined();
  });

  it('hides accessibility toggle for unsupported chart types', () => {
    menu = new BurgerMenu({
      container,
      locale: 'en',
      chartType: 'scatterPlot',
      tableToggle: { toggleHandler: jest.fn(), tableMode: false },
      accessibilityMode: false,
      toggleAccessibilityMode: jest.fn(),
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const toggleItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Show symbols in the figure') || item.textContent?.includes('Remove symbols from the figure'));

    expect(toggleItem).toBeUndefined();
  });

  it('renders table toggle item in chart mode and executes handler', () => {
    const toggleHandler = jest.fn();

    menu = new BurgerMenu({
      container,
      locale: 'en',
      tableToggle: { toggleHandler, tableMode: false },
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const viewTableItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('View table')) as HTMLLIElement | undefined;

    expect(viewTableItem).toBeDefined();
    viewTableItem!.click();
    expect(toggleHandler).toHaveBeenCalledTimes(1);

  });

  it('renders table toggle item in table mode and executes handler', () => {
    const toggleHandler = jest.fn();

    menu = new BurgerMenu({
      container,
      locale: 'en',
      tableToggle: { toggleHandler, tableMode: true },
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const viewChartItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('View chart')) as HTMLLIElement | undefined;

    expect(viewChartItem).toBeDefined();
    viewChartItem!.click();
    expect(toggleHandler).toHaveBeenCalledTimes(1);
  });

  it('applies provided theme styles to menu and items', () => {
    menu = new BurgerMenu({
      container,
      locale: 'en',
      dataset: createDataset(),
      theme: {
        ...DEFAULT_THEME,
        colorText: '#121212',
        colorFocusRing: '#aa00aa',
        burgerMenuBackground: '#111111',
        burgerMenuBorderColor: '#222222',
        burgerMenuBorderRadius: '10px',
        burgerMenuShadow: '0 1px 2px rgba(0,0,0,0.2)',
        burgerMenuItemSeparatorColor: '#333333',
        burgerMenuItemHoverBackground: '#444444',
        burgerMenuItemActiveBackground: '#555555',
      },
    });

    const root = container.querySelector('.jsc-burger-menu') as HTMLDivElement;
    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();
    const items = Array.from(list.querySelectorAll('.jsc-burger-menu-item')) as HTMLLIElement[];
    const exportPngItem = items.find(item => item.textContent?.includes('Download figure (png)')) as HTMLLIElement;

    expect(button.style.color).toBe('rgb(18, 18, 18)');
    expect(list.style.background).toBe('rgb(17, 17, 17)');
    expect(list.style.border).toContain('rgb(34, 34, 34)');
    expect(list.style.borderRadius).toBe('10px');
    expect(list.style.boxShadow).toBe('0 1px 2px rgba(0,0,0,0.2)');
    expect(exportPngItem.style.borderBottom).toContain('rgb(51, 51, 51)');
    expect(root.style.getPropertyValue('--jsc-color-focus-ring')).toBe('#aa00aa');
    expect(root.style.getPropertyValue('--jsc-burger-menu-item-hover-background')).toBe('#444444');
    expect(root.style.getPropertyValue('--jsc-burger-menu-item-active-background')).toBe('#555555');
  });

  it('does not render SVG menu item for table and keyFigure chart types', () => {
    menu = new BurgerMenu({ container, locale: 'en', chartType: 'table' });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const svgItemForTable = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Download figure (svg)'));
    expect(svgItemForTable).toBeUndefined();

    menu.destroy();
    menu = new BurgerMenu({ container, locale: 'en', chartType: 'keyFigure' });
    const button2 = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list2 = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button2.click();

    const svgItemForKeyFigure = Array.from(list2.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Download figure (svg)'));
    expect(svgItemForKeyFigure).toBeUndefined();
  });

  it('exports SVG when item is clicked and chart has exportable SVG', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-05T14:30:22'));

    const createObjectURLMock = jest.fn((_blob: Blob) => 'blob:svg');
    const revokeObjectURLMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });

    const blobCtor = jest.fn((parts: BlobPart[], options?: BlobPropertyBag) => ({ parts, type: options?.type } as unknown as Blob));
    Object.defineProperty(globalThis, 'Blob', {
      configurable: true,
      writable: true,
      value: blobCtor,
    });

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    container.innerHTML = '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';
    menu = new BurgerMenu({
      container,
      locale: 'en',
      chartType: 'line',
      dataset: {
        label: 'Population by Region',
        id: ['A'],
        size: [1],
        dimension: { A: { category: { index: ['a'] } } },
        value: [1],
      },
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const svgItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Download figure (svg)')) as HTMLLIElement | undefined;

    expect(svgItem).toBeDefined();
    svgItem!.click();

    expect(blobCtor).toHaveBeenCalledTimes(1);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:svg');
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Population_by_Region_20261105_143022.svg');

    jest.useRealTimers();
  });

  it('does not render PNG menu item for table and keyFigure chart types', () => {
    menu = new BurgerMenu({ container, locale: 'en', chartType: 'table' });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const pngItemForTable = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Download figure (png)'));
    expect(pngItemForTable).toBeUndefined();

    menu.destroy();
    menu = new BurgerMenu({ container, locale: 'en', chartType: 'keyFigure' });
    const button2 = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list2 = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button2.click();

    const pngItemForKeyFigure = Array.from(list2.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Download figure (png)'));
    expect(pngItemForKeyFigure).toBeUndefined();
  });

  it('exports PNG when item is clicked and chart has exportable SVG', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-05T14:30:22'));

    const drawImage = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage } as unknown as CanvasRenderingContext2D));
    jest.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback: BlobCallback) => {
      callback(new Blob(['png-data'], { type: 'image/png' }));
    });

    const createObjectURLMock = jest.fn((_blob: Blob) => 'blob:png');
    const revokeObjectURLMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        this.onload?.();
      }
    }

    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      writable: true,
      value: MockImage,
    });

    container.innerHTML = '<svg width="120" height="90" viewBox="0 0 120 90"><rect width="120" height="90"/></svg>';
    menu = new BurgerMenu({
      container,
      locale: 'en',
      chartType: 'line',
      dataset: {
        label: 'Population by Region',
        id: ['A'],
        size: [1],
        dimension: { A: { category: { index: ['a'] } } },
        value: [1],
      },
    });

    const button = container.querySelector('.jsc-burger-menu-button') as HTMLButtonElement;
    const list = container.querySelector('.jsc-burger-menu-list') as HTMLUListElement;
    button.click();

    const pngItem = Array.from(list.querySelectorAll('.jsc-burger-menu-item'))
      .find(item => item.textContent?.includes('Download figure (png)')) as HTMLLIElement | undefined;

    expect(pngItem).toBeDefined();
    pngItem!.click();
    await Promise.resolve();

    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('Population_by_Region_20261105_143022.png');

    jest.useRealTimers();
  });
});
