import '../../portrait-menu.css';

type ActionStyle = 'primary' | 'secondary' | 'back' | 'danger';

/** Portrait menus use CSS layout and native text, independent of the combat camera. */
export class PortraitMenu {
  private root?: HTMLElement;
  private scroll?: HTMLElement;
  private body?: HTMLElement;
  private footer?: HTMLElement;
  private screen = '';
  private restoreScroll = 0;
  private images = new Map<string, string>();
  get visible(): boolean { return !!this.root; }

  begin(screen: string, title: string, subtitle = ''): void {
    this.restoreScroll = this.screen === screen ? this.scroll?.scrollTop ?? 0 : 0;
    this.hide();
    this.screen = screen;
    const root = this.el('section', `bw-mobile bw-mobile-screen-${screen}`);
    root.dataset.screen = screen;
    root.setAttribute('aria-label', title);
    if (['pause', 'defeat', 'result', 'confirm-exit'].includes(screen)) {
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    }
    root.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
    const scroll = this.el('div', 'bw-mobile-scroll');
    const body = this.el('div', 'bw-mobile-body');
    if (screen !== 'title') {
      const header = this.el('header', 'bw-mobile-header');
      header.append(this.el('p', 'bw-mobile-eyebrow', 'Bullet Wake'), this.el('h1', '', title));
      if (subtitle) header.append(this.el('p', 'bw-mobile-subtitle', subtitle));
      body.append(header);
    }
    scroll.append(body);
    const footer = this.el('footer', 'bw-mobile-footer');
    root.append(scroll, footer);
    document.body.append(root);
    this.root = root; this.scroll = scroll; this.body = body; this.footer = footer;
  }
  end(): void { if (this.scroll) this.scroll.scrollTop = this.restoreScroll; }
  hide(): void { this.root?.remove(); this.root = this.body = this.footer = this.scroll = undefined; }
  destroy(): void { this.hide(); this.images.clear(); }
  private el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  text(text: string, tone: 'normal' | 'hint' | 'gold' = 'normal'): void {
    this.body?.append(this.el('p', `bw-mobile-copy ${tone}`, text));
  }
  heading(text: string): void { this.body?.append(this.el('h2', 'bw-mobile-section-title', text)); }
  logo(): void {
    const wrap = this.el('div', 'bw-mobile-brand');
    const image = this.el('img'); image.src = `${import.meta.env.BASE_URL}assets/arcade/ui/logo-arcade.webp`;
    image.alt = 'Bullet Wake'; image.draggable = false;
    wrap.append(image); this.body?.append(wrap);
  }
  button(label: string, action: () => void, opts: { style?: ActionStyle; disabled?: boolean; footer?: boolean; compact?: boolean } = {}): HTMLButtonElement {
    const button = this.el('button', `bw-mobile-button ${opts.style ?? 'secondary'} ${opts.compact ? 'compact' : ''}`, label);
    button.type = 'button'; button.disabled = !!opts.disabled;
    button.addEventListener('click', action);
    (opts.footer ? this.footer : this.body)?.append(button);
    return button;
  }
  tabs(items: { label: string; active: boolean; action: () => void }[]): void {
    const row = this.el('nav', 'bw-mobile-tabs');
    for (const item of items) {
      const button = this.el('button', item.active ? 'active' : '', item.label);
      button.type = 'button'; button.setAttribute('aria-pressed', String(item.active));
      button.addEventListener('click', item.action); row.append(button);
    }
    this.body?.append(row);
  }
  metrics(items: [string, string | number][]): void {
    const grid = this.el('dl', 'bw-mobile-metrics');
    for (const [label, value] of items) {
      const cell = this.el('div'); cell.append(this.el('dt', '', label), this.el('dd', '', String(value))); grid.append(cell);
    }
    this.body?.append(grid);
  }
  portrait(image: string, name: string, subtitle: string): void {
    const hero = this.el('div', 'bw-mobile-pilot'); const img = this.el('img');
    img.src = image; img.alt = name;
    const caption = this.el('div'); caption.append(this.el('h2', '', name), this.el('p', '', subtitle));
    hero.append(img, caption); this.body?.append(hero);
  }
  pilots(items: { name: string; image: string; selected: boolean; unlocked: boolean; action: () => void }[]): void {
    const list = this.el('div', 'bw-mobile-pilots');
    for (const item of items) {
      const button = this.el('button', item.selected ? 'selected' : ''); button.type = 'button';
      button.setAttribute('aria-pressed', String(item.selected)); button.setAttribute('aria-label', `${item.name}${item.unlocked ? '' : ', bloqueado'}`);
      const img = this.el('img'); img.src = item.image; img.alt = '';
      button.append(img, this.el('span', '', item.name), this.el('small', '', item.unlocked ? 'Piloto' : 'Bloqueado'));
      button.addEventListener('click', item.action); list.append(button);
    }
    this.body?.append(list);
  }
  card(title: string, detail: string, opts: { image?: string; badge?: string; action?: () => void; label?: string; disabled?: boolean } = {}): void {
    const card = this.el('article', 'bw-mobile-card');
    if (opts.image) { const img = this.el('img', 'bw-mobile-route-art'); img.src = opts.image; img.alt = ''; card.append(img); }
    const content = this.el('div', 'bw-mobile-card-content');
    if (opts.badge) content.append(this.el('p', 'bw-mobile-eyebrow', opts.badge));
    content.append(this.el('h2', '', title), this.el('p', '', detail));
    if (opts.action) {
      const button = this.el('button', 'bw-mobile-button primary', opts.label ?? 'Selecionar');
      button.type = 'button'; button.disabled = !!opts.disabled; button.addEventListener('click', opts.action); content.append(button);
    }
    card.append(content); this.body?.append(card);
  }
  setting(label: string, value: string, previous: () => void, next: () => void): void {
    const row = this.el('div', 'bw-mobile-setting');
    const copy = this.el('div'); copy.append(this.el('span', '', label), this.el('strong', '', value));
    const controls = this.el('div');
    for (const [symbol, action, direction] of [['−', previous, 'Diminuir'], ['+', next, 'Aumentar']] as const) {
      const button = this.el('button', '', symbol); button.type = 'button'; button.setAttribute('aria-label', `${direction} ${label}`);
      button.addEventListener('click', action); controls.append(button);
    }
    row.append(copy, controls); this.body?.append(row);
  }
  volume(label: string, value: number, change: (value: number) => void): void {
    const row = this.el('label', 'bw-mobile-volume'); const caption = this.el('span', '', label);
    const output = this.el('strong', '', `${Math.round(value * 100)}%`);
    const input = this.el('input'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.1'; input.value = String(value);
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => { change(Number(input.value)); output.textContent = `${Math.round(Number(input.value) * 100)}%`; });
    row.append(caption, output, input); this.body?.append(row);
  }
  /** Cache a sprite frame at its authored resolution, without stretching the sheet. */
  frame(key: string, source: CanvasImageSource, x: number, y: number, width: number, height: number): string {
    const cached = this.images.get(key); if (cached) return cached;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d')!.drawImage(source, x, y, width, height, 0, 0, width, height);
    const image = canvas.toDataURL('image/png'); this.images.set(key, image); return image;
  }
}
