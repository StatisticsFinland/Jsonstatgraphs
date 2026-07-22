import { BurgerMenuItemDefinition, ChartType, JsonStatDataset, ResolvedTheme } from '../types';
import { getLocaleStrings } from '../locale/strings';
import { exportCsv } from './csvUtils';
import { exportPng } from './pngUtils';
import { exportSvg, supportsSvgExport } from './svgUtils';
import { exportXlsx } from './xlsxUtils';

interface BurgerMenuItem {
  text: string;
  prefixIcon?: string;
  suffixIcon?: string;
  bottomSeparator?: boolean;
  activate: () => void;
}

export interface BurgerMenuTableToggleConfig {
  toggleHandler: () => void;
  tableMode: boolean;
}

export interface BurgerMenuConfig {
  container: HTMLElement;
  locale?: string;
  dataset?: JsonStatDataset;
  chartType?: ChartType;
  accessibilityMode?: boolean;
  toggleAccessibilityMode?: () => void;
  menuItemDefinitions?: BurgerMenuItemDefinition[];
  menuIconInheritColor?: boolean;
  tableToggle?: BurgerMenuTableToggleConfig;
  theme?: ResolvedTheme;
}

let burgerMenuCounter = 0;
let burgerMenuStyleRefCount = 0;

function isLinkMenuItem(item: BurgerMenuItemDefinition): item is Extract<BurgerMenuItemDefinition, { url: string }> {
  return 'url' in item;
}

function createBuiltInItems(
  container: HTMLElement,
  strings: ReturnType<typeof getLocaleStrings>,
  locale: string,
  chartType?: ChartType,
  dataset?: JsonStatDataset,
  tableToggle?: BurgerMenuTableToggleConfig,
  accessibilityMode?: boolean,
  toggleAccessibilityMode?: () => void,
): BurgerMenuItem[] {
  const canExportImage = supportsSvgExport(chartType);
  const isInChartMode = tableToggle ? !tableToggle.tableMode : chartType !== 'table';
  const supportsAccessibilityMode = chartType !== 'scatterPlot' && chartType !== 'table' && chartType !== 'keyFigure' && chartType !== 'map';
  const showAccessibilityToggle = isInChartMode && supportsAccessibilityMode && typeof toggleAccessibilityMode === 'function';

  const exportItems: BurgerMenuItem[] = [];

  if (dataset) {
    exportItems.push(
      {
        text: strings.downloadCSV,
        activate: () => {
          exportCsv(dataset, locale);
        },
      },
      {
        text: strings.downloadXLSX,
        activate: () => {
          exportXlsx(dataset, locale).catch((error) => {
            console.error('[JsonStatChart] XLSX export failed', error);
          });
        },
      },
    );
  }

  if (dataset && canExportImage) {
    exportItems.splice(1, 0, {
      text: strings.downloadSVG,
      activate: () => {
        if (exportSvg(container, dataset, chartType)) {
          return;
        }
        console.error('[JsonStatChart] SVG export failed');
      },
    });

    exportItems.push({
      text: strings.downloadPNG,
      activate: () => {
        exportPng(container, dataset, chartType)
          .then((success) => {
            if (!success) {
              console.error('[JsonStatChart] PNG export failed');
            }
          })
          .catch((error) => {
            console.error('[JsonStatChart] PNG export failed', error);
          });
      },
    });
  }

  if (exportItems.length > 0) {
    exportItems[exportItems.length - 1].bottomSeparator = true;
  }

  const items: BurgerMenuItem[] = [...exportItems];

  if (showAccessibilityToggle) {
    items.push({
      text: accessibilityMode ? strings.toggleAccessibilityModeOff : strings.toggleAccessibilityModeOn,
      activate: () => toggleAccessibilityMode(),
    });
  }

  if (tableToggle) {
    items.push({
      text: tableToggle.tableMode ? strings.toggleTableModeOffText : strings.toggleTableModeOnText,
      activate: tableToggle.toggleHandler,
    });
  }

  return items;
}

export class BurgerMenu {
  private readonly container: HTMLElement;
  private readonly theme?: ResolvedTheme;
  private readonly root: HTMLDivElement;
  private readonly button: HTMLButtonElement;
  private readonly menu: HTMLUListElement;
  private readonly menuId: string;
  private readonly previousContainerPosition: string;
  private readonly didSetContainerPosition: boolean;
  private items: HTMLLIElement[] = [];
  private open = false;
  private activeIndex = 0;
  private readonly onDocumentPointerDown: (event: MouseEvent) => void;

  constructor(config: BurgerMenuConfig) {
    this.container = config.container;
    this.theme = config.theme;
    this.menuId = `jsc-chart-menu-${++burgerMenuCounter}`;
    const theme = this.theme;
    this.previousContainerPosition = this.container.style.position;
    this.didSetContainerPosition = false;

    const containerPosition = getComputedStyle(this.container).position;
    if (containerPosition === 'static') {
      this.container.style.position = 'relative';
      this.didSetContainerPosition = true;
    }

    this.injectStyles();

    const root = document.createElement('div');
    root.className = 'jsc-burger-menu';
    root.style.position = 'absolute';
    root.style.top = '0';
    root.style.right = '0';
    root.style.zIndex = '5';
    if (theme) {
      root.style.setProperty('--jsc-color-focus-ring', theme.colorFocusRing);
      root.style.setProperty('--jsc-burger-menu-item-hover-background', theme.burgerMenuItemHoverBackground);
      root.style.setProperty('--jsc-burger-menu-item-active-background', theme.burgerMenuItemActiveBackground);
    }

    const resolvedLocale = config.locale ?? 'en';
    const strings = getLocaleStrings(resolvedLocale);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'jsc-burger-menu-button';
    button.style.width = '2.5rem';
    button.style.height = '2.5rem';
    button.style.display = 'inline-flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.background = 'transparent';
    button.style.border = 'none';
    button.style.cursor = 'pointer';
    button.style.borderRadius = '999px';
    button.style.fontSize = '1.5rem';
    if (theme && !config.menuIconInheritColor) {
      button.style.color = theme.colorText;
    }
    if (config.menuIconInheritColor) {
      button.style.color = 'inherit';
    }
    button.setAttribute('aria-label', strings.chartMenuLabel);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-controls', this.menuId);
    button.textContent = '☰';

    const menu = document.createElement('ul');
    menu.className = 'jsc-burger-menu-list';
    menu.id = this.menuId;
    menu.style.position = 'absolute';
    menu.style.top = 'calc(100% + 4px)';
    menu.style.right = '0';
    menu.style.margin = '0';
    menu.style.padding = '0';
    menu.style.listStyle = 'none';
    menu.style.minWidth = '240px';
    menu.style.background = theme?.burgerMenuBackground ?? '#fff';
    menu.style.border = `1px solid ${theme?.burgerMenuBorderColor ?? '#bdbdbd'}`;
    menu.style.borderRadius = theme?.burgerMenuBorderRadius ?? '18px';
    menu.style.boxShadow = theme?.burgerMenuShadow ?? '0 4px 16px rgba(0, 0, 0, 0.12)';
    menu.style.color = theme?.colorText ?? '';
    menu.style.display = 'none';
    menu.style.overflow = 'hidden';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', strings.chartMenuLabel);
    menu.setAttribute('aria-orientation', 'vertical');

    button.addEventListener('click', () => {
      this.setOpen(!this.open);
    });

    menu.addEventListener('keydown', event => {
      if (!this.items.length) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        this.setActiveIndex((this.activeIndex + 1) % this.items.length, true);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        this.setActiveIndex((this.activeIndex - 1 + this.items.length) % this.items.length, true);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.setOpen(false, true);
        return;
      }
      if (event.key === 'Tab') {
        event.stopPropagation();
        this.setOpen(false, false);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        this.activateIndex(this.activeIndex);
      }
    });

    root.appendChild(button);
    root.appendChild(menu);

    this.root = root;
    this.button = button;
    this.menu = menu;

    const customItems: BurgerMenuItem[] = (config.menuItemDefinitions ?? []).map(item => {
      if (isLinkMenuItem(item)) {
        return {
          text: item.text,
          prefixIcon: item.prefixIcon,
          suffixIcon: item.suffixIcon,
          activate: () => {
            const target = item.openNewTab ? '_blank' : '_self';
            window.open(item.url, target, item.openNewTab ? 'noopener,noreferrer' : undefined);
          },
        };
      }

      return {
        text: item.text,
        prefixIcon: item.prefixIcon,
        suffixIcon: item.suffixIcon,
        activate: item.onClick,
      };
    });

    if (customItems.length > 0) {
      customItems[customItems.length - 1].bottomSeparator = true;
    }

    const items = [
      ...customItems,
      ...createBuiltInItems(
        this.container,
        strings,
        resolvedLocale,
        config.chartType,
        config.dataset,
        config.tableToggle,
        config.accessibilityMode,
        config.toggleAccessibilityMode,
      ),
    ];
    this.renderItems(items);

    this.onDocumentPointerDown = (event: MouseEvent) => {
      if (!this.open) return;
      const target = event.target;
      if (target instanceof Node && this.root.contains(target)) return;
      this.setOpen(false, false);
    };

    document.addEventListener('mousedown', this.onDocumentPointerDown);
    this.container.prepend(this.root);
  }

  private renderItems(items: BurgerMenuItem[]): void {
    const theme = this.theme;
    this.menu.innerHTML = '';
    this.items = items.map((item, index) => {
      const li = document.createElement('li');
      li.className = 'jsc-burger-menu-item';
      li.id = `${this.menuId}-item-${index}`;
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '0.5rem';
      li.style.padding = '0.625rem 0.875rem';
      li.style.cursor = 'pointer';
      li.style.userSelect = 'none';
      li.style.outline = 'none';
      if (item.bottomSeparator) {
        li.style.borderBottom = `1px solid ${theme?.burgerMenuItemSeparatorColor ?? '#e3e3e3'}`;
      }

      if (index === 0) {
        const radius = theme?.burgerMenuBorderRadius ?? '18px';
        li.style.borderTopLeftRadius = radius;
        li.style.borderTopRightRadius = radius;
      }
      if (index === items.length - 1) {
        const radius = theme?.burgerMenuBorderRadius ?? '18px';
        li.style.borderBottomLeftRadius = radius;
        li.style.borderBottomRightRadius = radius;
      }

      li.setAttribute('role', 'menuitem');
      li.tabIndex = -1;

      if (item.prefixIcon) {
        const prefix = document.createElement('span');
        prefix.className = 'jsc-burger-menu-prefix-icon';
        prefix.setAttribute('aria-hidden', 'true');
        prefix.textContent = item.prefixIcon;
        li.appendChild(prefix);
      }

      const text = document.createElement('span');
      text.className = 'jsc-burger-menu-text';
      text.textContent = item.text;
      li.appendChild(text);

      if (item.suffixIcon) {
        const suffix = document.createElement('span');
        suffix.className = 'jsc-burger-menu-suffix-icon';
        suffix.setAttribute('aria-hidden', 'true');
        suffix.textContent = item.suffixIcon;
        li.appendChild(suffix);
      }

      li.addEventListener('focus', () => {
        this.setActiveIndex(index, false);
      });

      li.addEventListener('click', () => {
        item.activate();
        this.setOpen(false, true);
      });

      this.menu.appendChild(li);
      return li;
    });

    if (this.items.length > 0) {
      this.setActiveIndex(0, false);
    }
  }

  private activateIndex(index: number): void {
    const item = this.items[index];
    item?.click();
  }

  private setActiveIndex(index: number, focus: boolean): void {
    if (!this.items.length) return;

    this.activeIndex = index;

    for (let i = 0; i < this.items.length; i++) {
      this.items[i].tabIndex = i === index ? 0 : -1;
      this.items[i].classList.toggle('jsc-burger-menu-item--active', i === index);
    }

    const activeItem = this.items[index];
    this.menu.setAttribute('aria-activedescendant', activeItem.id);
    if (focus) {
      activeItem.focus();
    }
  }

  private setOpen(open: boolean, restoreFocus = false): void {
    this.open = open;
    this.button.setAttribute('aria-expanded', String(open));
    this.button.textContent = open ? '×' : '☰';
    this.menu.style.display = open ? 'block' : 'none';

    if (open) {
      this.setActiveIndex(0, true);
      return;
    }

    if (restoreFocus) {
      this.button.focus();
    }
  }

  private injectStyles(): void {
    if (burgerMenuStyleRefCount === 0) {
      const style = document.createElement('style');
      style.id = 'jsc-burger-menu-styles';
      style.textContent = [
        '.jsc-burger-menu-button:focus-visible { outline: 2px solid var(--jsc-color-focus-ring, #0066cc); outline-offset: 2px; }',
        '.jsc-burger-menu-button:focus:not(:focus-visible) { outline: none; }',
        '.jsc-burger-menu-item { position: relative; }',
        '.jsc-burger-menu-item--active { background: var(--jsc-burger-menu-item-active-background, #eef5ff); box-shadow: inset 0 0 0 2px var(--jsc-color-focus-ring, #0066cc); }',
        '.jsc-burger-menu-item:focus-visible { outline: 2px solid var(--jsc-color-focus-ring, #0066cc); outline-offset: -2px; }',
        '.jsc-burger-menu-item:focus:not(:focus-visible) { outline: none; }',
        '.jsc-burger-menu-item:hover { background: var(--jsc-burger-menu-item-hover-background, #f5f5f5); }',
      ].join(' ');
      document.head.appendChild(style);
    }

    burgerMenuStyleRefCount++;
  }

  destroy(): void {
    document.removeEventListener('mousedown', this.onDocumentPointerDown);
    if (this.didSetContainerPosition) {
      if (this.previousContainerPosition) {
        this.container.style.position = this.previousContainerPosition;
      } else {
        this.container.style.removeProperty('position');
      }
    }

    burgerMenuStyleRefCount = Math.max(0, burgerMenuStyleRefCount - 1);
    if (burgerMenuStyleRefCount === 0) {
      document.getElementById('jsc-burger-menu-styles')?.remove();
    }

    this.root.remove();
  }
}
