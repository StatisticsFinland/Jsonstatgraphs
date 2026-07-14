import { Selection } from 'd3-selection';
import { FooterItem, ResolvedTheme } from '../types';

/** Get the full display text from a footer item (used for aria-label). */
function getFooterItemText(item: FooterItem): string {
  return `${item.label} ${item.value}`;
}

function isValidLink(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

interface SvgFooterParams {
  parent: Selection<SVGSVGElement, unknown, null, undefined>;
  footerItems: FooterItem[];
  sourceLink?: string;
  theme: ResolvedTheme;
  x: number;
  y: number;
  lineHeight: number;
}

export function renderSvgFooter(params: SvgFooterParams): void {
  const { parent, footerItems, sourceLink, theme, x, y, lineHeight } = params;
  const footerGroup = parent.append('g').attr('class', 'jsc-footer');

  for (let i = 0; i < footerItems.length; i++) {
    const item = footerItems[i];
    const itemText = getFooterItemText(item);
    const useLink = item.type === 'source' && !!sourceLink && isValidLink(sourceLink);

    const parentEl = useLink
      ? footerGroup
          .append('a')
          .attr('href', sourceLink)
          .attr('xlink:href', sourceLink)
          .attr('target', '_blank')
          .attr('rel', 'noopener noreferrer')
          .attr('role', 'link')
          .attr('tabindex', '0')
          .attr('aria-label', itemText + ' (opens in new tab)')
      : footerGroup;

    const textEl = parentEl
      .append('text')
      .attr('class', 'jsc-footer-text')
      .attr('x', x)
      .attr('y', y + i * lineHeight + lineHeight / 2)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', theme.fontSizeTick)
      .attr('font-family', theme.fontFamily)
      .attr('fill', theme.colorTextSecondary);

    textEl.append('tspan')
      .attr('class', 'jsc-footer-label')
      .attr('pointer-events', useLink ? 'none' : null)
      .text(item.label + ' ');

    textEl.append('tspan')
      .attr('class', 'jsc-footer-value')
      .attr('fill', useLink ? theme.colorLink : null)
      .attr('style', useLink ? 'cursor: pointer;' : null)
      .text(item.value);
  }
}

interface HtmlFooterParams {
  parent: HTMLElement;
  footerItems: FooterItem[];
  sourceLink?: string;
  theme: ResolvedTheme;
  align?: 'center' | 'left';
}

export function renderHtmlFooter(params: HtmlFooterParams): void {
  const { parent, footerItems, sourceLink, theme } = params;

  const footerEl = document.createElement('div');
  footerEl.className = 'jsc-key-figure-footer';
  footerEl.style.fontSize = theme.fontSizeTick;
  footerEl.style.color = theme.colorTextSecondary;
  footerEl.style.display = 'flex';

  if (params.align === 'left') {
    footerEl.style.flexDirection = 'column';
    footerEl.style.alignItems = 'flex-start';
    footerEl.style.gap = '4px';
    footerEl.style.marginTop = '8px';
  } else {
    footerEl.style.gap = '16px';
    footerEl.style.flexWrap = 'wrap';
    footerEl.style.justifyContent = 'center';
  }

  for (const item of footerItems) {
    const itemText = getFooterItemText(item);
    const useLink = item.type === 'source' && !!sourceLink && isValidLink(sourceLink);
    const container = document.createElement('span');

    if (item.type === 'source') {
      container.className = 'jsc-key-figure-source';
    } else if (item.type === 'unit') {
      container.className = 'jsc-footer-unit';
    } else if (item.type === 'updated') {
      container.className = 'jsc-key-figure-updated';
    } else {
      container.className = 'jsc-key-figure-footer-item';
    }

    const labelSpan = document.createElement('span');
    labelSpan.className = 'jsc-footer-label';
    labelSpan.textContent = item.label + ' ';
    container.appendChild(labelSpan);

    if (useLink) {
      const linkEl = document.createElement('a');
      linkEl.href = sourceLink!;
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
      linkEl.setAttribute('aria-label', itemText + ' (opens in new tab)');
      linkEl.className = 'jsc-footer-value';
      linkEl.textContent = item.value;
      linkEl.style.color = theme.colorLink;
      linkEl.style.textDecoration = 'underline';
      container.appendChild(linkEl);
    } else {
      const valueSpan = document.createElement('span');
      valueSpan.className = 'jsc-footer-value';
      valueSpan.textContent = item.value;
      container.appendChild(valueSpan);
    }

    footerEl.appendChild(container);
  }

  parent.appendChild(footerEl);
}
