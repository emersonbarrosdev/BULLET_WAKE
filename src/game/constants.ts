/**
 * BULLET WAKE V2 — Constantes Globais de Arquitetura e Layout Neo-Arcade HD 2D.
 * Formato 16:9 widescreen (768×432 lógico com super-amostragem tipográfica 3x HD):
 * - Painel Esquerdo (168px): Telemetria de Piloto, Vida/Blindagem, Dash 3/3 e Pontuação.
 * - Corredor Central (432px): Campo de Combate Vertical Amplo (432×432) 100% desobstruído.
 * - Painel Direito (168px): Arma Equipada, Potência 1-4, Progresso P 0/3, Bombas e Especial.
 */
export const GAME_WIDTH = 768;
export const GAME_HEIGHT = 432;
export const GAME_BACKGROUND = '#060d17' as const;

// Corredor de Combate Vertical Central Expandido (432px de largura, 432px de altura, centro exato em X=384)
export const PLAYFIELD_X = 168;
export const PLAYFIELD_WIDTH = 432;
export const PLAYFIELD_HEIGHT = 432;
export const PLAYFIELD_RIGHT = 600;
export const PANEL_LEFT_WIDTH = 168;
export const PANEL_RIGHT_WIDTH = 168;

export const HUD_TOP = 28;
export const HUD_BOTTOM = 28;
// Fator de velocidade balanceado para controle preciso no corredor vertical (1.0 = velocidade base do piloto)
export const PLAYER_SPEED_FACTOR = 1.0;

// Tipografia Canônica V2 (Máximo 2 famílias: Oxanium e Rajdhani)
export const FONT_TITLE = '"Oxanium", "Segoe UI", sans-serif';
export const FONT_HUD = '"Rajdhani", "Segoe UI", sans-serif';
export const FONT_TECH = '"Rajdhani", "Segoe UI", sans-serif';
