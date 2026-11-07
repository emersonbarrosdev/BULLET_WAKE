# BULLET WAKE
*Every shot leaves a trace.*

**BULLET WAKE** é um shoot 'em up horizontal 2D original, com a resposta imediata de um arcade clássico e escala cinematográfica. Três pilotos e três naves jogáveis. Cinco missões artesanais, da defesa de uma colônia até o coração de uma rede de máquinas que transforma mundos.

**Status:** pré-produção + bootstrap T01 versionado. Há uma tela diagnóstica Phaser 4; **não há gameplay, sprites definitivos ou testes de performance aprovados**.

## Identidade aprovada
| Piloto | Nave | Perfil | Especial |
|---|---|---|---|
| Nolan Fitch | Rivet | Tiro rápido | Tempestade Prismática |
| Cora Wren | Moth | Maior mobilidade | Salto Fantasma |
| Harlan Greer | Knuckle | Tiro pesado | Ruptura Nova |

Todos disponíveis desde a primeira partida. Jogabilidade: **3 vidas, 3 HP por vida, armas até nível 3, power-ups, bombas, score, combos, continues limitados, checkpoints, Normal/Difícil e salvamento entre missões**. Campanha de cinco fases de aproximadamente 49 minutos sem mortes. Sem roguelite ou conteúdo procedural.

## Tecnologia
**Phaser 4 + TypeScript + Vite**, renderização WebGL em **HTML Canvas**. Não usar Angular no runtime arcade da primeira versão; Angular pode ser adotado separadamente para eventual editor externo. Primeiro entregar para navegador/PC; adaptar e validar no Android, potencialmente via Capacitor. Meta 60 FPS sujeita a testes reais. Phaser fixado em **4.2.1**. APIs de Phaser 4 devem ser usadas, não exemplos obsoletos de Phaser 3.

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
- [T01 — Bootstrap web](docs/14_T01_BOOTSTRAP.md)

## Diretrizes inegociáveis
Naves em **perfil lateral, frente para a direita**. Três silhuetas distintas; estados reais de animação para subir/descer, motores e armas; imagens finais em pixel art autoral com spritesheets PNG transparentes e fontes editáveis. Não confundir formas geométricas de debug com assets finais. Projéteis hostis sempre legíveis. Não copiar jogos, músicas ou arte das referências históricas. Documentação não significa implementação concluída.

## Rodar a base inicial

```bash
npm install
npm run typecheck
npm run dev
npm run build
```

A página apresenta a tela diagnóstica T01 no Canvas (não jogo final). A instalação requer conexão com npm. O lockfile será produzido na primeira instalação bem-sucedida; o CI em `.github/workflows/check.yml` verifica TypeScript e build a cada push.
