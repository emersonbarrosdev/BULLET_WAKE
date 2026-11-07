# T02 — Canvas responsivo + sandbox inicial de gameplay

**Escopo aplicado:** ajustar escala e área segura e **antecipar controle de nave / tiro** para experimentar a sensação arcade antes da produção artística.

## O que foi implementado
- Configuração Phaser FIT em canvas 384×216, com pixelArt e nearest-neighbor CSS, barras laterais quando a tela não é 16:9.
- **Centralização controlada somente pelo CSS Flexbox**. Phaser Scale usa NO_CENTER para não aplicar uma segunda centralização, que deslocava o Canvas horizontalmente.
- Host 100dvh e `env(safe-area-inset-*)` para telas com notch; em portrait mobile, aviso de rotação.
- Cena `PrototypeScene` usada no lugar da cena diagnóstica do T01.
- WASD/setas com movimento em 8 direções, diagonal normalizada e limites da arena.
- Movimento em tempo real `px/s`, delta limitado a 50ms após abas em background.
- Disparo por espaço, alvo destruível de depuração e pontuação; cadência 8 tiros/s (Nolan).
- Toque inicial: segurar e arrastar para dirigir e disparar, **ainda não é layout touch final**.
- Camada `movement.ts` independente de Phaser para evolução e testes.

## Importante sobre arte
**Toda nave e todo alvo nesta cena são marcadores geométricos provisórios de depuração**, não sprites finais. O usuário solicitou gameplay primeiro. A arte autoral (Rivet/Moth/Knuckle, animações de inclinação, motores etc.) continua obrigatória, mas foi movida para depois de mecânicas-base no roadmap. Nenhum placeholder será considerado concluído como arte de release.

## Controles atuais
WASD / setas: mover. Espaço: atirar. Toque e arrasto (paisagem): mover e atirar. Os alvos atuais não atiram e não existe dano ao jogador, chefes ou campanha — são próximos passos.

## Critérios de aceite
1. GitHub Actions: instalação, typecheck e build.
2. Canvas mantém proporção 16:9 com nave e alvos visíveis em tela.
3. Nave se move em 8 direções e não ultrapassa margens.
4. Disparo mantém cadência independente de FPS e colisão com alvo incrementa score.
5. Testar manualmente navegador desktop e aparelho Android real antes de declarar UX mobile aprovada.

## Sem falsas conclusões
Este documento não afirma que existe sprite final, que o toque é definitivo nem que houve teste real em celular. O objetivo é um **sandbox de gameplay** verificável no navegador.
