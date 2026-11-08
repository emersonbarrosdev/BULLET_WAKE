/**
 * BULLET WAKE V2 — Constantes Globais de Arquitetura e Layout Neo-Arcade HD 2D.
 * Formato 16:9 widescreen (768×432) com TATE Arcade Bezel:
 * - Painel Esquerdo (192px): Telemetria de Piloto, Blindagem, Vidas, Dash e Pontuação.
 * - Corredor Central (384px): Campo de Combate Vertical 100% desobstruído.
 * - Painel Direito (192px): Armamento LV1-4, Bombas, Especial e Radar/Boss HP.
 */
export const GAME_WIDTH = 768;
export const GAME_HEIGHT = 432;
export const GAME_BACKGROUND = '#060d17' as const;

// Corredor de Combate Vertical Central (384px de largura, 432px de altura)
export const PLAYFIELD_X = 192;
export const PLAYFIELD_WIDTH = 384;
export const PLAYFIELD_HEIGHT = 432;
export const PLAYFIELD_RIGHT = 576;
export const PANEL_LEFT_WIDTH = 192;
export const PANEL_RIGHT_WIDTH = 192;

export const HUD_TOP = 28;
export const HUD_BOTTOM = 28;
// Fator de velocidade balanceado para controle preciso no corredor vertical (1.0 = velocidade base do piloto)
export const PLAYER_SPEED_FACTOR = 1.0;

// Tipografia Canônica V2 (Máximo 2 famílias: Oxanium e Rajdhani)
export const FONT_TITLE = '"Oxanium", sans-serif';
export const FONT_HUD = '"Rajdhani", sans-serif';
export const FONT_TECH = '"Rajdhani", sans-serif';
