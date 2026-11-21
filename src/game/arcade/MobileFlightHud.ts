/** Mobile landscape instrument panel. It lives outside the battlefield camera. */
export class MobileFlightHud {
  private root?: HTMLElement;
  private values = new Map<string, HTMLElement>();
  hide(): void { this.root?.remove(); this.root = undefined; this.values.clear(); }
  draw(data: { width: number; ship: string; image: string; hull: number; maximum: number; classic: boolean; power: number; charge: number; specials: number; boss?: string }, pause: () => void): void {
    if (!this.root) {
      this.root = document.createElement('aside'); this.root.className = 'bw-mobile-flight'; this.root.setAttribute('aria-label', 'Instrumentos da nave');
      const img = document.createElement('img'); img.src = data.image; img.alt = ''; this.root.append(img);
      for (const key of ['ship', 'hull', 'power', 'charge', 'specials', 'boss']) {
        const value = document.createElement('div'); value.dataset.instrument = key; this.root.append(value); this.values.set(key, value);
      }
      const button = document.createElement('button'); button.textContent = 'Pausar'; button.type = 'button'; button.onclick = pause; this.root.append(button);
      document.body.append(this.root);
    }
    const width = `${data.width}px`;
    if (this.root.style.width !== width) this.root.style.width = width;
    const text = (key: string, value: string) => { const node = this.values.get(key)!; if (node.textContent !== value) node.textContent = value; };
    text('ship', data.ship);
    text('hull', `${data.classic ? 'Vidas' : 'Casco'}  ${data.hull}/${data.maximum}\n${'▰'.repeat(Math.max(0, data.hull))}${'▱'.repeat(Math.max(0, data.maximum - data.hull))}`);
    text('power', `Potência  ${data.power}/5`);
    text('charge', `Carga  ${Math.round(data.charge * 100)}%`);
    text('specials', `Especial  ×${data.specials}`);
    text('boss', data.boss ?? '');
  }
}
