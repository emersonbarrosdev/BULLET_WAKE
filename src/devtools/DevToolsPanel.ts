import type { ArcadeScene } from '../game/arcade/ArcadeScene';
import { DevAnimationPreviewer, type DevAssetCategory } from './DevAnimationPreviewer';
import { DevCollisionOverlay } from './DevCollisionOverlay';
import { BOSS_RESISTANCE_PRESETS, DevCombatControls } from './DevCombatControls';
import { DevPerformanceMonitor } from './DevPerformanceMonitor';
import { DevScenarioRegistry } from './DevScenarioRegistry';
import { DevScenarioRunner } from './DevScenarioRunner';
import { DevStateManager } from './DevStateManager';
import type { DevEnemySpawnConfig, DevPanelTab, DevPerfReport } from './types';

const STYLE_ID = 'bw-devtools-style';

const PANEL_CSS = `
.bw-dev-toggle {
  position: fixed; left: 10px; bottom: 10px; z-index: 99998;
  background: linear-gradient(135deg, #0f172a, #1e293b);
  color: #38bdf8; border: 1px solid #38bdf8; border-radius: 6px;
  padding: 5px 10px; font: 700 11px/1.2 "Oxanium", system-ui, sans-serif;
  letter-spacing: 0.08em; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,0.55);
  user-select: none;
}
.bw-dev-toggle:hover { background: #1e293b; color: #f8fafc; }
.bw-dev-panel {
  position: fixed; z-index: 99999; width: 470px; max-width: calc(100vw - 16px);
  max-height: calc(100vh - 24px); display: flex; flex-direction: column;
  background: rgba(11, 18, 32, 0.96); color: #e2e8f0;
  border: 1px solid #334155; border-radius: 8px;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.72);
  font: 500 12px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  backdrop-filter: blur(8px);
}
.bw-dev-panel.is-hidden { display: none; }
.bw-dev-panel.is-minimized .bw-dev-tabs,
.bw-dev-panel.is-minimized .bw-dev-body,
.bw-dev-panel.is-minimized .bw-dev-status { display: none; }
.bw-dev-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 10px; background: #0f172a; border-bottom: 1px solid #1e293b;
  border-radius: 8px 8px 0 0; cursor: move; user-select: none; gap: 6px;
}
.bw-dev-title { font: 800 11px/1 "Oxanium", system-ui, sans-serif; color: #38bdf8; letter-spacing: 0.06em; }
.bw-dev-badge {
  font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  background: rgba(245, 158, 11, 0.16); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35);
}
.bw-dev-hbtns { display: flex; gap: 4px; }
.bw-dev-hbtn {
  background: #1e293b; color: #cbd5e1; border: 1px solid #334155; border-radius: 4px;
  padding: 2px 7px; font-size: 11px; cursor: pointer;
}
.bw-dev-hbtn:hover { background: #334155; color: #fff; }
.bw-dev-tabs {
  display: flex; flex-wrap: wrap; gap: 3px; padding: 6px 8px;
  background: #0d1526; border-bottom: 1px solid #1e293b;
}
.bw-dev-tab {
  background: #162033; color: #94a3b8; border: 1px solid #263449; border-radius: 4px;
  padding: 4px 7px; font-size: 10px; font-weight: 700; cursor: pointer; letter-spacing: 0.03em;
}
.bw-dev-tab.active { background: #0284c7; color: #fff; border-color: #38bdf8; }
.bw-dev-body {
  padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 9px;
}
.bw-dev-sec {
  background: #131d31; border: 1px solid #22304a; border-radius: 6px; padding: 8px;
  display: flex; flex-direction: column; gap: 7px;
}
.bw-dev-sec > summary {
  cursor: pointer; font-size: 11px; font-weight: 700; color: #7dd3fc;
  letter-spacing: 0.04em; text-transform: uppercase; user-select: none;
}
.bw-dev-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.bw-dev-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
.bw-dev-field { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 110px; }
.bw-dev-field label { font-size: 10px; color: #94a3b8; font-weight: 600; }
.bw-dev-input, .bw-dev-select {
  background: #0b1322; color: #f8fafc; border: 1px solid #334155; border-radius: 4px;
  padding: 4px 6px; font-size: 11px; width: 100%; box-sizing: border-box;
}
.bw-dev-input:invalid { border-color: #f43f5e; }
.bw-dev-btn {
  background: #1e293b; color: #e2e8f0; border: 1px solid #3b4b66; border-radius: 4px;
  padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer;
}
.bw-dev-btn:hover { background: #334155; }
.bw-dev-btn.primary { background: #0284c7; border-color: #38bdf8; color: #fff; }
.bw-dev-btn.primary:hover { background: #0369a1; }
.bw-dev-btn.danger { background: #7f1d1d; border-color: #ef4444; color: #fecaca; }
.bw-dev-btn.warn { background: #78350f; border-color: #f59e0b; color: #fde68a; }
.bw-dev-chk { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #cbd5e1; cursor: pointer; }
.bw-dev-pre {
  background: #09101d; border: 1px solid #1e293b; border-radius: 4px; padding: 6px;
  font: 500 10.5px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; color: #bae6fd;
  margin: 0; white-space: pre-wrap; max-height: 150px; overflow-y: auto;
}
.bw-dev-status {
  padding: 5px 10px; background: #0a101d; border-top: 1px solid #1e293b;
  border-radius: 0 0 8px 8px; font-size: 10.5px; color: #38bdf8;
  display: flex; justify-content: space-between; gap: 8px;
}
.bw-dev-canvas {
  width: 100%; height: 150px; border: 1px solid #334155; border-radius: 4px; background: #0f172a;
}
`;

export interface DevToolsDeps {
  game: Phaser.Game;
  getScene: () => ArcadeScene | undefined;
  state: DevStateManager;
  registry: DevScenarioRegistry;
  runner: DevScenarioRunner;
  combat: DevCombatControls;
  collisions: DevCollisionOverlay;
  perf: DevPerformanceMonitor;
  previewer: DevAnimationPreviewer;
}

const TABS: { id: DevPanelTab; label: string }[] = [
  { id: 'stages', label: 'FASES' },
  { id: 'bosses', label: 'BOSSES' },
  { id: 'enemies', label: 'INIMIGOS' },
  { id: 'player', label: 'JOGADOR / ARMAS' },
  { id: 'collisions', label: 'COLISÕES' },
  { id: 'events', label: 'EVENTOS' },
  { id: 'performance', label: 'DESEMPENHO' },
  { id: 'visual', label: 'VISUAL' },
];

export class DevToolsPanel {
  private readonly deps: DevToolsDeps;
  private root: HTMLDivElement;
  private toggleBtn: HTMLButtonElement;
  private bodyEl: HTMLDivElement;
  private tabsEl: HTMLDivElement;
  private statusEl: HTMLSpanElement;
  private seedEl!: HTMLInputElement;
  private tabButtons = new Map<DevPanelTab, HTMLButtonElement>();
  private selectedMissionIdx = 0;
  private bossTelemetryEl?: HTMLPreElement;
  private bossVerifyEl?: HTMLPreElement;
  private eventDirectorEl?: HTMLPreElement;
  private perfLiveEl?: HTMLPreElement;
  private perfReportEl?: HTMLPreElement;
  private lastPerfReport?: DevPerfReport;
  private animCanvas?: HTMLCanvasElement;
  private animMetaEl?: HTMLPreElement;
  private animFrameLabel?: HTMLSpanElement;
  private animLastFrameAt = performance.now();

  constructor(deps: DevToolsDeps) {
    this.deps = deps;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = PANEL_CSS;
      document.head.appendChild(style);
    }

    const prefs = this.deps.state.getPrefs();
    this.toggleBtn = document.createElement('button');
    this.toggleBtn.type = 'button';
    this.toggleBtn.className = 'bw-dev-toggle';
    this.toggleBtn.textContent = 'DEV';
    this.toggleBtn.title = 'BULLET WAKE — DEVTOOLS (F9)';
    this.toggleBtn.setAttribute('data-bw-devtools-toggle', 'true');
    this.toggleBtn.addEventListener('click', () => this.toggleOpen());

    this.root = document.createElement('div');
    this.root.className = 'bw-dev-panel';
    this.root.tabIndex = -1;
    this.root.setAttribute('data-bw-devtools-panel', 'true');
    this.root.style.left = `${prefs.x}px`;
    this.root.style.top = `${prefs.y}px`;
    if (!prefs.open) this.root.classList.add('is-hidden');
    if (prefs.minimized) this.root.classList.add('is-minimized');

    // Header (draggable)
    const header = document.createElement('div');
    header.className = 'bw-dev-header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'bw-dev-row';
    const title = document.createElement('span');
    title.className = 'bw-dev-title';
    title.textContent = 'BULLET WAKE — DEVTOOLS';
    const badge = document.createElement('span');
    badge.className = 'bw-dev-badge';
    badge.textContent = 'DEV • SAVE ISOLADO';
    titleWrap.append(title, badge);

    const hbtns = document.createElement('div');
    hbtns.className = 'bw-dev-hbtns';
    const minBtn = document.createElement('button');
    minBtn.type = 'button';
    minBtn.className = 'bw-dev-hbtn';
    minBtn.textContent = '—';
    minBtn.title = 'Minimizar';
    minBtn.addEventListener('click', () => this.setMinimized(!this.deps.state.getPrefs().minimized));
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'bw-dev-hbtn';
    closeBtn.textContent = '×';
    closeBtn.title = 'Fechar (F9)';
    closeBtn.addEventListener('click', () => this.setOpen(false));
    hbtns.append(minBtn, closeBtn);
    header.append(titleWrap, hbtns);
    this.installDrag(header);

    // Tab strip
    this.tabsEl = document.createElement('div');
    this.tabsEl.className = 'bw-dev-tabs';
    for (const tab of TABS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bw-dev-tab';
      b.textContent = tab.label;
      b.dataset.tab = tab.id;
      b.addEventListener('click', () => this.setActiveTab(tab.id));
      this.tabButtons.set(tab.id, b);
      this.tabsEl.appendChild(b);
    }

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'bw-dev-body';

    const statusBar = document.createElement('div');
    statusBar.className = 'bw-dev-status';
    this.statusEl = document.createElement('span');
    this.statusEl.textContent = 'Pronto (F9 abre/fecha).';
    const seedWrap = document.createElement('label');
    seedWrap.className = 'bw-dev-row';
    seedWrap.style.fontSize = '10px';
    seedWrap.style.color = '#94a3b8';
    seedWrap.textContent = 'Seed:';
    this.seedEl = document.createElement('input');
    this.seedEl.type = 'number';
    this.seedEl.className = 'bw-dev-input';
    this.seedEl.style.width = '68px';
    this.seedEl.style.padding = '1px 4px';
    this.seedEl.value = String(prefs.seed);
    this.seedEl.addEventListener('change', () => {
      const v = Math.floor(Number(this.seedEl.value) || 1337);
      this.seedEl.value = String(v);
      this.deps.state.updatePrefs({ seed: v });
    });
    seedWrap.appendChild(this.seedEl);
    statusBar.append(this.statusEl, seedWrap);

    this.root.append(header, this.tabsEl, this.bodyEl, statusBar);
    document.body.append(this.toggleBtn, this.root);

    this.renderActiveTab();
  }

  private installDrag(handle: HTMLElement): void {
    let dragging = false;
    let ox = 0;
    let oy = 0;
    handle.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      dragging = true;
      ox = e.clientX - this.root.offsetLeft;
      oy = e.clientY - this.root.offsetTop;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const nx = Math.max(4, Math.min(window.innerWidth - 120, e.clientX - ox));
      const ny = Math.max(4, Math.min(window.innerHeight - 40, e.clientY - oy));
      this.root.style.left = `${nx}px`;
      this.root.style.top = `${ny}px`;
      this.deps.state.updatePrefs({ x: nx, y: ny });
    });
    handle.addEventListener('pointerup', () => {
      dragging = false;
    });
  }

  setStatus(msg: string): void {
    this.statusEl.textContent = msg;
  }

  isOpen(): boolean {
    return this.deps.state.getPrefs().open;
  }

  isFocused(): boolean {
    const active = document.activeElement;
    return this.isOpen() && !!active && this.root.contains(active);
  }

  setOpen(open: boolean): void {
    this.deps.state.updatePrefs({ open });
    this.root.classList.toggle('is-hidden', !open);
    if (open) {
      this.root.focus();
      this.renderActiveTab();
    }
  }

  toggleOpen(): void {
    this.setOpen(!this.isOpen());
  }

  setMinimized(minimized: boolean): void {
    this.deps.state.updatePrefs({ minimized });
    this.root.classList.toggle('is-minimized', minimized);
  }

  setActiveTab(tab: DevPanelTab): void {
    this.deps.state.updatePrefs({ activeTab: tab, minimized: false });
    this.root.classList.remove('is-minimized');
    this.renderActiveTab();
  }

  getActiveTab(): DevPanelTab {
    return this.deps.state.getPrefs().activeTab;
  }

  private btn(label: string, onClick: () => void, variant?: 'primary' | 'danger' | 'warn'): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `bw-dev-btn${variant ? ' ' + variant : ''}`;
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  private section(title: string, open = true): { details: HTMLDetailsElement; add: (...nodes: HTMLElement[]) => void } {
    const details = document.createElement('details');
    details.className = 'bw-dev-sec';
    details.open = open;
    const sum = document.createElement('summary');
    sum.textContent = title;
    details.appendChild(sum);
    return {
      details,
      add: (...nodes) => details.append(...nodes),
    };
  }

  private row(...nodes: HTMLElement[]): HTMLDivElement {
    const d = document.createElement('div');
    d.className = 'bw-dev-row';
    d.append(...nodes);
    return d;
  }

  private field(labelText: string, inputEl: HTMLElement): HTMLDivElement {
    const d = document.createElement('div');
    d.className = 'bw-dev-field';
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    d.append(lbl, inputEl);
    return d;
  }

  private select(options: Array<{ value: string; label: string }>, current: string, onChange: (val: string) => void): HTMLSelectElement {
    const s = document.createElement('select');
    s.className = 'bw-dev-select';
    for (const opt of options) {
      const o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      if (opt.value === current) o.selected = true;
      s.appendChild(o);
    }
    s.addEventListener('change', () => onChange(s.value));
    return s;
  }

  private numInput(val: number, min: number, max: number, step = 1): HTMLInputElement {
    const i = document.createElement('input');
    i.type = 'number';
    i.className = 'bw-dev-input';
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.value = String(val);
    i.addEventListener('change', () => {
      const n = Number(i.value);
      if (!Number.isFinite(n)) i.value = String(val);
      else i.value = String(Math.max(min, Math.min(max, n)));
    });
    return i;
  }

  private requireScene(): ArcadeScene | undefined {
    const sc = this.deps.getScene();
    if (!sc) this.setStatus('ArcadeScene ainda não inicializada.');
    return sc;
  }

  renderActiveTab(): void {
    const active = this.deps.state.getPrefs().activeTab;
    for (const [id, b] of this.tabButtons) b.classList.toggle('active', id === active);
    this.bodyEl.innerHTML = '';
    this.bossTelemetryEl = undefined;
    this.bossVerifyEl = undefined;
    this.eventDirectorEl = undefined;
    this.perfLiveEl = undefined;
    this.animCanvas = undefined;
    this.animMetaEl = undefined;

    switch (active) {
      case 'stages':
        this.renderStagesTab();
        break;
      case 'bosses':
        this.renderBossesTab();
        break;
      case 'enemies':
        this.renderEnemiesTab();
        break;
      case 'player':
        this.renderPlayerTab();
        break;
      case 'collisions':
        this.renderCollisionsTab();
        break;
      case 'events':
        this.renderEventsTab();
        break;
      case 'performance':
        this.renderPerformanceTab();
        break;
      case 'visual':
        this.renderVisualTab();
        break;
    }
  }

  private renderStagesTab(): void {
    const adapters = this.deps.registry.getAdapters();
    if (this.selectedMissionIdx >= adapters.length) this.selectedMissionIdx = 0;
    const adapter = adapters[this.selectedMissionIdx];

    const stageSel = this.select(
      adapters.map((a) => ({ value: String(a.missionIndex), label: `${a.stageId}. ${a.name} (${a.perspective})` })),
      String(this.selectedMissionIdx),
      (val) => {
        this.selectedMissionIdx = Number(val) || 0;
        this.renderActiveTab();
      },
    );

    const cpSelect = this.select(
      adapter.checkpoints.map((c) => ({ value: c.id, label: `${c.atSeconds}s — ${c.label}` })),
      adapter.checkpoints[0]?.id ?? '',
      () => {},
    );

    const hasMiniboss = adapter.bosses.some((b) => b.mini);
    const s1 = this.section('Fases Jogáveis & Checkpoints');
    s1.add(
      this.field('Fase (registrada em MISSIONS)', stageSel),
      this.row(
        this.btn('Iniciar do Começo', () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.runner.runScenarioById(sc, adapter.checkpoints[0].id);
          this.setStatus(`${adapter.name} iniciada do começo.`);
        }, 'primary'),
        this.btn(hasMiniboss ? 'Ir para Miniboss' : 'Ir para Arco das Marés', () => {
          const sc = this.requireScene();
          if (!sc) return;
          if (hasMiniboss) {
            this.deps.runner.runBoss(sc, adapter.missionIndex, true);
            this.setStatus(`Miniboss de ${adapter.name} iniciado.`);
          } else {
            sc.devJumpTideArch('approach');
            this.setStatus(`Arco das Marés iniciado.`);
          }
        }),
        this.btn('Ir para Boss Final', () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.runner.runBoss(sc, adapter.missionIndex, false);
          this.setStatus(`Boss Final de ${adapter.name} iniciado.`);
        }, 'warn'),
      ),
      this.field('Trecho / Checkpoint real', cpSelect),
      this.row(
        this.btn('Carregar Checkpoint', () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.runner.runScenarioById(sc, cpSelect.value);
          this.setStatus(`Checkpoint carregado.`);
        }, 'primary'),
        this.btn('Reiniciar Trecho Atual', () => {
          const sc = this.requireScene();
          if (!sc) return;
          if (!this.deps.state.replayLast(sc)) {
            this.deps.runner.runScenarioById(sc, cpSelect.value);
          }
          this.setStatus(`Trecho reiniciado.`);
        }),
        this.btn('Reiniciar Fase Completa', () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.runner.runScenarioById(sc, adapter.checkpoints[0].id);
          this.setStatus(`${adapter.name} reiniciada do 0s.`);
        }),
        this.btn('Voltar ao Menu', () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.state.endTestSession(sc);
          this.deps.collisions.clear();
          sc.devExitToMenu();
          this.setStatus('Sessão dev encerrada. Save intacto.');
        }, 'danger'),
      ),
    );

    const s2 = this.section('Atalhos Rápidos de Checkpoints');
    const cpGrid = document.createElement('div');
    cpGrid.className = 'bw-dev-grid';
    for (const cp of adapter.checkpoints) {
      cpGrid.appendChild(
        this.btn(`${cp.atSeconds}s • ${cp.label}`, () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.runner.runScenarioById(sc, cp.id);
          this.setStatus(`${adapter.name}: ${cp.label} (${cp.atSeconds}s)`);
        }),
      );
    }
    s2.add(cpGrid);
    if (adapter.perspective === 'UP') {
      const s3 = this.section('Arco das Marés — Etapas & Checkpoint');
      const archGrid = document.createElement('div');
      archGrid.className = 'bw-dev-grid';
      for (const [stage, lbl] of [
        ['approach', '1. Aproximação'],
        ['descent', '2. Descida Auto'],
        ['low-flight', '3. Voo Baixo'],
        ['under-arch', '4. Sob o Arco'],
        ['ascent', '5. Subida Auto'],
        ['checkpoint', '6. Checkpoint'],
      ] as const) {
        archGrid.append(
          this.btn(lbl, () => {
            const sc = this.requireScene();
            if (!sc) return;
            sc.devJumpTideArch(stage);
            this.setStatus(`Arco das Marés: ${lbl}`);
          }),
        );
      }
      s3.add(archGrid);
      this.bodyEl.append(s1.details, s2.details, s3.details);
    } else {
      this.bodyEl.append(s1.details, s2.details);
    }
  }

  private renderBossesTab(): void {
    const adapters = this.deps.registry.getAdapters();
    if (this.selectedMissionIdx >= adapters.length) this.selectedMissionIdx = 0;
    const adapter = adapters[this.selectedMissionIdx];

    const stageSel = this.select(
      adapters.map((a) => ({ value: String(a.missionIndex), label: `${a.name} (${a.perspective})` })),
      String(this.selectedMissionIdx),
      (v) => {
        this.selectedMissionIdx = Number(v) || 0;
        this.renderActiveTab();
      },
    );
    const bossSel = this.select(
      adapter.bosses.map((b) => ({ value: b.id, label: `${b.mini ? '[Miniboss]' : '[Boss Final]'} ${b.name}` })),
      adapter.bosses[1]?.id ?? adapter.bosses[0]?.id ?? '',
      () => this.renderActiveTab(),
    );
    // Preserve boss selection via data attribute on parent if needed; keep clear section selector:
    const finalBoss = adapter.bosses.find((b) => !b.mini) ?? adapter.bosses[0];
    const secSel = this.select(
      finalBoss.sections.map((s) => ({ value: String(s.index), label: s.name })),
      '0',
      () => {},
    );
    const diffSel = this.select(
      [
        { value: 'normal', label: 'Normal' },
        { value: 'hard', label: 'Difícil' },
      ],
      'normal',
      () => {},
    );
    const lvlIn = this.numInput(5, 1, 5);
    const livesIn = this.numInput(3, 1, 5);
    const espIn = this.numInput(3, 0, 5);
    const invChk = document.createElement('input');
    invChk.type = 'checkbox';

    const invLbl = document.createElement('label');
    invLbl.className = 'bw-dev-chk';
    invLbl.append(invChk, document.createTextNode('Invencibilidade Debug (apenas RIVET)'));

    const readOpts = () => ({
      difficulty: diffSel.value as 'normal' | 'hard',
      weaponLevel: Number(lvlIn.value),
      lives: Number(livesIn.value),
      specialCharges: Number(espIn.value),
      invincible: invChk.checked,
    });

    const miniBoss = adapter.bosses.find((b) => b.mini);
    const s1 = this.section('Seleção de Boss & Seções Reais');
    const bossRowBtns: HTMLElement[] = [];
    if (miniBoss) {
      bossRowBtns.push(
        this.btn(`Miniboss (${miniBoss.name})`, () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.runner.runBoss(sc, adapter.missionIndex, true, readOpts());
          this.setStatus(`Miniboss de ${adapter.name} iniciado.`);
        }),
      );
    } else {
      bossRowBtns.push(
        this.btn('Arco das Marés (Meio da Fase)', () => {
          const sc = this.requireScene();
          if (!sc) return;
          sc.devJumpTideArch('approach');
          this.setStatus(`Arco das Marés iniciado (substitui Miniboss).`);
        }),
      );
    }
    bossRowBtns.push(
      this.btn(`Boss Final (${finalBoss.name})`, () => {
        const sc = this.requireScene();
        if (!sc) return;
        this.deps.runner.runBoss(sc, adapter.missionIndex, false, readOpts());
        this.setStatus(`Boss Final ${finalBoss.name} iniciado.`);
      }, 'primary'),
    );
    s1.add(
      this.row(this.field('Fase', stageSel), this.field('Dificuldade', diffSel)),
      this.row(...bossRowBtns),
      this.row(this.field('Arma NV', lvlIn), this.field('Vidas', livesIn), this.field('Especiais', espIn)),
      invLbl,
    );

    if (finalBoss.sections.length > 1) {
      s1.add(
        this.field('Seção do Chefe (estados reais implementados)', secSel),
        this.row(
          this.btn('Ir para Seção Selecionada', () => {
            const sc = this.requireScene();
            if (!sc) return;
            this.deps.runner.runBoss(sc, adapter.missionIndex, false, {
              ...readOpts(),
              subSectionIndex: Number(secSel.value),
            });
            this.setStatus(`${finalBoss.name} — Seção ${Number(secSel.value) + 1} carregada.`);
          }, 'warn'),
          this.btn('Testar Colapso/Destruição', () => {
            const sc = this.requireScene();
            if (!sc) return;
            this.deps.runner.runBoss(sc, adapter.missionIndex, false, { ...readOpts(), subSectionIndex: finalBoss.sections.length - 1 });
            if (sc.world?.boss?.sub) {
              const sec = sc.world.boss.sub.sections[sc.world.boss.sub.activeSection];
              sec.hullHp = 1;
              for (const p of sec.parts) p.hp = 0;
            }
            this.setStatus('Seção final com 1 HP de casco pronta para colapso!');
          }),
        ),
      );
    }

    s1.add(
      this.row(
        this.btn('Reiniciar Combate', () => {
          const sc = this.requireScene();
          if (!sc) return;
          if (!this.deps.state.replayLast(sc)) {
            this.deps.runner.runBoss(sc, adapter.missionIndex, false, readOpts());
          }
          this.setStatus('Combate do boss reiniciado.');
        }),
        this.btn('Restaurar Vida & Componentes', () => {
          const sc = this.requireScene();
          if (!sc?.world?.boss) return;
          sc.world.devRestoreBossParts();
          this.setStatus('HP e componentes restaurados.');
        }),
        this.btn('Forçar Vitória do Boss', () => {
          const sc = this.requireScene();
          if (!sc?.world?.boss) return;
          const b = sc.world.boss;
          if (b.sub) {
            b.sub.activeSection = b.sub.sections.length - 1;
            const sec = b.sub.sections[b.sub.activeSection];
            sec.hullHp = 0;
            for (const p of sec.parts) p.hp = 0;
          } else {
            b.configuration = sc.world.up ? 2 : 1;
            for (const p of b.parts) p.hp = 0;
          }
          this.setStatus('Transição de destruição acionada.');
        }, 'danger'),
      ),
    );

    const s2 = this.section('Presets de Resistência & Verificação Automática');
    const presetRow = this.row();
    for (const p of BOSS_RESISTANCE_PRESETS) {
      presetRow.appendChild(
        this.btn(p.label, () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.runner.runBoss(sc, adapter.missionIndex, false, { ...readOpts(), ...p.options });
          this.setStatus(`Preset '${p.label}' iniciado em ${finalBoss.name}.`);
        }),
      );
    }
    this.bossVerifyEl = document.createElement('pre');
    this.bossVerifyEl.className = 'bw-dev-pre';
    this.bossVerifyEl.textContent = 'Clique abaixo para simular e auditar todas as etapas do boss.';
    s2.add(
      presetRow,
      this.btn('Auditar Progressão Completa do Boss', () => {
        const rep = this.deps.runner.verifyBossProgression(adapter.missionIndex);
        if (this.bossVerifyEl) {
          this.bossVerifyEl.textContent =
            `${rep.bossName} (${rep.missionName}) => ${rep.passed ? 'APROVADO' : 'FALHOU'}\n` +
            `Etapas cumpridas: ${rep.stepsCompleted.join(' -> ')}\n` +
            `Ignoradas: ${rep.skippedSteps.length ? rep.skippedSteps.join(', ') : 'nenhuma'} (${rep.elapsedSeconds}s sim)`;
        }
        this.setStatus(`Verificação ${rep.bossName}: ${rep.passed ? 'OK' : 'FALHOU'}.`);
      }, 'primary'),
      this.bossVerifyEl,
    );

    const s3 = this.section('Telemetria em Tempo Real do Boss');
    this.bossTelemetryEl = document.createElement('pre');
    this.bossTelemetryEl.className = 'bw-dev-pre';
    this.bossTelemetryEl.textContent = 'Nenhum boss ativo na cena.';
    s3.add(this.bossTelemetryEl);

    void bossSel;
    this.bodyEl.append(s1.details, s2.details, s3.details);
  }

  private renderEnemiesTab(): void {
    const adapters = this.deps.registry.getAdapters();
    if (this.selectedMissionIdx >= adapters.length) this.selectedMissionIdx = 0;
    const adapter = adapters[this.selectedMissionIdx];

    let fam = adapter.allowedFamilies[0];
    let form: DevEnemySpawnConfig['formation'] = 'solo';
    let motion = adapter.allowedMotions[0];
    let entry = adapter.allowedEntries[0];

    const stageSel = this.select(
      adapters.map((a) => ({ value: String(a.missionIndex), label: `${a.name} (${a.perspective})` })),
      String(this.selectedMissionIdx),
      (v) => {
        this.selectedMissionIdx = Number(v) || 0;
        this.renderActiveTab();
      },
    );
    const famSel = this.select(
      adapter.allowedFamilies.map((f) => ({ value: f, label: f })),
      fam,
      (v) => { fam = v as typeof fam; },
    );
    const formSel = this.select(
      ['solo', 'pair', 'trio', 'quartet', 'v', 'stagger', 'horde', 'escort', 'pincer', 'successive'].map((f) => ({ value: f, label: f })),
      form,
      (v) => { form = v as typeof form; },
    );
    const motSel = this.select(
      adapter.allowedMotions.map((m) => ({ value: m, label: m })),
      motion,
      (v) => { motion = v as typeof motion; },
    );
    const entrySel = this.select(
      adapter.allowedEntries.map((e) => ({ value: e, label: e })),
      entry,
      (v) => { entry = v as typeof entry; },
    );
    const diffSel = this.select([{ value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Difícil' }], 'normal', () => {});

    const qtyIn = this.numInput(1, 1, 24);
    const laneIn = this.numInput(0.5, 0.1, 0.9, 0.05);
    const speedIn = this.numInput(0, 0, 320, 5);
    const fireRateIn = this.numInput(1, 0.25, 4, 0.25);
    const shotSpdIn = this.numInput(1, 0.25, 3, 0.25);
    const posXIn = this.numInput(0, 0, 768, 10);
    const posYIn = this.numInput(0, 0, 432, 10);

    const keepChk = document.createElement('input');
    keepChk.type = 'checkbox';
    const keepLbl = document.createElement('label');
    keepLbl.className = 'bw-dev-chk';
    keepLbl.append(keepChk, document.createTextNode('Manter inimigos existentes na arena'));

    const spawnNow = (override?: Partial<DevEnemySpawnConfig>) => {
      const sc = this.requireScene();
      if (!sc) return;
      const sx = Number(posXIn.value);
      const sy = Number(posYIn.value);
      const spd = Number(speedIn.value);
      const cfg: DevEnemySpawnConfig = {
        missionIndex: adapter.missionIndex,
        family: fam,
        quantity: Number(qtyIn.value),
        formation: form,
        motion,
        entry,
        lane: Number(laneIn.value),
        speed: spd > 0 ? spd : undefined,
        spawnX: sx > 0 ? sx : undefined,
        spawnY: sy > 0 ? sy : undefined,
        fireRateScale: Number(fireRateIn.value),
        shotSpeedScale: Number(shotSpdIn.value),
        difficulty: diffSel.value as 'normal' | 'hard',
        keepExisting: keepChk.checked,
        ...override,
      };
      const n = this.deps.runner.spawnEnemyTest(sc, cfg);
      this.setStatus(`${n} inimigo(s) '${cfg.family}' gerado(s) (${cfg.formation}).`);
    };

    const s1 = this.section('Gerador de Inimigos & Formações');
    s1.add(
      this.row(this.field('Fase', stageSel), this.field('Família (Content.ts)', famSel), this.field('Dificuldade', diffSel)),
      this.row(this.field('Formação', formSel), this.field('Trajetória', motSel), this.field('Entrada', entrySel)),
      this.row(this.field('Qtd', qtyIn), this.field('Faixa (0.1–0.9)', laneIn), this.field('Vel. Mov (0=auto)', speedIn)),
      this.row(this.field('Cadência (×)', fireRateIn), this.field('Vel. Tiro (×)', shotSpdIn), this.field('Pos X (0=auto)', posXIn), this.field('Pos Y (0=auto)', posYIn)),
      keepLbl,
      this.row(
        this.btn('Iniciar Teste', () => spawnNow(), 'primary'),
        this.btn('Limpar Inimigos', () => {
          const sc = this.requireScene();
          sc?.world?.clearArenaEntities();
          this.setStatus('Inimigos e projéteis limpos.');
        }, 'danger'),
        this.btn('Limpar Projéteis', () => {
          this.requireScene()?.world?.clearBullets();
          this.setStatus('Projéteis limpos.');
        }),
        this.btn('Reiniciar Cenário', () => {
          const sc = this.requireScene();
          if (sc) this.deps.state.replayLast(sc);
        }),
      ),
    );

    const s2 = this.section('Testes Específicos Prontos');
    s2.add(
      this.row(
        this.btn('1 Helicóptero Scout', () => spawnNow({ missionIndex: 0, family: 'heli_scout', quantity: 1, formation: 'solo', motion: 'sine', spawnY: 110 })),
        this.btn('Utility (Twin Rotor)', () => spawnNow({ missionIndex: 0, family: 'heli_utility', quantity: 1, formation: 'solo', motion: 'stationary' })),
        this.btn('Phantom (Furtivo)', () => spawnNow({ missionIndex: 0, family: 'heli_phantom', quantity: 1, formation: 'solo', motion: 'side-curve', entry: 'left' })),
        this.btn('Warhawk (Míssil)', () => spawnNow({ missionIndex: 0, family: 'heli_warhawk', quantity: 1, formation: 'solo', motion: 'stationary', spawnY: 110 })),
        this.btn('10 Caças', () => spawnNow({ missionIndex: 0, family: 'fighter', quantity: 10, formation: 'solo', motion: 'sine' })),
        this.btn('Formação em V', () => spawnNow({ missionIndex: 0, family: 'fighter', quantity: 5, formation: 'v', motion: 'straight' })),
        this.btn('Entradas Laterais', () => {
          spawnNow({ missionIndex: 0, family: 'interceptor', quantity: 3, formation: 'trio', motion: 'side-cross', entry: 'left', keepExisting: false });
          spawnNow({ missionIndex: 0, family: 'fighter', quantity: 3, formation: 'trio', motion: 'side-curve', entry: 'right', keepExisting: true });
        }),
        this.btn('Submarino Emergindo', () => spawnNow({ missionIndex: 0, family: 'submarine', quantity: 1, formation: 'solo', motion: 'stationary', lane: 0.4 })),
        this.btn('Torre Costeira', () => spawnNow({ missionIndex: 0, family: 'tower', quantity: 1, formation: 'solo', motion: 'stationary', lane: 0.85 })),
        this.btn('Barcos Disparando', () => spawnNow({ missionIndex: 0, family: 'boat', quantity: 2, formation: 'pair', motion: 'stationary', spawnY: 135 })),
      ),
    );

    this.bodyEl.append(s1.details, s2.details);
  }

  private renderPlayerTab(): void {
    const sc = this.deps.getScene();
    const w = sc?.world;

    const lvlSel = this.select(
      [
        { value: '1', label: 'NV1' },
        { value: '2', label: 'NV2' },
        { value: '3', label: 'NV3' },
        { value: '4', label: 'NV4' },
        { value: '5', label: 'FULL (NV5)' },
      ],
      String(w?.weapons.weaponLevel ?? 1),
      (v) => {
        const scene = this.requireScene();
        if (scene) {
          this.deps.state.beginTestSession(scene);
          this.deps.combat.applyPlayerPatch(scene, { weaponLevel: Number(v) });
          this.setStatus(`Arma configurada para ${v === '5' ? 'FULL' : 'NV' + v}.`);
        }
      },
    );
    const meterIn = this.numInput(w?.weapons.powerMeter ?? 0, 0, 2);
    const livesIn = this.numInput(w?.lives ?? 3, 1, 5);
    const espIn = this.numInput(w?.weapons.specialCharges ?? 2, 0, 5);
    const scoreIn = this.numInput(w?.score ?? 0, 0, 9999999, 100);
    const diffSel = this.select(
      [{ value: 'normal', label: 'Normal' }, { value: 'hard', label: 'Difícil' }],
      w?.hard ? 'hard' : 'normal',
      () => {},
    );
    const rapidChk = document.createElement('input');
    rapidChk.type = 'checkbox';
    rapidChk.checked = Boolean(w?.accessibility);
    const invChk = document.createElement('input');
    invChk.type = 'checkbox';
    invChk.checked = Boolean(w?.devInvincible);
    const assistChk = document.createElement('input');
    assistChk.type = 'checkbox';
    assistChk.checked = Boolean(w?.assisted);

    const mkChk = (chk: HTMLInputElement, txt: string) => {
      const l = document.createElement('label');
      l.className = 'bw-dev-chk';
      l.append(chk, document.createTextNode(txt));
      return l;
    };

    const applyAll = () => {
      const scene = this.requireScene();
      if (!scene?.world) {
        this.setStatus('Inicie uma fase ou checkpoint antes de configurar a RIVET.');
        return;
      }
      this.deps.state.beginTestSession(scene);
      this.deps.combat.applyPlayerPatch(scene, {
        weaponLevel: Number(lvlSel.value),
        powerMeter: Number(meterIn.value),
        lives: Number(livesIn.value),
        specialCharges: Number(espIn.value),
        score: Number(scoreIn.value),
        difficulty: diffSel.value as 'normal' | 'hard',
        rapidFire: rapidChk.checked,
        assisted: assistChk.checked,
        devInvincible: invChk.checked,
      });
      this.setStatus('Configuração da RIVET aplicada.');
    };

    const s1 = this.section('Configurações da RIVET');
    s1.add(
      this.row(this.field('Nível da Arma', lvlSel), this.field('Medidor P (0–2)', meterIn), this.field('Dificuldade', diffSel)),
      this.row(this.field('Vidas (1–5)', livesIn), this.field('Especiais (0–5)', espIn), this.field('Pontuação', scoreIn)),
      this.row(
        mkChk(rapidChk, 'Disparo Acessível (auto)'),
        mkChk(assistChk, 'Modo Assistido'),
        mkChk(invChk, 'Invencibilidade Dev'),
      ),
      this.row(
        this.btn('Aplicar Configuração', applyAll, 'primary'),
        this.btn('RESETAR RIVET', () => {
          const scene = this.requireScene();
          if (scene) {
            this.deps.combat.resetRivet(scene);
            this.renderActiveTab();
            this.setStatus('RIVET restaurada ao padrão sem reiniciar fase.');
          }
        }, 'warn'),
      ),
    );

    const s2 = this.section('Ações Diretas & Recuperação');
    s2.add(
      this.row(
        this.btn('Disparo / Rajada', () => { const s = this.requireScene(); if (s) this.deps.combat.triggerBurst(s); }),
        this.btn('Mísseis', () => { const s = this.requireScene(); if (s) this.deps.combat.triggerMissile(s); }),
        this.btn('Ativar Especial', () => { const s = this.requireScene(); if (s) this.deps.combat.triggerSpecial(s); }, 'primary'),
        this.btn('TESTAR MORTE', () => {
          const s = this.requireScene();
          if (s) {
            this.deps.state.beginTestSession(s);
            this.deps.combat.triggerControlledDeath(s);
            this.setStatus('Morte controlada executada pela regra real.');
          }
        }, 'danger'),
      ),
      this.row(
        this.btn('Soltar P (Power)', () => this.requireScene() && this.deps.combat.spawnCargo(this.requireScene()!, 'power')),
        this.btn('Soltar Vida', () => this.requireScene() && this.deps.combat.spawnCargo(this.requireScene()!, 'life')),
        this.btn('Soltar Especial', () => this.requireScene() && this.deps.combat.spawnCargo(this.requireScene()!, 'special')),
      ),
    );

    this.bodyEl.append(s1.details, s2.details);
  }

  private renderCollisionsTab(): void {
    const flags = this.deps.collisions.getFlags();
    const s1 = this.section('Visualizador de Colisões & Hitboxes Reais');

    const toggles: Array<{ key: keyof typeof flags; label: string }> = [
      { key: 'enabled', label: 'ATIVAR OVERLAY DE COLISÕES' },
      { key: 'player', label: 'Hitbox da RIVET + raio de coleta' },
      { key: 'enemies', label: 'Hitboxes inimigas + bounds reais' },
      { key: 'bullets', label: 'Hitboxes dos projéteis + rastro sweep' },
      { key: 'bulletVectors', label: 'Direção real dos projéteis (vetores)' },
      { key: 'mounts', label: 'Pivôs e boca real dos canhões (muzzleX/Y)' },
      { key: 'bosses', label: 'Hitboxes de módulos dos chefes' },
      { key: 'armorAndHull', label: 'Blindagens, setores e casco Colosso' },
      { key: 'obstaclesAndCargo', label: 'Obstáculos e suprimentos' },
      { key: 'specialRadius', label: 'Área de efeito do Especial' },
    ];

    for (const item of toggles) {
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = flags[item.key];
      chk.addEventListener('change', () => {
        this.deps.collisions.setFlags({ [item.key]: chk.checked });
        this.setStatus(`Overlay '${item.label}': ${chk.checked ? 'ON' : 'OFF'}.`);
      });
      const l = document.createElement('label');
      l.className = 'bw-dev-chk';
      l.append(chk, document.createTextNode(item.label));
      s1.add(l);
    }

    s1.add(
      this.row(
        this.btn('Ligar Tudo', () => {
          this.deps.collisions.setFlags({
            enabled: true, player: true, enemies: true, bullets: true, bulletVectors: true,
            bosses: true, mounts: true, armorAndHull: true, obstaclesAndCargo: true, specialRadius: true,
          });
          this.renderActiveTab();
        }, 'primary'),
        this.btn('Desligar Overlay', () => {
          this.deps.collisions.setFlags({ enabled: false });
          this.renderActiveTab();
        }),
      ),
    );
    this.bodyEl.append(s1.details);
  }

  private renderEventsTab(): void {
    const adapters = this.deps.registry.getAdapters();
    if (this.selectedMissionIdx >= adapters.length) this.selectedMissionIdx = 0;
    const adapter = adapters[this.selectedMissionIdx];

    const stageSel = this.select(
      adapters.map((a) => ({ value: String(a.missionIndex), label: `${a.name} (${a.perspective})` })),
      String(this.selectedMissionIdx),
      (v) => {
        this.selectedMissionIdx = Number(v) || 0;
        this.renderActiveTab();
      },
    );
    const evtSel = this.select(
      adapter.events.map((ev) => ({ value: ev.id, label: `[${ev.atSeconds}s] ${ev.name}` })),
      adapter.events[0]?.id ?? '',
      () => {},
    );

    const s1 = this.section('Eventos & Diretor da Fase');
    s1.add(
      this.field('Fase', stageSel),
      this.field('Eventos registrados automaticamente', evtSel),
      this.row(
        this.btn('Acionar Evento', () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.state.beginTestSession(sc);
          const ev = adapter.events.find((e) => e.id === evtSel.value);
          if (ev) {
            const msg = ev.trigger(sc);
            this.deps.state.recordReplayAction(ev.name, () => ev.trigger(sc));
            this.setStatus(msg);
          }
        }, 'primary'),
        this.btn('Reiniciar Evento', () => {
          const sc = this.requireScene();
          if (sc) this.deps.state.replayLast(sc);
        }),
        this.btn('Próximo Encontro do Diretor', () => {
          const sc = this.requireScene();
          if (!sc?.world) return;
          const next = sc.world.devJumpNextEncounter();
          this.setStatus(next ? `Encontro @ ${next.at}s: ${next.family}` : 'Fim da lista de encontros.');
        }),
      ),
      this.row(
        this.btn('Limpar Projéteis', () => this.requireScene()?.world?.clearBullets()),
        this.btn('Limpar Inimigos', () => this.requireScene()?.world?.clearArenaEntities()),
        this.btn('Fala do Bayek (Teste)', () => {
          const sc = this.requireScene();
          if (sc) {
            sc.devTriggerPilotComms('threat', 'heli_warhawk');
            this.setStatus('Mensagem do Bayek disparada no HUD.');
          }
        }),
        this.btn('Debug Origem & Mira Canhões', () => {
          const sc = this.requireScene();
          if (sc) {
            const on = sc.toggleDevWeaponDebug();
            this.setStatus(`Debug de origem & mira dos canhões: ${on ? 'ATIVADO' : 'DESATIVADO'}.`);
          }
        }),
      ),
    );

    this.eventDirectorEl = document.createElement('pre');
    this.eventDirectorEl.className = 'bw-dev-pre';
    this.eventDirectorEl.textContent = 'Aguardando fase em andamento...';
    const s2 = this.section('Análise do Ritmo & Diretor Dinâmico');
    const jumpRow = this.row(
      ...[
        ['Início (0s)', 0],
        ['Costa (46s)', 46],
        ['Patrulhas (90s)', 90],
        ['Arco das Marés (148s)', 148],
        ['Retorno (180s)', 180],
        ['Escalada (255s)', 255],
        ['Boss (300s)', 300],
      ].map(([label, sec]) =>
        this.btn(String(label), () => {
          const sc = this.requireScene();
          if (!sc) return;
          this.deps.state.beginTestSession(sc);
          sc.devJumpToCheckpoint(0, Number(sec));
          this.setStatus(`Ritmo: saltou para ${label}.`);
        }),
      ),
    );
    s2.add(jumpRow, this.eventDirectorEl);
    this.bodyEl.append(s1.details, s2.details);
  }

  private renderPerformanceTab(): void {
    const sc = this.deps.getScene();
    const s1 = this.section('Controle Determinístico & Qualidade');
    const qSel = this.select(
      [{ value: '0', label: 'Qualidade BAIXA (0)' }, { value: '1', label: 'Qualidade MÉDIA (1)' }, { value: '2', label: 'Qualidade ALTA (2)' }],
      String(sc?.quality ?? 2),
      (v) => {
        const scene = this.requireScene();
        if (scene) {
          scene.setDevQuality(Number(v));
          this.setStatus(`Qualidade ajustada para ${v}.`);
        }
      },
    );
    s1.add(
      this.field('Qualidade Visual', qSel),
      this.row(
        this.btn('Pausar Simulação', () => { this.requireScene()?.setDevSimulationPaused(true); this.setStatus('Simulação pausada.'); }),
        this.btn('Retomar', () => { this.requireScene()?.setDevSimulationPaused(false); this.setStatus('Simulação retomada.'); }, 'primary'),
        this.btn('Passo 1/120s', () => {
          const s = this.requireScene();
          if (s) { s.setDevSimulationPaused(true); s.stepDevSimulation(1 / 120); this.setStatus('Avançou 1 tick (1/120s).'); }
        }),
      ),
      this.row(
        this.btn('Vel. 100%', () => { this.requireScene()?.setDevTimeScale(1); this.setStatus('Velocidade 1.0x'); }),
        this.btn('Vel. 50%', () => { this.requireScene()?.setDevTimeScale(0.5); this.setStatus('Velocidade 0.5x'); }),
        this.btn('Vel. 25%', () => { this.requireScene()?.setDevTimeScale(0.25); this.setStatus('Velocidade 0.25x'); }),
      ),
    );

    const s2 = this.section('Cenários de Estresse Controlado');
    const stressRow = this.row(
      this.btn('Muitos Inimigos', () => this.requireScene() && this.deps.runner.runStressScenario(this.requireScene()!, 'many-enemies')),
      this.btn('Muitos Projéteis', () => this.requireScene() && this.deps.runner.runStressScenario(this.requireScene()!, 'many-bullets')),
      this.btn('Vários Helicópteros', () => this.requireScene() && this.deps.runner.runStressScenario(this.requireScene()!, 'multi-helis')),
      this.btn('Explosões Simultâneas', () => this.requireScene() && this.deps.runner.runStressScenario(this.requireScene()!, 'explosions')),
      this.btn('Chefe + Módulos', () => this.requireScene() && this.deps.runner.runStressScenario(this.requireScene()!, 'boss-components')),
      this.btn('Especial em Combate', () => this.requireScene() && this.deps.runner.runStressScenario(this.requireScene()!, 'special-heavy')),
      this.btn('Encerrar & Limpar', () => {
        const s = this.requireScene();
        if (s?.world) { s.world.clearArenaEntities(); this.setStatus('Cenário de estresse limpo.'); }
      }, 'danger'),
    );
    s2.add(stressRow);

    this.perfLiveEl = document.createElement('pre');
    this.perfLiveEl.className = 'bw-dev-pre';
    this.perfReportEl = document.createElement('pre');
    this.perfReportEl.className = 'bw-dev-pre';
    this.perfReportEl.textContent = this.lastPerfReport
      ? JSON.stringify(this.lastPerfReport, null, 2)
      : 'Use Iniciar/Encerrar Medição para gerar relatório formal.';

    const s3 = this.section('Telemetria & Relatório');
    s3.add(
      this.perfLiveEl,
      this.row(
        this.btn('Iniciar Medição (Interativa)', () => {
          this.deps.perf.startRecording(this.deps.state.getLastLabel(), 'interactive');
          this.setStatus('Medição iniciada.');
        }, 'primary'),
        this.btn('Encerrar Medição', () => {
          this.lastPerfReport = this.deps.perf.stopRecording(this.deps.game, this.deps.getScene());
          if (this.perfReportEl) this.perfReportEl.textContent = JSON.stringify(this.lastPerfReport, null, 2);
          this.setStatus(`Relatório capturado: ${this.lastPerfReport.avgFps} FPS médios.`);
        }, 'warn'),
        this.btn('Limpar Dados', () => {
          this.deps.perf.clear();
          this.lastPerfReport = undefined;
          if (this.perfReportEl) this.perfReportEl.textContent = 'Dados limpos.';
        }),
      ),
      this.perfReportEl,
    );

    this.bodyEl.append(s1.details, s2.details, s3.details);
  }

  private renderVisualTab(): void {
    const sc = this.requireScene();
    const categories: Array<DevAssetCategory | 'TODAS'> = [
      'TODAS', 'RIVET', 'Aeronaves', 'Helicópteros', 'Barcos', 'Submarinos', 'Canhões', 'Explosões', 'Mísseis', 'Especiais',
    ];
    let curCat: DevAssetCategory | 'TODAS' = 'TODAS';

    const texSel = document.createElement('select');
    texSel.className = 'bw-dev-select';
    const populateTextures = () => {
      texSel.innerHTML = '';
      if (!sc) return;
      const entries = this.deps.previewer.listAvailable(sc, curCat === 'TODAS' ? undefined : curCat);
      for (const e of entries) {
        const o = document.createElement('option');
        o.value = e.key;
        o.textContent = `[${e.category}] ${e.label}`;
        if (e.key === this.deps.previewer.getSelectedKey()) o.selected = true;
        texSel.appendChild(o);
      }
      if (entries.length && !entries.some((e) => e.key === this.deps.previewer.getSelectedKey())) {
        this.deps.previewer.selectTexture(entries[0].key);
        texSel.value = entries[0].key;
      }
    };
    const catSel = this.select(
      categories.map((c) => ({ value: c, label: c })),
      curCat,
      (v) => { curCat = v as typeof curCat; populateTextures(); },
    );
    texSel.addEventListener('change', () => this.deps.previewer.selectTexture(texSel.value));
    populateTextures();

    this.animCanvas = document.createElement('canvas');
    this.animCanvas.width = 430;
    this.animCanvas.height = 150;
    this.animCanvas.className = 'bw-dev-canvas';

    this.animFrameLabel = document.createElement('span');
    this.animFrameLabel.style.fontSize = '11px';
    const fpsIn = this.numInput(this.deps.previewer.getFps(), 1, 30);
    fpsIn.addEventListener('change', () => this.deps.previewer.setFps(Number(fpsIn.value)));

    const pivChk = document.createElement('input');
    pivChk.type = 'checkbox';
    pivChk.checked = true;
    const bndChk = document.createElement('input');
    bndChk.type = 'checkbox';
    bndChk.checked = true;
    const syncGuides = () => this.deps.previewer.setGuides(pivChk.checked, bndChk.checked);
    pivChk.addEventListener('change', syncGuides);
    bndChk.addEventListener('change', syncGuides);

    this.animMetaEl = document.createElement('pre');
    this.animMetaEl.className = 'bw-dev-pre';

    const s1 = this.section('Inspetor de Spritesheets & Animações');
    s1.add(
      this.row(this.field('Categoria', catSel), this.field('Recurso Carregado', texSel)),
      this.animCanvas,
      this.row(
        this.btn('Play/Pause', () => this.deps.previewer.setPlaying(!this.deps.previewer.isPlaying()), 'primary'),
        this.btn('◀ Frame', () => sc && this.deps.previewer.stepFrame(sc, -1)),
        this.btn('Frame ▶', () => sc && this.deps.previewer.stepFrame(sc, 1)),
        this.animFrameLabel,
        this.field('FPS', fpsIn),
      ),
      this.row(
        (() => { const l = document.createElement('label'); l.className = 'bw-dev-chk'; l.append(pivChk, document.createTextNode('Pivô/Origem')); return l; })(),
        (() => { const l = document.createElement('label'); l.className = 'bw-dev-chk'; l.append(bndChk, document.createTextNode('Bordas do Frame')); return l; })(),
        this.btn('Testar Explosão na Arena', () => {
          if (sc?.world) {
            sc.world.emit('explosion', sc.world.up ? 384 : 420, 180, 1.8, 'heli_warhawk');
            this.setStatus('Efeito de destruição disparado na arena.');
          }
        }),
      ),
      this.animMetaEl,
    );
    this.bodyEl.append(s1.details);
  }

  tickVisualUpdate(): void {
    if (!this.isOpen() || this.deps.state.getPrefs().minimized) return;
    const sc = this.deps.getScene();
    const w = sc?.world;
    const tab = this.deps.state.getPrefs().activeTab;

    if (tab === 'bosses' && this.bossTelemetryEl) {
      if (!w?.boss) {
        this.bossTelemetryEl.textContent = 'Nenhum boss ou miniboss ativo na arena.';
      } else {
        const b = w.boss;
        const activeBullets = w.bullets.filter((bul) => bul.active && bul.enemy).length;
        if (b.sub) {
          const sec = b.sub.sections[b.sub.activeSection];
          const aliveParts = sec.parts.filter((p) => p.hp > 0);
          const deadParts = sec.parts.length - aliveParts.length;
          this.bossTelemetryEl.textContent =
            `Chefe: ${w.mission.boss} (${w.mission.name})\n` +
            `Estado: ${b.sub.phase} | Seção: ${sec.index + 1}/5 (${sec.name})\n` +
            `Casco: ${Math.ceil(sec.hullHp)}/${sec.hullMaxHp} | Ativos: ${aliveParts.length} | Destruídos: ${deadParts}\n` +
            `Projéteis hostis: ${activeBullets} | Tempo: ${b.age.toFixed(1)}s | Transição: ${b.sub.phase === 'transition' ? 'SIM' : 'NÃO'}\n` +
            `Componentes: ${sec.parts.map((p) => `${p.kind}:${Math.ceil(p.hp)}/${p.maxHp}`).join(' | ')}`;
        } else {
          const aliveParts = b.parts.filter((p) => p.hp > 0);
          this.bossTelemetryEl.textContent =
            `Chefe: ${b.mini ? 'MINIBOSS' : w.mission.boss} (${w.mission.name})\n` +
            `Estado: ${b.phase} (Config ${b.configuration}) | Padrão ataque: #${b.attack % 4}\n` +
            `Canhões ativos: ${aliveParts.length}/${b.parts.length} | Projéteis hostis: ${activeBullets} | Tempo: ${b.age.toFixed(1)}s\n` +
            `Componentes: ${b.parts.map((p, idx) => `#${idx + 1}:${Math.ceil(p.hp)}/${p.maxHp}`).join(' | ')}`;
        }
      }
    }

    if (tab === 'events' && this.eventDirectorEl) {
      if (!w) {
        this.eventDirectorEl.textContent = 'Nenhuma missão em execução.';
      } else {
        const snap = w.devDirectorSnapshot();
        const p = snap.pacing;
        const recent = p.timelineLog.slice(-4).map((e) => `@${e.at}s[${e.kind}:${e.detail}]`).join(' ');
        this.eventDirectorEl.textContent =
          `Fase: ${w.mission.name} (${w.hard && !w.isAssisted ? 'DIFÍCIL' : w.isAssisted ? 'ASSISTIDO' : 'NORMAL'}) | Rota: ${snap.route}s / 300s | Região #${snap.region + 1}: ${w.mission.regions[snap.region] ?? '-'}\n` +
          `Diretor: encontro ${snap.waveIndex}/${snap.totalEncounters} | Próximo @ ${snap.nextEncounterAt ?? 'fim'}s | Supressão: ${p.suppressedReason ?? 'livre'}\n` +
          `Presença: inimigo=${p.pctWithVisibleEnemy}% | ameaça=${p.pctWithThreat}% | MaxGap=${p.maxEnemyGapSeconds}s/${p.maxThreatGapSeconds}s | Gaps>2s:${p.idleGapsOver2s} >3s:${p.idleGapsOver3s}\n` +
          `Cadência: ${p.enemyShotsPerMinute} tiros/min | Pico=${p.peakSimultaneousEnemies} inimigos / ${p.peakSimultaneousBullets} tiros | Antecip:${p.wavesAnticipated} Reforç:${p.reinforcementsSpawned}\n` +
          `Boss: ${p.bossDurationSeconds}s | ${p.bossShotsPerMinute} tiros/min | Especiais: ${snap.triggeredEvents.length ? snap.triggeredEvents.join(', ') : 'nenhum'}\n` +
          `Log: ${recent || 'aguardando eventos'}`;
      }
    }

    if (tab === 'performance' && this.perfLiveEl) {
      const snap = this.deps.perf.snapshot(this.deps.game, sc);
      this.perfLiveEl.textContent =
        `FPS atual: ${snap.currentFps} | Média janela: ${snap.avgFps} FPS (${snap.avgMs} ms)\n` +
        `Mediana: ${snap.medianMs} ms | P95: ${snap.p95Ms} ms | P99: ${snap.p99Ms} ms\n` +
        `Inimigos: ${snap.enemies} | Tiros: ${snap.bullets} | Objetos cena: ${snap.objects} | Efeitos: ${snap.effects}\n` +
        `Qualidade: ${snap.quality} | Res: ${snap.resolution} | Memória: ${snap.heapMb ?? 'N/D'} MB\n` +
        `GPU: ${snap.rendererInfo}`;
    }

    if (tab === 'visual' && sc && this.animCanvas && this.animMetaEl) {
      const now = performance.now();
      const dtSec = Math.min(0.1, (now - this.animLastFrameAt) / 1000);
      this.animLastFrameAt = now;
      const meta = this.deps.previewer.renderToCanvas(sc, this.animCanvas, dtSec);
      if (meta) {
        if (this.animFrameLabel) this.animFrameLabel.textContent = `Frame ${meta.frameIndex + 1}/${meta.totalFrames}`;
        this.animMetaEl.textContent =
          `Textura: ${meta.key}\n` +
          `Dimensões Frame: ${meta.frameWidth}×${meta.frameHeight}px | Total frames: ${meta.totalFrames}\n` +
          `Origem/Pivô padrão: (${meta.originX}, ${meta.originY}) | Transparência amostrada: ~${meta.transparentPct}%`;
      }
    }
  }

  destroy(): void {
    this.toggleBtn.remove();
    this.root.remove();
  }
}
