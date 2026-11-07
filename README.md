# BULLET WAKE
*Every shot leaves a trace.*

**BULLET WAKE** é um shoot 'em up horizontal 2D original, com a resposta imediata de um arcade clássico e escala cinematográfica. Três pilotos e três naves jogáveis. Cinco missões artesanais, da defesa de uma colônia até o coração de uma rede de máquinas que transforma mundos.

**Status:** bíblia de pré-produção v1.0. Este commit contém **documentação**; ainda não existem build jogável, sprites definitivos ou testes de performance concluídos.

## Identidade aprovada
| Piloto | Nave | Perfil | Especial |
|---|---|---|---|
| Nolan Fitch | Rivet | Tiro rápido | Tempestade Prismática |
| Cora Wren | Moth | Maior mobilidade | Salto Fantasma |
| Harlan Greer | Knuckle | Tiro pesado | Ruptura Nova |

Todos disponíveis desde a primeira partida. Jogabilidade: **3 vidas, 3 HP por vida, armas até nível 3, power-ups, bombas, score, combos, continues limitados, checkpoints, Normal/Difícil e salvamento entre missões**. Campanha de cinco fases de aproximadamente 49 minutos sem mortes. Sem roguelite ou conteúdo procedural.

## Tecnologia
**Phaser 4 + TypeScript + Vite**, renderização WebGL em **HTML Canvas**. Não usar Angular no runtime arcade da primeira versão; Angular pode ser adotado separadamente para eventual editor externo. Primeiro entregar para navegador/PC; adaptar e validar no Android, potencialmente via Capacitor. Meta 60 FPS sujeita a testes reais. Confirmar e fixar a versão exata do Phaser antes do bootstrap; não copiar APIs da versão 3 indiscriminadamente.

## Índice
- [Visão e escopo](docs/00_VISAO.md)
- [Universo e história](docs/01_HISTORIA.md)
- [Pilotos, naves e especiais](docs/02_PILOTOS_NAVES.md)
- [Bíblia de arte](docs/03_ARTE.md)
- [Especificação de sprites e animações](docs/04_SPRITES.md)
- [Campanha e fases](docs/05_FASES.md)
- [Inimigos e chefes](docs/06_INIMIGOS.md)
- [Gameplay e progressão](docs/07_GAMEPLAY.md)
- [Arquitetura Phaser / Canvas / Android](docs/08_ARQUITETURA.md)
- [Interface, controles e áudio](docs/09_UI_AUDIO.md)
- [Testes e aceite](docs/10_TESTES.md)
- [Roadmap e tarefas](docs/11_ROADMAP.md)
- [Pipeline de assets](docs/12_ASSETS.md)
- [Decisões e pendências](docs/13_DECISOES.md)

## Diretrizes inegociáveis
Naves em **perfil lateral, frente para a direita**. Três silhuetas distintas; estados reais de animação para subir/descer, motores e armas; imagens finais em pixel art autoral com spritesheets PNG transparentes e fontes editáveis. Não confundir formas geométricas de debug com assets finais. Projéteis hostis sempre legíveis. Não copiar jogos, músicas ou arte das referências históricas. Documentação não significa implementação concluída.
