import type { PickupType } from '../systems/pickupSystem.ts';

interface PickupGuideEntry {
  letter: string; label: string; color: string; shape: string; glyph: string; description: string;
}

/** One catalog supplies both gameplay textures and the Options legend. */
export const PICKUP_GUIDE: Record<PickupType, PickupGuideEntry> = {
  power: { letter: 'P', label: 'POTÊNCIA', color: '#ffd23f', shape: 'M32 3 59 32 32 61 5 32Z', glyph: 'M35 13 21 34H31L28 51 44 27H34Z', description: '3 P = +1 nível. São 9 P do NV1 ao NV4. No máximo, guarde mais 3 como reserva para o próximo Continue.' },
  weapon_ion: { letter: 'W', label: 'DISPERSÃO AZUL', color: '#42cfff', shape: 'M17 4H47L60 24 51 57H13L4 24Z', glyph: 'M32 47V15M32 36 17 19M32 36 47 19M13 23 17 15 23 18M41 18 47 15 51 23', description: 'Tiros em leque: 3 / 5 / 9 / 16 projéteis em leque. Troca a arma preservando potência e P. Mesma cor: +5.000 pontos.' },
  weapon_green: { letter: 'W', label: 'ENERGIA ESPIRALADA', color: '#42e37c', shape: 'M16 5H48L59 16V48L48 59H16L5 48V16Z', glyph: 'M21 13C51 24 13 40 43 51M43 13C13 24 51 40 21 51', description: 'Ondas concentradas que se abrem com a potência. Troca livre desde NV1. Mesma cor: +5.000 pontos; não dá P.' },
  weapon_red: { letter: 'W', label: 'LASER RUBRO', color: '#ff4c65', shape: 'M32 3 55 17 59 44 44 59H20L5 44 9 17Z', glyph: 'M33 11C40 26 21 23 28 36 33 26 42 28 44 39 45 55 18 55 19 38 18 28 29 27 33 11Z', description: 'Feixes contínuos enquanto segura Espaço. Mais feixes por nível. Mesma cor: +5.000 pontos; não aumenta potência.' },
  health: { letter: 'H', label: 'REPARO', color: '#f2fff7', shape: 'M12 6H52V35C52 48 32 60 32 60S12 48 12 35Z', glyph: 'M27 17H37V27H47V37H37V47H27V37H17V27H27Z', description: 'Recupera 30% de integridade do casco. Com blindagem completa, vale 300 pontos. Não recarrega dash.' },
  bomb: { letter: 'B', label: 'PULSO DEFENSIVO', color: '#ff922f', shape: 'M6 20 20 6H44L58 20V44L44 58H20L6 44Z', glyph: 'M37 22 44 15M44 15H51M44 15V8M35 22A15 15 0 1 0 42 32M29 24 35 30', description: '+1 pulso defensivo, até 3. X limpa balas próximas, protege por 0,4 s e causa dano leve. V é o especial ofensivo.' },
  speed: { letter: 'S', label: 'VELOCIDADE', color: '#a5b7ff', shape: 'M3 15 32 5 61 15 50 50 32 59 14 50Z', glyph: 'M13 39 32 20 51 39M19 48 32 35 45 48', description: 'Aumenta o movimento em 8%, até 3 incrementos. Reinicia ao usar Continue. Não recarrega dash.' },
  score: { letter: '$', label: 'PONTOS', color: '#36e2d4', shape: 'M32 3A29 29 0 1 0 32 61 29 29 0 1 0 32 3Z', glyph: 'M32 13 37 25 50 27 40 36 42 49 32 43 22 49 24 36 14 27 27 25Z', description: '+500 pontos. O símbolo $ distingue pontuação do S de velocidade.' },
  missile: { letter: 'M', label: 'MÍSSIL', color: '#a5d0ed', shape: 'M32 3 52 18V52L32 61 12 52V18Z', glyph: 'M32 12 39 25V41H25V25ZM25 33 17 45H25M39 33 47 45H39M29 46V54M35 46V54', description: 'Deixa o míssil secundário pronto para disparar com M. Não troca a arma principal.' },
  special: { letter: 'E', label: 'RESSONÂNCIA', color: '#d080ff', shape: 'M21 3H43L57 32 43 61H21L7 32Z', glyph: 'M32 12 44 32 32 52 20 32ZM20 32H44M32 12V52', description: '+25% de ressonância. Ao completar 100%, V ativa a habilidade do piloto.' },
  full_power: { letter: 'P★', label: 'P MÁXIMO · SANDBOX', color: '#ff83b8', shape: 'M32 2 40 19 59 20 46 34 50 55 32 45 14 55 18 34 5 20 24 19Z', glyph: 'M27 43V22H35C47 22 47 35 35 35H27', description: 'Somente para validação no sandbox. Não aparece no roteiro Normal e não acelera a campanha.' },
};

export const NORMAL_GUIDE_ITEMS = (Object.keys(PICKUP_GUIDE) as PickupType[]).filter(type => type !== 'full_power');

export function pickupSvg(type: PickupType): string {
  const e = PICKUP_GUIDE[type];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 64 64"><path d="${e.shape}" fill="#080c12" stroke="${e.color}" stroke-width="3"/><path d="${e.shape}" transform="translate(6.4 6.4) scale(.8)" fill="${e.color}" fill-opacity=".12" stroke="${e.color}" stroke-opacity=".35"/><path d="${e.glyph}" fill="none" stroke="${e.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
