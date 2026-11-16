export type PelagicCommsCategory =
    | 'start'
    | 'threat'
    | 'submarine'
    | 'pickup'
    | 'damage'
    | 'miniboss'
    | 'arch'
    | 'special-event'
    | 'boss'
    | 'victory'
    | 'generic';

export type PelagicExpression = 0 | 1 | 2 | 3;

export interface PelagicCommsEntry {
    category: PelagicCommsCategory;
    text: string;
    priority: number;
    duration: number;
    expression: PelagicExpression;
}

export interface PelagicCommsState {
    category: PelagicCommsCategory;
    text: string;
    priority: number;
    remaining: number;
    duration: number;
    expression: PelagicExpression;
}

export interface PelagicCommsTrigger {
    category: PelagicCommsCategory;
    text?: string;
    detail?: string;
}

export const PELAGIC_COMMS_MAX_QUEUE = 2;

const CATEGORY_CONFIG: Record<PelagicCommsCategory, {
    priority: number;
    duration: number;
    cooldown: number;
    expression: PelagicExpression;
}> = {
    start: { priority: 1, duration: 3.1, cooldown: 30, expression: 0 },
    threat: { priority: 2, duration: 2.8, cooldown: 14, expression: 3 },
    pickup: { priority: 2, duration: 2.8, cooldown: 6.5, expression: 1 },
    submarine: { priority: 3, duration: 3.3, cooldown: 12, expression: 3 },
    damage: { priority: 3, duration: 3.0, cooldown: 10, expression: 2 },
    'special-event': { priority: 3, duration: 3.6, cooldown: 3.5, expression: 3 },
    miniboss: { priority: 3, duration: 3.8, cooldown: 5, expression: 3 },
    arch: { priority: 3, duration: 3.0, cooldown: 1.8, expression: 3 },
    boss: { priority: 4, duration: 4.3, cooldown: 0.8, expression: 3 },
    victory: { priority: 4, duration: 4.5, cooldown: 10, expression: 1 },
    generic: { priority: 2, duration: 3.2, cooldown: 5, expression: 0 },
};

const START_LINES = [
    'Canal livre.\nRota aberta!',
    'Mar aberto.\nVamos avançar!',
];

const THREAT_LINES: Record<string, string[]> = {
    bomber: [
        'Bombardeiro na rota!\nQuebre a formação!',
        'Casco pesado à frente.\nMire nos motores!',
    ],
    ship: [
        'Belonave no canal!\nAtenção ao convés!',
        'Navio armado à vista!\nDesvie das salvas!',
    ],
    airship: [
        'Dirigível detectado!\nAtaque o casco!',
    ],
    interceptor: [
        'Caças rápidos chegando!\nMantenha o ritmo!',
    ],
    heli_warhawk: [
        'Warhawk militar no ar!\nCuidado com o míssil!',
        'Canhoneira pesada!\nEsquive do lançador!',
    ],
    default: [
        'Esquadrão à frente!\nSegure o alinhamento!',
    ],
};

const SUBMARINE_LINES = [
    'Submarino emergindo!\nOlho nas torretas!',
    'Contato submerso!\nVai subir à tona!',
];

const PICKUP_LINES: Record<string, { text: string; expression: PelagicExpression }> = {
    life: { text: 'Vida extra!\nCasco reforçado!', expression: 1 },
    special: { text: 'Carga escarlata!\nEspecial pronto!', expression: 1 },
    full: { text: 'Potência máxima!\nRIVET no limite!', expression: 1 },
    recovery: { text: 'Potência retomada!\nDe volta ao voo!', expression: 0 },
};

const DAMAGE_LINES = [
    'Fui atingido!\nSegurando o leme!',
    'Impacto no casco!\nRetomando altitude!',
];

/**
 * Dynamic, non-spammy comms queue for Bayek in Fenda Pelágica (Stage 1).
 * Stays silent (`current() === null`) when no important event is active,
 * and advances its timer only while actively stepped during gameplay.
 */
export class PelagicComms {
    private active: PelagicCommsState | null = null;
    private queue: PelagicCommsEntry[] = [];
    private clock = 0;
    private lastCategoryAt = new Map<PelagicCommsCategory, number>();
    private variantCursor = new Map<string, number>();
    private lastSpokenText = '';

    reset(): void {
        this.active = null;
        this.queue = [];
        this.clock = 0;
        this.lastCategoryAt.clear();
        this.variantCursor.clear();
        this.lastSpokenText = '';
    }

    current(): PelagicCommsState | null {
        return this.active;
    }

    pendingCount(): number {
        return this.queue.length;
    }

    step(dt: number): void {
        if (dt <= 0) return;
        this.clock += dt;
        if (!this.active) {
            this.promoteNext();
            return;
        }
        this.active.remaining -= dt;
        if (this.active.remaining <= 0) {
            this.active = null;
            this.promoteNext();
        }
    }

    trigger(input: PelagicCommsTrigger): boolean {
        const cfg = CATEGORY_CONFIG[input.category];
        const prevAt = this.lastCategoryAt.get(input.category);
        if (prevAt !== undefined && this.clock - prevAt < cfg.cooldown) {
            return false;
        }

        const resolved = this.resolveLine(input);
        if (!resolved || !resolved.text.trim()) return false;

        const norm = normalizeLine(resolved.text);
        if (this.active && normalizeLine(this.active.text) === norm) return false;
        if (this.queue.some(item => normalizeLine(item.text) === norm)) return false;

        const entry: PelagicCommsEntry = {
            category: input.category,
            text: resolved.text,
            priority: cfg.priority,
            duration: cfg.duration,
            expression: resolved.expression,
        };

        if (!this.active) {
            this.lastCategoryAt.set(input.category, this.clock);
            this.activate(entry);
            return true;
        }

        // Higher critical events preempt low/normal active chatter without waiting for stale lines.
        if (entry.priority >= 4 && this.active.priority < 4) {
            this.lastCategoryAt.set(input.category, this.clock);
            this.activate(entry);
            return true;
        }
        if (entry.priority >= 3 && this.active.priority === 1) {
            this.lastCategoryAt.set(input.category, this.clock);
            this.activate(entry);
            return true;
        }

        if (!this.enqueue(entry)) return false;
        this.lastCategoryAt.set(input.category, this.clock);
        return true;
    }

    private activate(entry: PelagicCommsEntry): void {
        this.active = {
            category: entry.category,
            text: entry.text,
            priority: entry.priority,
            duration: entry.duration,
            remaining: entry.duration,
            expression: entry.expression,
        };
        this.lastSpokenText = normalizeLine(entry.text);
    }

    private enqueue(entry: PelagicCommsEntry): boolean {
        if (this.queue.length >= PELAGIC_COMMS_MAX_QUEUE) {
            // Find the lowest priority pending item; replace it only if the incoming event outranks it.
            let lowestIdx = 0;
            for (let i = 1; i < this.queue.length; i++) {
                if (this.queue[i].priority < this.queue[lowestIdx].priority) lowestIdx = i;
            }
            if (entry.priority <= this.queue[lowestIdx].priority) return false;
            this.queue.splice(lowestIdx, 1);
        }
        this.queue.push(entry);
        this.queue.sort((a, b) => b.priority - a.priority);
        return true;
    }

    private promoteNext(): void {
        const next = this.queue.shift();
        if (next) this.activate(next);
    }

    private resolveLine(input: PelagicCommsTrigger): { text: string; expression: PelagicExpression } | null {
        const baseExp = CATEGORY_CONFIG[input.category].expression;
        if (input.text) {
            return { text: compactLine(input.text), expression: baseExp };
        }
        switch (input.category) {
            case 'start':
                return { text: this.pickVariant('start', START_LINES), expression: 0 };
            case 'threat': {
                const pool = THREAT_LINES[input.detail ?? 'default'] ?? THREAT_LINES.default;
                return { text: this.pickVariant(`threat:${input.detail ?? 'default'}`, pool), expression: 3 };
            }
            case 'submarine':
                return { text: this.pickVariant('submarine', SUBMARINE_LINES), expression: 3 };
            case 'pickup': {
                const hit = PICKUP_LINES[input.detail ?? ''];
                return hit ? { text: hit.text, expression: hit.expression } : null;
            }
            case 'damage': {
                if (input.detail === 'assist-drop') {
                    return { text: 'Modo Assistido!\nColete o P dourado!', expression: 3 };
                }
                if (input.detail === 'low-lives') {
                    return { text: 'Sem margem agora!\nFoco total na rota!', expression: 2 };
                }
                return { text: this.pickVariant('damage', DAMAGE_LINES), expression: 2 };
            }
            case 'miniboss':
                if (input.detail === 'clear') {
                    return { text: 'Pista limpa!\nRumo ao setor final!', expression: 1 };
                }
                return { text: 'Patrulha pesada\nfechando a rota!', expression: 3 };
            case 'arch':
                if (input.detail === 'approach') {
                    return { text: 'Arco das Marés à frente!\nPreparar descida!', expression: 3 };
                }
                if (input.detail === 'descent') {
                    return { text: 'Baixando altitude!\nDesvie dos canhões!', expression: 3 };
                }
                if (input.detail === 'ascent') {
                    return { text: 'Saindo do arco!\nSubindo para altitude normal!', expression: 0 };
                }
                if (input.detail === 'checkpoint' || input.detail === 'resume') {
                    return { text: 'CHECKPOINT ALCANÇADO!\nRota livre adiante!', expression: 1 };
                }
                return { text: 'Travessia em voo baixo!', expression: 3 };
            case 'boss':
                if (input.detail === 'collapse') {
                    return { text: 'REATOR CRÍTICO!\nCOLOSSO PARTINDO!', expression: 1 };
                }
                return { text: 'COLOSSO ABISSAL\nemerso na fenda!', expression: 3 };
            case 'victory':
                return { text: 'Essa foi pra equipe!\nRIVET retornando!', expression: 1 };
            case 'special-event':
                return { text: 'Contato tático!\nMantenha a guarda!', expression: 3 };
            default:
                return null;
        }
    }

    private pickVariant(key: string, pool: readonly string[]): string {
        if (!pool.length) return '';
        let idx = (this.variantCursor.get(key) ?? 0) % pool.length;
        if (pool.length > 1 && normalizeLine(pool[idx]) === this.lastSpokenText) {
            idx = (idx + 1) % pool.length;
        }
        this.variantCursor.set(key, (idx + 1) % pool.length);
        return pool[idx];
    }
}

function normalizeLine(text: string): string {
    return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

function compactLine(text: string): string {
    return text
        .replace(/^BAYEK:\s*/i, '')
        .trim();
}
