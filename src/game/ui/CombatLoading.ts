import '../../combat-loading.css';

/** DOM transition: keeps animating while Phaser is loading or paused. */
export class CombatLoading {
  private root = document.createElement('div');
  private started = performance.now();
  private raf = 0;
  private closed = false;
  private failed = false;
  private previousFocus = document.activeElement as HTMLElement | null;
  private progress: HTMLProgressElement;

  constructor(title: string, detail: string) {
    this.root.className = 'bw-loading';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', title);
    this.root.tabIndex = -1;
    this.root.innerHTML = `<section class="bw-loading-panel"><p class="bw-loading-eyebrow">BULLET WAKE // FASE 01</p><h1></h1><p class="bw-loading-detail" role="status"></p><progress max="1" value="0" aria-label="Progresso do carregamento"></progress><span class="bw-loading-status">CARREGANDO</span></section>`;
    this.root.querySelector('h1')!.textContent = title;
    this.root.querySelector('.bw-loading-detail')!.textContent = detail;
    this.progress = this.root.querySelector('progress')!;
    document.body.append(this.root);
    this.root.focus({ preventScroll: true });
    document.addEventListener('keydown', this.blockInput, true);
  }

  private blockInput = (event: KeyboardEvent) => {
    if (this.failed && (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  setProgress = (value: number) => {
    if (!this.closed) this.progress.value = Math.max(0, Math.min(1, value));
  };

  /** Allow a visible settling interval after assets finish, including cache hits. */
  ready(minimumMs: number, complete: () => void, timed = false): void {
    this.started = performance.now();
    const tick = () => {
      if (this.closed || this.failed) return;
      const fraction = Math.min(1, (performance.now() - this.started) / minimumMs);
      if (timed) this.setProgress(fraction);
      if (fraction >= 1) {
        this.destroy();
        complete();
      } else this.raf = requestAnimationFrame(tick);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(tick);
  }

  fail(back: () => void): void {
    if (this.closed || this.failed) return;
    this.failed = true;
    cancelAnimationFrame(this.raf);
    this.root.querySelector('.bw-loading-detail')!.textContent = 'Não foi possível carregar os recursos. Volte e tente novamente.';
    this.root.querySelector('.bw-loading-status')!.textContent = 'CARREGAMENTO INTERROMPIDO';
    const button = document.createElement('button');
    button.textContent = 'VOLTAR AOS PILOTOS';
    button.onclick = () => { this.destroy(); back(); };
    this.root.querySelector('section')!.append(button);
    button.focus();
  }

  destroy = (): void => {
    if (this.closed) return;
    this.closed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('keydown', this.blockInput, true);
    this.root.remove();
    if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
  };
}
