import '../../portrait-menu.css';

type ActionStyle = 'primary' | 'secondary' | 'back' | 'danger';
type IconName =
  | 'gear'
  | 'lock'
  | 'play'
  | 'hangar'
  | 'shop'
  | 'controls'
  | 'credits'
  | 'user'
  | 'login'
  | 'logout'
  | 'chevron'
  | 'pilots'
  | 'shield'
  | 'check'
  | 'close'
  | 'grid'
  | 'coin'
  | 'gem';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICON_PATHS: Record<IconName, string> = {
  gear: '<path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 .92-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 .92 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51.92H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51.92Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5" stroke="currentColor" stroke-width="2.1" fill="currentColor" fill-opacity="0.18"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><circle cx="12" cy="16" r="1.4" fill="currentColor"/>',
  play: '<path d="M7.5 5.2 19 12 7.5 18.8V5.2Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  hangar: '<path d="M12 3 21 8.2V19a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 19V8.2L12 3Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 20.5v-6.5h8v6.5M9 10.5h6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  shop: '<path d="M6 8h12l-1 11.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19.5L6 8Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  controls: '<rect x="3" y="7" width="18" height="10.5" rx="4.5" stroke="currentColor" stroke-width="1.9"/><path d="M8 10.2v4M6 12.2h4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="15.5" cy="11.2" r="1.1" fill="currentColor"/><circle cx="17.8" cy="13.2" r="1.1" fill="currentColor"/>',
  credits: '<path d="m12 3.5 2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6-4.9 2.6.9-5.5-4-3.9 5.5-.8 2.5-5Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
  user: '<circle cx="12" cy="8.2" r="3.6" stroke="currentColor" stroke-width="1.9"/><path d="M5 19.5c1.2-3.4 3.8-5.1 7-5.1s5.8 1.7 7 5.1" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  login: '<path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M10 8l4 4-4 4M4 12h10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  logout: '<path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M15 8l4 4-4 4M19 12H9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  chevron: '<path d="m9 6 6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  pilots: '<path d="M12 3 15 11l6 3.5-1 2.2-5-1.2V19l2 1.5v1.3L12 20.6l-5 1.2v-1.3L9 19v-3.5L4 16.7l-1-2.2L9 11 12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  shield: '<path d="M12 3 4.5 6.2v5.4c0 4.6 3.1 8.4 7.5 9.6 4.4-1.2 7.5-5 7.5-9.6V6.2L12 3Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="m9 12.2 2 2 4.2-4.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6 18 18M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.8"/>',
  coin: '<circle cx="12" cy="12" r="8.5" fill="#ffd447" fill-opacity="0.22" stroke="#ffe57d" stroke-width="2"/><path d="M12 7.5v9M9.5 10c0-1.1 1.1-1.8 2.5-1.8s2.5.7 2.5 1.8c0 1.2-1 1.6-2.5 2s-2.5.8-2.5 2c0 1.1 1.1 1.8 2.5 1.8s2.5-.7 2.5-1.8" stroke="#ffe57d" stroke-width="1.7" stroke-linecap="round"/>',
  gem: '<path d="M7 4.5h10l4 5.2-9 10.3-9-10.3 4-5.2Z" fill="#5ce6ff" fill-opacity="0.25" stroke="#78eeff" stroke-width="1.9" stroke-linejoin="round"/><path d="M3 9.7h18M7 4.5l2.2 5.2L12 20l2.8-10.3L17 4.5" stroke="#aef6ff" stroke-width="1.3" stroke-linejoin="round"/>',
};

const DIALOG_SCREENS = new Set(['pause', 'defeat', 'result', 'confirm-exit', 'controller-orientation', 'controller-lost']);

const LGPD_SECTIONS: ReadonlyArray<readonly [string, string]> = [
  ['1. Controlador e finalidade', 'Bullet Wake é publicado pela Botan Studio (Emerson Barros). Os dados são usados exclusivamente para manter seu progresso de fases, recordes, pilotos desbloqueados, preferências de áudio/controle e codinome opcional.'],
  ['2. Armazenamento local (offline)', 'Nesta versão, todas as informações ficam gravadas apenas no armazenamento local do seu aparelho. Não coletamos dados pessoais sensíveis, localização, contatos, fotos nem compartilhamos dados com terceiros ou redes de anúncios.'],
  ['3. Base legal e LGPD (Lei nº 13.709/2018)', 'O tratamento observa os princípios de finalidade, adequação e necessidade da LGPD, com seu consentimento expresso ao prosseguir no aplicativo. Caso recursos de conta online e nuvem sejam adicionados no futuro, você será avisado para revisar os termos antes de ativá-los.'],
  ['4. Seus direitos (Art. 18 da LGPD)', 'Você pode consultar, alterar seu codinome, desconectar sua sessão local no Perfil ou excluir integralmente todos os dados a qualquer momento limpando os dados do aplicativo nas configurações do dispositivo.'],
];

export interface HomeStageItem {
  readonly index: number;
  readonly badge: string;
  readonly name: string;
  readonly perspectiveLabel: string;
  readonly durationLabel: string;
  readonly summary: string;
  readonly recordLabel: string;
  readonly image: string;
  readonly unlocked: boolean;
  readonly unlockHint: string;
}

export interface DashboardOptions {
  readonly stages: readonly HomeStageItem[];
  readonly activeStageIndex: number;
  readonly flybys: string[][];
  readonly pilotName: string;
  readonly shipName: string;
  readonly avatarImage: string;
  readonly accountName: string;
  readonly accountLinked: boolean;
  readonly credits: number;
  readonly gems: number;
  readonly onSelectStage: (index: number) => void;
  readonly onOpenAllStages: () => void;
  readonly onLaunchMission: (stageIndex: number) => void;
  readonly onPilots: () => void;
  readonly onProfile: () => void;
  readonly onSettings: () => void;
  readonly onHangar: () => void;
  readonly onControls: () => void;
  readonly onCredits: () => void;
}

export interface StageGridModalOptions {
  readonly stages: readonly HomeStageItem[];
  readonly activeStageIndex: number;
  readonly onPickStage: (index: number) => void;
  readonly onClose: () => void;
}

export interface WelcomeLoginOptions {
  readonly defaultName?: string;
  readonly initialPrivacyAccepted?: boolean;
  readonly onLogin: (name: string) => void;
  readonly onGuest: () => void;
}

export interface PilotShowcaseOptions {
  readonly portraitImage: string;
  readonly shipImage: string;
  readonly name: string;
  readonly nationality: string;
  readonly shipName: string;
  readonly callsign: string;
  readonly weaponName: string;
  readonly specialName: string;
  readonly detail: string;
  readonly unlocked: boolean;
  readonly stats: { readonly speed: number; readonly firepower: number; readonly armor: number };
  readonly history: { readonly sorties: number; readonly clears: number; readonly kills: number; readonly bestScore: number };
}

export interface ConfirmPurchaseOptions {
  readonly portraitImage: string;
  readonly shipImage: string;
  readonly pilotName: string;
  readonly shipName: string;
  readonly cost: number;
  readonly currentCredits: number;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export interface PilotStripItem {
  readonly name: string;
  readonly image: string;
  readonly selected: boolean;
  readonly unlocked: boolean;
  readonly cost: number;
  readonly action: () => void;
}

export interface AccountCardOptions {
  readonly avatarImage: string;
  readonly linked: boolean;
  readonly displayName: string;
  readonly onLogin: (name: string) => void;
  readonly onLogout: () => void;
}

/** Mobile menus use crisp CSS layout, native text, and vector icons independent of the combat camera. */
export class PortraitMenu {
  private root?: HTMLElement;
  private scroll?: HTMLElement;
  private body?: HTMLElement;
  private footer?: HTMLElement;
  private container?: HTMLElement;
  private countdownEl?: HTMLElement;
  private screen = '';
  private restoreScroll = 0;
  private restoreFocus = -1;
  private images = new Map<string, string>();
  private activationTimer?: number;
  constructor(private readonly onConfirm?: () => void) {}
  get visible(): boolean { return !!this.root; }

  begin(
    screen: string,
    title: string,
    subtitle = '',
    opts: { compactHeader?: boolean; headerBadge?: string; footerRow?: boolean; liveBackdrop?: boolean } = {},
  ): void {
    this.restoreScroll = this.screen === screen ? this.scroll?.scrollTop ?? 0 : 0;
    this.restoreFocus = this.screen === screen ? [...this.root?.querySelectorAll('button:not(:disabled),input') ?? []].indexOf(document.activeElement!) : -1;
    this.hide();
    this.screen = screen;
    const isDialog = DIALOG_SCREENS.has(screen);
    const liveCls = opts.liveBackdrop ? ' bw-live-backdrop' : '';
    const root = this.el('section', `bw-mobile bw-mobile-screen-${screen}${isDialog ? ' bw-mobile-is-dialog' : ''}${liveCls}`);
    root.dataset.screen = screen;
    root.setAttribute('aria-label', title);
    if (isDialog) {
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
    }
    root.addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); });
    const scroll = this.el('div', 'bw-mobile-scroll');
    const body = this.el('div', 'bw-mobile-body');
    if (screen !== 'title') {
      const header = this.el('header', `bw-mobile-header${opts.compactHeader ? ' compact' : ''}`);
      if (opts.compactHeader) {
        const titleWrap = this.el('div', 'bw-mobile-header-copy');
        titleWrap.append(this.el('h1', '', title));
        if (subtitle) titleWrap.append(this.el('p', 'bw-mobile-subtitle', subtitle));
        header.append(titleWrap);
        if (opts.headerBadge) header.append(this.el('span', 'bw-mobile-credit-pill', opts.headerBadge));
      } else {
        header.append(this.el('p', 'bw-mobile-eyebrow', 'Bullet Wake'), this.el('h1', '', title));
        if (subtitle) header.append(this.el('p', 'bw-mobile-subtitle', subtitle));
      }
      body.append(header);
    }
    scroll.append(body);
    const footer = this.el('footer', `bw-mobile-footer${opts.footerRow ? ' row' : ''}`);
    root.append(scroll, footer);
    document.body.append(root);
    this.root = root; this.scroll = scroll; this.body = body; this.footer = footer; this.container = body;
  }

  end(): void {
    this.container = this.body;
    if (this.scroll) this.scroll.scrollTop = this.restoreScroll;
    if (this.restoreFocus >= 0) this.root?.querySelectorAll<HTMLElement>('button:not(:disabled),input')[this.restoreFocus]?.focus({ preventScroll: true });
  }
  hide(): void {
    window.clearTimeout(this.activationTimer); this.activationTimer = undefined;
    this.root?.remove(); this.root = this.body = this.footer = this.scroll = this.container = undefined;
  }
  hideCountdown(): void {
    this.countdownEl?.remove();
    this.countdownEl = undefined;
  }
  showCountdown(stepText: string, subtitle: string, ready = false): void {
    if (!this.countdownEl) {
      const el = this.el('div', 'bw-countdown-overlay');
      el.setAttribute('aria-live', 'assertive');
      el.append(this.el('p', 'bw-countdown-sub'), this.el('div', 'bw-countdown-num'));
      document.body.append(el);
      this.countdownEl = el;
    }
    const sub = this.countdownEl.querySelector<HTMLElement>('.bw-countdown-sub')!;
    const num = this.countdownEl.querySelector<HTMLElement>('.bw-countdown-num')!;
    if (sub.textContent !== subtitle) sub.textContent = subtitle;
    if (num.textContent !== stepText) {
      num.textContent = stepText;
      num.className = `bw-countdown-num${ready ? ' is-ready' : ''}`;
      // Trigger crisp pop animation on each step change
      void num.offsetWidth;
      num.classList.add('is-pop');
    }
  }
  destroy(): void { this.hide(); this.hideCountdown(); this.images.clear(); }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag); node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  private icon(name: IconName, className = 'bw-ico'): SVGSVGElement {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', className);
    svg.innerHTML = ICON_PATHS[name];
    return svg;
  }

  private target(): HTMLElement | undefined { return this.container ?? this.body; }

  text(text: string, tone: 'normal' | 'hint' | 'gold' = 'normal'): void {
    this.target()?.append(this.el('p', `bw-mobile-copy ${tone}`, text));
  }
  heading(text: string): void { this.target()?.append(this.el('h2', 'bw-mobile-section-title', text)); }

  homeDashboard(opts: DashboardOptions): void {
    const shell = this.el('div', 'bw-dash');
    let currentIdx = Math.max(0, Math.min(opts.stages.length - 1, opts.activeStageIndex));

    // Row 1: Top bar — Logo left, Credits (star) + Controls (gamepad) + Settings (gear) right.
    const topbar = this.el('header', 'bw-dash-topbar');
    const brand = this.el('div', 'bw-dash-logo');
    const logoImg = this.el('img');
    logoImg.src = `${import.meta.env.BASE_URL}assets/arcade/ui/logo-arcade.webp`;
    logoImg.alt = 'Bullet Wake'; logoImg.draggable = false;
    brand.append(logoImg);

    const tools = this.el('div', 'bw-dash-tools');
    const iconBtns: Array<{ icon: IconName; label: string; cls: string; action: () => void }> = [
      { icon: 'credits', label: 'Créditos', cls: 'bw-dash-icon-btn bw-dash-credits', action: opts.onCredits },
      { icon: 'controls', label: 'Controles', cls: 'bw-dash-icon-btn bw-dash-controls', action: opts.onControls },
      { icon: 'gear', label: 'Configurações', cls: 'bw-dash-icon-btn bw-dash-gear', action: opts.onSettings },
    ];
    for (const item of iconBtns) {
      const btn = this.el('button', item.cls);
      btn.type = 'button';
      btn.setAttribute('aria-label', item.label);
      btn.append(this.icon(item.icon, 'bw-ico bw-ico-gear'));
      this.bindAction(btn, item.action);
      tools.append(btn);
    }
    topbar.append(brand, tools);

    // Row 2: Profile & Currencies strip (Profile + active pilot on left; Credits + Gems pills on right).
    const statusBar = this.el('div', 'bw-dash-status-bar');
    const profileBtn = this.el('button', 'bw-dash-profile');
    profileBtn.type = 'button';
    profileBtn.setAttribute('aria-label', `Perfil: ${opts.accountName}, piloto ${opts.pilotName}`);
    const avatar = this.el('img', 'bw-dash-avatar');
    avatar.src = opts.avatarImage; avatar.alt = ''; avatar.draggable = false;
    const pInfo = this.el('span', 'bw-dash-profile-copy');
    pInfo.append(
      this.el('strong', '', opts.accountLinked ? opts.accountName : 'Convidado'),
      this.el('small', '', `${opts.pilotName} · ${opts.shipName}`),
    );
    profileBtn.append(avatar, pInfo);
    this.bindAction(profileBtn, opts.onProfile);

    const currencies = this.el('div', 'bw-dash-currencies');
    const crPill = this.el('span', 'bw-currency-pill cr');
    crPill.setAttribute('aria-label', `${opts.credits} créditos`);
    crPill.append(this.icon('coin', 'bw-ico bw-ico-curr'), this.el('strong', '', `${opts.credits}`));
    const gemPill = this.el('span', 'bw-currency-pill gem');
    gemPill.setAttribute('aria-label', `${opts.gems} gemas`);
    gemPill.append(this.icon('gem', 'bw-ico bw-ico-curr'), this.el('strong', '', `${opts.gems}`));
    currencies.append(crPill, gemPill);
    statusBar.append(profileBtn, currencies);

    // Row 3: Dedicated aerial corridor where flyby planes pass exclusively.
    const skyLane = this.el('div', 'bw-dash-sky-lane');
    skyLane.setAttribute('aria-hidden', 'true');
    opts.flybys.forEach((frames, i) => {
      const flight = this.el('span', `bw-mobile-flyby flyby-${i}`);
      frames.forEach((src, index) => {
        const img = this.el('img', 'bw-mobile-wingman-frame'); img.src = src; img.alt = ''; img.draggable = false;
        img.style.animationDelay = `${-index / 16}s`; flight.append(img);
      });
      skyLane.append(flight);
    });

    // Row 4: Smooth Swipe Stage Carousel (narrower, taller, zero arrows, dots only).
    const carousel = this.el('section', 'bw-stage-carousel');
    carousel.setAttribute('aria-label', 'Fases da campanha');

    const viewport = this.el('div', 'bw-stage-viewport');
    const track = this.el('div', 'bw-stage-track');

    opts.stages.forEach((stage) => {
      const slide = this.el('div', 'bw-stage-slide');
      const card = this.el('button', `bw-stage-hero-card${stage.unlocked ? '' : ' is-locked'}`);
      card.type = 'button';
      card.setAttribute('aria-label', `${stage.badge} ${stage.name}${stage.unlocked ? '' : ', bloqueada'}. Toque para ver todas as fases`);

      const media = this.el('div', 'bw-stage-hero-media');
      const img = this.el('img', 'bw-stage-hero-img');
      img.src = stage.image; img.alt = stage.name; img.draggable = false;
      media.append(img);

      const topTags = this.el('div', 'bw-stage-hero-tags');
      topTags.append(
        this.el('span', `bw-stage-badge${stage.unlocked ? '' : ' locked'}`, stage.badge),
        this.el('span', 'bw-stage-mode-pill', `${stage.perspectiveLabel} · ${stage.durationLabel}`),
      );
      media.append(topTags);

      if (!stage.unlocked) {
        const centerLock = this.el('div', 'bw-center-lock');
        centerLock.append(this.icon('lock', 'bw-ico bw-ico-lock-lg'));
        media.append(centerLock);
      }

      const body = this.el('div', 'bw-stage-hero-body');
      const titleRow = this.el('div', 'bw-stage-hero-title-row');
      titleRow.append(this.el('h2', '', stage.name));
      const allTag = this.el('span', 'bw-stage-all-hint');
      allTag.append(this.icon('grid', 'bw-ico bw-ico-xs'), this.el('span', '', 'Fases'));
      titleRow.append(allTag);

      body.append(titleRow, this.el('p', 'bw-stage-hero-summary', stage.summary));
      const metaRow = this.el('div', 'bw-stage-hero-meta');
      metaRow.append(
        this.el('span', `bw-stage-record${stage.unlocked ? '' : ' locked'}`, stage.unlocked ? stage.recordLabel : stage.unlockHint),
      );
      body.append(metaRow);

      card.append(media, body);
      slide.append(card);
      track.append(slide);
    });
    viewport.append(track);

    // Pagination dots ONLY (no left/right arrow buttons).
    const dotsWrap = this.el('div', 'bw-stage-dots');
    dotsWrap.setAttribute('role', 'tablist');
    dotsWrap.setAttribute('aria-label', 'Selecionar fase');
    const dotButtons: HTMLButtonElement[] = [];

    // Primary Launch CTA + 3-Tile Bottom Dock (Pilotos, Hangar, Loja highlighted!).
    const actions = this.el('div', 'bw-dash-actions');
    const playBtn = this.el('button', 'bw-mobile-button primary bw-dash-play');
    playBtn.type = 'button';

    const syncStageUI = (instant = false) => {
      const stage = opts.stages[currentIdx] ?? opts.stages[0];
      track.style.transition = instant ? 'none' : 'transform 300ms cubic-bezier(0.22, 1, 0.36, 1)';
      track.style.transform = `translate3d(${-currentIdx * 100}%, 0, 0)`;
      dotButtons.forEach((btn, idx) => {
        btn.classList.toggle('active', idx === currentIdx);
        btn.setAttribute('aria-selected', String(idx === currentIdx));
      });
      playBtn.disabled = !stage.unlocked;
      playBtn.className = `bw-mobile-button ${stage.unlocked ? 'primary' : 'secondary'} bw-dash-play`;
      playBtn.replaceChildren(
        this.icon(stage.unlocked ? 'play' : 'lock', 'bw-ico bw-ico-play'),
        this.el('span', '', 'Iniciar missão'),
      );
    };

    const goToStage = (nextIdx: number) => {
      const clamped = Math.max(0, Math.min(opts.stages.length - 1, nextIdx));
      const changed = clamped !== currentIdx;
      currentIdx = clamped;
      syncStageUI(false);
      if (changed) opts.onSelectStage(currentIdx);
    };

    opts.stages.forEach((st, idx) => {
      const dotBtn = this.el('button', `bw-stage-dot${idx === currentIdx ? ' active' : ''}${st.unlocked ? '' : ' locked'}`);
      dotBtn.type = 'button';
      dotBtn.setAttribute('role', 'tab');
      dotBtn.setAttribute('aria-selected', String(idx === currentIdx));
      dotBtn.setAttribute('aria-label', `${st.badge}: ${st.name}`);
      dotBtn.append(this.el('span', 'bw-stage-dot-pip'));
      this.bindAction(dotBtn, () => goToStage(idx));
      dotButtons.push(dotBtn);
      dotsWrap.append(dotBtn);
    });

    // Real 1:1 finger-tracking horizontal swipe with smooth spring snap + tap to open All Stages modal!
    let swipeStart: { x: number; y: number; id: number; time: number } | undefined;
    let dragging = false;
    let lastDx = 0;
    viewport.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      swipeStart = { x: e.clientX, y: e.clientY, id: e.pointerId, time: performance.now() };
      dragging = false;
      lastDx = 0;
      track.style.transition = 'none';
    });
    viewport.addEventListener('pointermove', e => {
      if (!swipeStart || e.pointerId !== swipeStart.id) return;
      const dx = e.clientX - swipeStart.x;
      const dy = e.clientY - swipeStart.y;
      if (!dragging && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        dragging = true;
      }
      if (dragging) {
        lastDx = dx;
        const width = Math.max(1, viewport.clientWidth);
        const edgeResist = (currentIdx === 0 && dx > 0) || (currentIdx === opts.stages.length - 1 && dx < 0) ? 0.32 : 1;
        const pct = -currentIdx * 100 + ((dx * edgeResist) / width) * 100;
        track.style.transform = `translate3d(${pct}%, 0, 0)`;
      }
    });
    const finishSwipe = (e: PointerEvent, cancelled = false) => {
      if (!swipeStart || e.pointerId !== swipeStart.id) return;
      const wasDragging = dragging;
      const elapsed = Math.max(1, performance.now() - swipeStart.time);
      const dx = lastDx;
      swipeStart = undefined;
      dragging = false;
      lastDx = 0;
      if (wasDragging) {
        const width = Math.max(1, viewport.clientWidth);
        const fastFlick = Math.abs(dx) > 24 && Math.abs(dx) / elapsed > 0.35;
        if (!cancelled && (Math.abs(dx) > width * 0.2 || fastFlick)) {
          const next = currentIdx + (dx < 0 ? 1 : -1);
          if (next >= 0 && next < opts.stages.length) {
            this.onConfirm?.();
            goToStage(next);
            return;
          }
        }
        syncStageUI(false);
      }
    };
    viewport.addEventListener('pointerup', e => finishSwipe(e, false));
    viewport.addEventListener('pointercancel', e => finishSwipe(e, true));
    viewport.addEventListener('click', e => {
      const btn = (e.target as HTMLElement | null)?.closest('.bw-stage-hero-card');
      if (!btn || Math.abs(lastDx) > 8 || this.activationTimer !== undefined) return;
      btn.classList.add('is-confirmed');
      this.onConfirm?.(); window.BulletWakeAndroid?.menuFeedback?.();
      this.activationTimer = window.setTimeout(() => {
        this.activationTimer = undefined; btn.classList.remove('is-confirmed');
        if (btn.isConnected) opts.onOpenAllStages();
      }, 90);
    });

    carousel.append(viewport, dotsWrap);

    this.bindAction(playBtn, () => {
      const st = opts.stages[currentIdx];
      if (st?.unlocked) opts.onLaunchMission(currentIdx);
    });

    const dock = this.el('nav', 'bw-dash-dock');
    dock.setAttribute('aria-label', 'Menu principal');
    const tiles: Array<{ label: string; icon: IconName; locked?: boolean; shop?: boolean; action?: () => void }> = [
      { label: 'Pilotos', icon: 'pilots', action: opts.onPilots },
      { label: 'Hangar', icon: 'hangar', action: opts.onHangar },
      { label: 'Loja', icon: 'shop', locked: true, shop: true },
    ];
    for (const tile of tiles) {
      const btn = this.el('button', `bw-dash-tile${tile.shop ? ' is-shop' : ''}${tile.locked ? ' is-locked' : ''}`);
      btn.type = 'button';
      if (tile.locked) {
        btn.disabled = true;
        btn.setAttribute('aria-label', `${tile.label} (em breve, bloqueada)`);
        const lockBadge = this.el('span', 'bw-lock-badge sm');
        lockBadge.append(this.icon('lock', 'bw-ico bw-ico-lock'));
        btn.append(lockBadge);
      } else if (tile.action) {
        this.bindAction(btn, tile.action);
      }
      btn.append(this.icon(tile.icon, 'bw-ico bw-ico-tile'), this.el('span', '', tile.label));
      dock.append(btn);
    }

    syncStageUI(true);
    actions.append(playBtn, dock);
    shell.append(topbar, statusBar, skyLane, carousel, actions);
    this.body?.append(shell);
  }

  stageGridModal(opts: StageGridModalOptions): void {
    const overlay = this.el('div', 'bw-modal-overlay bw-stages-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Todas as fases');

    const sheet = this.el('div', 'bw-stages-sheet');
    const head = this.el('header', 'bw-stages-head');
    const headCopy = this.el('div');
    headCopy.append(this.el('p', 'bw-mobile-eyebrow', 'Campanha'), this.el('h2', '', 'Todas as fases'));
    const closeBtn = this.el('button', 'bw-stages-close');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Fechar seleção de fases');
    closeBtn.append(this.icon('close', 'bw-ico'));
    this.bindAction(closeBtn, opts.onClose);
    head.append(headCopy, closeBtn);

    const grid = this.el('div', 'bw-stages-grid');
    for (const st of opts.stages) {
      const tile = this.el('button', `bw-stage-mini-card${st.index === opts.activeStageIndex ? ' active' : ''}${st.unlocked ? '' : ' is-locked'}`);
      tile.type = 'button';
      tile.disabled = !st.unlocked;
      tile.setAttribute('aria-label', `${st.name}${st.unlocked ? '' : ', bloqueada'}`);

      const thumb = this.el('div', 'bw-stage-mini-media');
      const img = this.el('img');
      img.src = st.image; img.alt = ''; img.draggable = false;
      thumb.append(img);
      if (!st.unlocked) {
        const lockCenter = this.el('div', 'bw-center-lock sm');
        lockCenter.append(this.icon('lock', 'bw-ico bw-ico-lock-md'));
        thumb.append(lockCenter);
      }
      tile.append(thumb, this.el('span', 'bw-stage-mini-name', st.name));
      if (st.unlocked) this.bindAction(tile, () => opts.onPickStage(st.index));
      grid.append(tile);
    }

    sheet.append(head, grid);
    overlay.append(sheet);
    this.root?.append(overlay);
  }

  welcomeLoginModal(opts: WelcomeLoginOptions): void {
    const backdrop = this.el('div', 'bw-modal-overlay');
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', 'Política de Privacidade, LGPD e acesso opcional');

    const card = this.el('div', 'bw-modal-card bw-welcome-card');
    const emblem = this.el('div', 'bw-modal-emblem');
    emblem.append(this.icon('shield', 'bw-ico bw-ico-modal'));

    const header = this.el('div', 'bw-modal-head');
    header.append(
      emblem,
      this.el('p', 'bw-mobile-eyebrow', 'Primeiro acesso · LGPD'),
      this.el('h2', '', 'Bem-vindo a Bullet Wake'),
      this.el('p', 'bw-modal-desc', 'Antes de continuar, confirme nossa Política de Privacidade e LGPD. Seu progresso e preferências ficam salvos apenas localmente neste aparelho.'),
    );

    const policyBox = this.el('div', 'bw-policy-box');
    const policyToggle = this.el('button', 'bw-policy-toggle');
    policyToggle.type = 'button';
    policyToggle.setAttribute('aria-expanded', 'false');
    policyToggle.append(this.el('span', '', 'Ler Política de Privacidade e LGPD'), this.icon('chevron', 'bw-ico bw-ico-xs'));

    const policyBody = this.el('div', 'bw-policy-content');
    policyBody.hidden = true;
    for (const [title, body] of LGPD_SECTIONS) {
      const sec = this.el('div', 'bw-policy-sec');
      sec.append(this.el('strong', '', title), this.el('p', '', body));
      policyBody.append(sec);
    }
    policyToggle.addEventListener('click', () => {
      const nextOpen = policyBody.hidden;
      policyBody.hidden = !nextOpen;
      policyToggle.setAttribute('aria-expanded', String(nextOpen));
      policyToggle.classList.toggle('is-open', nextOpen);
    });
    policyBox.append(policyToggle, policyBody);

    const consentLabel = this.el('label', 'bw-consent-row');
    const checkbox = this.el('input', 'bw-consent-check');
    checkbox.type = 'checkbox';
    checkbox.checked = Boolean(opts.initialPrivacyAccepted);
    checkbox.setAttribute('aria-label', 'Aceito a Política de Privacidade e os termos da LGPD');
    consentLabel.append(
      checkbox,
      this.el('span', '', 'Li e aceito a Política de Privacidade e os termos da LGPD (Lei nº 13.709/2018).'),
    );

    const field = this.el('div', 'bw-field');
    const input = this.el('input', 'bw-input');
    input.type = 'text';
    input.maxLength = 24;
    input.placeholder = 'Seu codinome (opcional)';
    input.value = opts.defaultName ?? '';
    input.setAttribute('aria-label', 'Codinome do piloto');
    field.append(input);

    const actions = this.el('div', 'bw-dialog-actions');
    const loginBtn = this.el('button', 'bw-mobile-button primary');
    loginBtn.type = 'button';
    loginBtn.disabled = !checkbox.checked;
    loginBtn.append(this.icon('login', 'bw-ico bw-ico-btn'), this.el('span', '', 'Entrar'));
    this.bindAction(loginBtn, () => { if (checkbox.checked) opts.onLogin(input.value); });

    const guestBtn = this.el('button', 'bw-mobile-button secondary', 'Continuar como convidado');
    guestBtn.type = 'button';
    guestBtn.disabled = !checkbox.checked;
    this.bindAction(guestBtn, () => { if (checkbox.checked) opts.onGuest(); });

    checkbox.addEventListener('change', () => {
      const ok = checkbox.checked;
      loginBtn.disabled = !ok;
      guestBtn.disabled = !ok;
    });

    actions.append(loginBtn, guestBtn);
    card.append(header, policyBox, consentLabel, field, actions);
    backdrop.append(card);
    this.root?.append(backdrop);
  }

  privacyPolicyModal(opts: { acceptedAt: number | null; onClose: () => void }): void {
    const overlay = this.el('div', 'bw-modal-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Política de Privacidade e LGPD');

    const card = this.el('div', 'bw-modal-card bw-policy-modal');
    const head = this.el('div', 'bw-modal-head');
    const emblem = this.el('div', 'bw-modal-emblem');
    emblem.append(this.icon('shield', 'bw-ico bw-ico-modal'));
    head.append(
      emblem,
      this.el('p', 'bw-mobile-eyebrow', 'Botan Studio · LGPD'),
      this.el('h2', '', 'Política de Privacidade'),
    );
    if (opts.acceptedAt) {
      const dateStr = new Date(opts.acceptedAt).toLocaleDateString('pt-BR');
      head.append(this.el('p', 'bw-modal-desc', `Termos aceitos em ${dateStr} · Versão 1.0`));
    }

    const list = this.el('div', 'bw-policy-content static');
    for (const [title, body] of LGPD_SECTIONS) {
      const sec = this.el('div', 'bw-policy-sec');
      sec.append(this.el('strong', '', title), this.el('p', '', body));
      list.append(sec);
    }

    const actions = this.el('div', 'bw-dialog-actions');
    const closeBtn = this.el('button', 'bw-mobile-button primary', 'Fechar');
    closeBtn.type = 'button';
    this.bindAction(closeBtn, opts.onClose);
    actions.append(closeBtn);

    card.append(head, list, actions);
    overlay.append(card);
    this.root?.append(overlay);
  }

  confirmPurchaseModal(opts: ConfirmPurchaseOptions): void {
    const overlay = this.el('div', 'bw-modal-overlay bw-purchase-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', `Confirmar compra de ${opts.pilotName}`);

    const card = this.el('div', 'bw-modal-card');
    const preview = this.el('div', 'bw-purchase-preview');
    const pImg = this.el('img', 'bw-purchase-portrait'); pImg.src = opts.portraitImage; pImg.alt = opts.pilotName; pImg.draggable = false;
    const sImg = this.el('img', 'bw-purchase-ship'); sImg.src = opts.shipImage; sImg.alt = opts.shipName; sImg.draggable = false;
    preview.append(pImg, sImg);

    const head = this.el('div', 'bw-modal-head');
    head.append(
      preview,
      this.el('p', 'bw-mobile-eyebrow', 'Confirmação de desbloqueio'),
      this.el('h2', '', `Desbloquear ${opts.pilotName}?`),
      this.el('p', 'bw-modal-desc', `Nave ${opts.shipName} · Valor: ${opts.cost} CR\nSaldo atual: ${opts.currentCredits} CR · Após a compra: ${Math.max(0, opts.currentCredits - opts.cost)} CR`),
    );

    const actions = this.el('div', 'bw-dialog-actions');
    const okBtn = this.el('button', 'bw-mobile-button primary');
    okBtn.type = 'button';
    okBtn.append(this.icon('check', 'bw-ico bw-ico-btn'), this.el('span', '', `Confirmar compra (${opts.cost} CR)`));
    this.bindAction(okBtn, opts.onConfirm);

    const cancelBtn = this.el('button', 'bw-mobile-button back', 'Cancelar');
    cancelBtn.type = 'button';
    this.bindAction(cancelBtn, opts.onCancel);

    actions.append(okBtn, cancelBtn);
    card.append(head, actions);
    overlay.append(card);
    this.root?.append(overlay);
  }

  pilotShowcase(opts: PilotShowcaseOptions): void {
    const wrap = this.el('div', 'bw-pilot-layout');

    const pilotCard = this.el('section', 'bw-pilot-card');
    const pilotTop = this.el('div', 'bw-pilot-card-top');
    const avatar = this.el('div', `bw-pilot-avatar${opts.unlocked ? '' : ' is-locked'}`);
    const pImg = this.el('img'); pImg.src = opts.portraitImage; pImg.alt = opts.name; pImg.draggable = false;
    avatar.append(pImg);
    if (!opts.unlocked) {
      const lock = this.el('span', 'bw-lock-badge');
      lock.append(this.icon('lock', 'bw-ico bw-ico-lock'));
      avatar.append(lock);
    }

    const pilotInfo = this.el('div', 'bw-pilot-card-info');
    pilotInfo.append(
      this.el('h2', '', opts.name),
      this.el('p', 'bw-pilot-origin', `${opts.callsign} · ${opts.nationality}`),
      this.el('p', `bw-pilot-bio${opts.unlocked ? '' : ' locked'}`, opts.detail),
    );
    pilotTop.append(avatar, pilotInfo);

    const historyRow = this.el('div', 'bw-pilot-history');
    const statusText = opts.history.sorties > 0 ? `${opts.history.sorties} ${opts.history.sorties === 1 ? 'voo' : 'voos'}` : 'Estreante';
    const histItems: Array<[string, string]> = [
      ['Histórico', statusText],
      ['Abates', String(opts.history.kills)],
      ['Recorde', String(opts.history.bestScore)],
    ];
    for (const [k, v] of histItems) {
      const cell = this.el('div', 'bw-pilot-hist-cell');
      cell.append(this.el('span', '', k), this.el('strong', '', v));
      historyRow.append(cell);
    }
    pilotCard.append(pilotTop, historyRow);

    const shipCard = this.el('section', 'bw-ship-card');
    const shipTop = this.el('div', 'bw-ship-card-top');
    const shipBay = this.el('div', 'bw-pilot-ship-bay');
    const sImg = this.el('img'); sImg.src = opts.shipImage; sImg.alt = opts.shipName; sImg.draggable = false;
    shipBay.append(sImg);

    const shipInfo = this.el('div', 'bw-ship-meta');
    shipInfo.append(
      this.el('p', 'bw-ship-eyebrow', 'Aeronave'),
      this.el('h3', '', opts.shipName),
      this.el('p', 'bw-pilot-kit', `Arma: ${opts.weaponName}`),
      this.el('p', 'bw-pilot-special', `Esp: ${opts.specialName}`),
    );
    shipTop.append(shipBay, shipInfo);

    const bars = this.el('div', 'bw-stat-bars');
    const statList: Array<[string, number, 'cyan' | 'gold' | 'green']> = [
      ['Velocidade', opts.stats.speed, 'cyan'],
      ['Armamento', opts.stats.firepower, 'gold'],
      ['Blindagem', opts.stats.armor, 'green'],
    ];
    for (const [label, val, tone] of statList) {
      const row = this.el('div', 'bw-stat-row');
      row.setAttribute('aria-label', `${label}: ${val} de 5`);
      row.append(this.el('span', 'bw-stat-label', label));
      const track = this.el('div', 'bw-stat-track');
      for (let i = 1; i <= 5; i++) {
        track.append(this.el('span', `bw-stat-seg${i <= val ? ` filled ${tone}` : ''}`));
      }
      row.append(track);
      bars.append(row);
    }

    shipCard.append(shipTop, bars);
    wrap.append(pilotCard, shipCard);
    this.body?.append(wrap);
  }

  pilotStrip(items: PilotStripItem[]): void {
    const list = this.el('div', 'bw-mobile-pilots');
    for (const item of items) {
      const button = this.el('button', `${item.selected ? 'selected' : ''}${item.unlocked ? '' : ' is-locked'}`.trim());
      button.type = 'button';
      button.setAttribute('aria-pressed', String(item.selected));
      button.setAttribute('aria-label', `${item.name}${item.unlocked ? '' : `, bloqueado, ${item.cost} créditos`}`);
      const thumb = this.el('span', 'bw-pilot-thumb');
      const img = this.el('img'); img.src = item.image; img.alt = ''; img.draggable = false;
      thumb.append(img);
      if (!item.unlocked) {
        const lock = this.el('span', 'bw-lock-badge sm');
        lock.append(this.icon('lock', 'bw-ico bw-ico-lock'));
        thumb.append(lock);
      }
      const sub = this.el('small', item.unlocked ? 'is-ready' : 'is-price', item.unlocked ? (item.selected ? 'Ativo' : 'Pronto') : `${item.cost} CR`);
      button.append(thumb, this.el('span', 'bw-pilot-name', item.name), sub);
      this.bindAction(button, item.action);
      list.append(button);
    }
    this.body?.append(list);
  }

  accountCard(opts: AccountCardOptions): void {
    const card = this.el('section', 'bw-account-card');
    const head = this.el('div', 'bw-account-head');
    const img = this.el('img', 'bw-account-avatar');
    img.src = opts.avatarImage; img.alt = ''; img.draggable = false;
    const copy = this.el('div', 'bw-account-copy');
    const status = this.el('span', `bw-account-pill${opts.linked ? ' linked' : ''}`, opts.linked ? 'Conectado · Local' : 'Convidado · Local');
    copy.append(this.el('h2', '', opts.displayName), status);
    head.append(img, copy);

    const note = this.el('p', 'bw-mobile-copy hint', opts.linked
      ? 'Sessão local ativa neste dispositivo. A sincronização em nuvem será conectada em uma atualização futura.'
      : 'Você está jogando como convidado. Entre com um codinome local para preparar sua conta — sem perder seu progresso.');

    card.append(head, note);
    if (opts.linked) {
      const outBtn = this.el('button', 'bw-mobile-button back compact');
      outBtn.type = 'button';
      outBtn.append(this.icon('logout', 'bw-ico bw-ico-btn'), this.el('span', '', 'Sair da conta'));
      this.bindAction(outBtn, opts.onLogout);
      card.append(outBtn);
    } else {
      const form = this.el('div', 'bw-account-form');
      const input = this.el('input', 'bw-input');
      input.type = 'text';
      input.maxLength = 24;
      input.placeholder = 'Seu codinome';
      input.setAttribute('aria-label', 'Codinome para entrar');
      const inBtn = this.el('button', 'bw-mobile-button primary compact');
      inBtn.type = 'button';
      inBtn.append(this.icon('login', 'bw-ico bw-ico-btn'), this.el('span', '', 'Entrar na conta'));
      this.bindAction(inBtn, () => opts.onLogin(input.value));
      form.append(input, inBtn);
      card.append(form);
    }
    this.body?.append(card);
  }

  settingsGroup(title: string, build: () => void): void {
    const group = this.el('section', 'bw-settings-group');
    group.append(this.el('h2', 'bw-settings-group-title', title));
    const prev = this.container;
    this.container = group;
    build();
    this.container = prev;
    this.body?.append(group);
  }

  toggle(label: string, checked: boolean, action: () => void, hint?: string): void {
    const row = this.el('button', `bw-toggle-row${checked ? ' is-on' : ''}`);
    row.type = 'button';
    row.setAttribute('role', 'switch');
    row.setAttribute('aria-checked', String(checked));
    const copy = this.el('span', 'bw-toggle-copy');
    copy.append(this.el('strong', '', label));
    if (hint) copy.append(this.el('small', '', hint));
    const track = this.el('span', 'bw-switch-track');
    track.setAttribute('aria-hidden', 'true');
    track.append(this.el('span', 'bw-switch-thumb'));
    row.append(copy, track);
    this.bindAction(row, action);
    this.target()?.append(row);
  }

  segmented(label: string, options: { label: string; active: boolean; disabled?: boolean; locked?: boolean; action: () => void }[], hint?: string): void {
    const wrap = this.el('div', 'bw-segmented-wrap');
    const head = this.el('div', 'bw-segmented-head');
    head.append(this.el('span', 'bw-segmented-label', label));
    if (hint) head.append(this.el('small', 'bw-segmented-hint', hint));
    const row = this.el('div', 'bw-segmented');
    for (const opt of options) {
      const btn = this.el('button', `${opt.active ? 'active' : ''}${opt.locked ? ' is-locked' : ''}`.trim());
      btn.type = 'button';
      btn.disabled = !!opt.disabled;
      btn.setAttribute('aria-pressed', String(opt.active));
      if (opt.locked) btn.append(this.icon('lock', 'bw-ico bw-ico-xs'));
      btn.append(this.el('span', '', opt.label));
      this.bindAction(btn, opt.action);
      row.append(btn);
    }
    wrap.append(head, row);
    this.target()?.append(wrap);
  }

  actionRow(label: string, detail: string, action: () => void): void {
    const btn = this.el('button', 'bw-action-row');
    btn.type = 'button';
    const copy = this.el('span', 'bw-toggle-copy');
    copy.append(this.el('strong', '', label), this.el('small', '', detail));
    btn.append(copy, this.icon('chevron', 'bw-ico bw-ico-chevron'));
    this.bindAction(btn, action);
    this.target()?.append(btn);
  }

  dialogActions(build: () => void): void {
    const wrap = this.el('div', 'bw-dialog-actions');
    const prev = this.container;
    this.container = wrap;
    build();
    this.container = prev;
    this.body?.append(wrap);
  }

  /** Show the press before navigating, with one confirmation per gesture. Scrolling cancels it. */
  private bindAction(button: HTMLButtonElement, action: () => void): void {
    let down: { x: number; y: number } | undefined;
    let cancelled = false;
    const release = () => { down = undefined; button.classList.remove('is-pressed'); };
    button.addEventListener('pointerdown', e => {
      if (button.disabled || e.button !== 0) return;
      cancelled = false; down = { x: e.clientX, y: e.clientY }; button.classList.add('is-pressed');
    });
    button.addEventListener('pointermove', e => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) { cancelled = true; release(); }
    });
    button.addEventListener('pointercancel', () => { cancelled = true; release(); });
    button.addEventListener('pointerleave', release);
    button.addEventListener('pointerup', release);
    button.addEventListener('click', e => {
      if (e.detail === 0) cancelled = false;
      if (cancelled || button.disabled || this.activationTimer !== undefined) return;
      button.classList.add('is-confirmed');
      this.onConfirm?.(); window.BulletWakeAndroid?.menuFeedback?.();
      this.activationTimer = window.setTimeout(() => {
        this.activationTimer = undefined; button.classList.remove('is-confirmed');
        if (button.isConnected) action();
      }, 90);
    });
  }

  /** Controller navigation follows the topmost active modal (if present) or visible DOM order. */
  navigate(direction: -1 | 0 | 1, confirm = false, horizontal = false): void {
    const modals = this.root?.querySelectorAll<HTMLElement>('.bw-modal-overlay');
    const scope = modals && modals.length ? modals[modals.length - 1] : this.root;
    const items = [...scope?.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button:not(:disabled),input:not(:disabled)') ?? []];
    if (!items.length) return;
    let index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) index = 0;
    else if (direction && !(horizontal && items[index] instanceof HTMLInputElement && items[index].type === 'range')) index = (index + direction + items.length) % items.length;
    const item = items[index]; item.focus({ preventScroll: true }); item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (horizontal && direction && item instanceof HTMLInputElement && item.type === 'range') {
      item.value = String(Math.min(1, Math.max(0, Number(item.value) + direction * .1)));
      item.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (confirm) {
      if (item instanceof HTMLButtonElement) item.click();
      else if (item instanceof HTMLInputElement && item.type === 'checkbox') { item.checked = !item.checked; item.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  }

  button(label: string, action: () => void, opts: { style?: ActionStyle; disabled?: boolean; footer?: boolean; compact?: boolean; icon?: IconName } = {}): HTMLButtonElement {
    const button = this.el('button', `bw-mobile-button ${opts.style ?? 'secondary'} ${opts.compact ? 'compact' : ''}`);
    button.type = 'button'; button.disabled = !!opts.disabled;
    if (opts.icon) {
      button.append(this.icon(opts.icon, 'bw-ico bw-ico-btn'), this.el('span', '', label));
    } else {
      button.textContent = label;
    }
    this.bindAction(button, action);
    (opts.footer ? this.footer : this.target())?.append(button);
    return button;
  }

  tabs(items: { label: string; active: boolean; action: () => void }[]): void {
    const row = this.el('nav', 'bw-mobile-tabs');
    for (const item of items) {
      const button = this.el('button', item.active ? 'active' : '', item.label);
      button.type = 'button'; button.setAttribute('aria-pressed', String(item.active));
      this.bindAction(button, item.action); row.append(button);
    }
    this.target()?.append(row);
  }

  setDisabled(label: string, disabled: boolean): void {
    const button = [...this.root?.querySelectorAll('button') ?? []].find(button => button.textContent?.trim() === label);
    if (button) button.disabled = disabled;
  }

  metrics(items: [string, string | number][]): void {
    const grid = this.el('dl', 'bw-mobile-metrics');
    for (const [label, value] of items) {
      const cell = this.el('div'); cell.append(this.el('dt', '', label), this.el('dd', '', String(value))); grid.append(cell);
    }
    this.target()?.append(grid);
  }

  portrait(image: string, name: string, subtitle: string): void {
    const hero = this.el('div', 'bw-mobile-pilot'); const img = this.el('img');
    img.src = image; img.alt = name;
    const caption = this.el('div'); caption.append(this.el('h2', '', name), this.el('p', '', subtitle));
    hero.append(img, caption); this.target()?.append(hero);
  }

  card(title: string, detail: string, opts: { image?: string; badge?: string; action?: () => void; label?: string; disabled?: boolean } = {}): void {
    const card = this.el('article', 'bw-mobile-card');
    if (opts.image) { const img = this.el('img', 'bw-mobile-route-art'); img.src = opts.image; img.alt = ''; card.append(img); }
    const content = this.el('div', 'bw-mobile-card-content');
    if (opts.badge) content.append(this.el('p', 'bw-mobile-eyebrow', opts.badge));
    content.append(this.el('h2', '', title), this.el('p', '', detail));
    if (opts.action) {
      const button = this.el('button', 'bw-mobile-button primary', opts.label ?? 'Selecionar');
      button.type = 'button'; button.disabled = !!opts.disabled; this.bindAction(button, opts.action); content.append(button);
    }
    card.append(content); this.target()?.append(card);
  }

  setting(label: string, value: string, previous: () => void, next: () => void): void {
    const row = this.el('div', 'bw-mobile-setting');
    const copy = this.el('div'); copy.append(this.el('span', '', label), this.el('strong', '', value));
    const controls = this.el('div');
    for (const [symbol, action, direction] of [['−', previous, 'Diminuir'], ['+', next, 'Aumentar']] as const) {
      const button = this.el('button', '', symbol); button.type = 'button'; button.setAttribute('aria-label', `${direction} ${label}`);
      this.bindAction(button, action); controls.append(button);
    }
    row.append(copy, controls); this.target()?.append(row);
  }

  volume(label: string, value: number, change: (value: number) => void): void {
    const row = this.el('label', 'bw-mobile-volume'); const caption = this.el('span', '', label);
    const output = this.el('strong', '', `${Math.round(value * 100)}%`);
    const input = this.el('input'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '0.1'; input.value = String(value);
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => { change(Number(input.value)); output.textContent = `${Math.round(Number(input.value) * 100)}%`; });
    row.append(caption, output, input); this.target()?.append(row);
  }

  /** Cache a sprite frame at its authored resolution, with optional hull livery tint. */
  frame(key: string, source: CanvasImageSource, x: number, y: number, width: number, height: number, tintHex?: number): string {
    const cacheKey = tintHex && tintHex !== 0xffffff ? `${key}:#${tintHex.toString(16)}` : key;
    const cached = this.images.get(cacheKey); if (cached) return cached;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
    if (tintHex && tintHex !== 0xffffff) {
      const hex = `#${tintHex.toString(16).padStart(6, '0')}`;
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(source, x, y, width, height, 0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    }
    const image = canvas.toDataURL('image/png'); this.images.set(cacheKey, image); return image;
  }
}
