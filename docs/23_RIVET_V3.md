# 23 — Rivet V3: nave de guerra, arsenal e spritesheets PNG

**Status:** implementação jogável na master. **Arte V3 convertida para paleta reduzida como primeiro passe**: ainda não equivale aos PNGs originais em alta qualidade do pacote de revisão. Feedback visual em navegador pendente.

## Entrega

- Apenas **Rivet / Nolan Fitch** alterada nesta etapa; a Moth e a Knuckle não foram retrabalhadas.
- Nova silhueta militar com casco angular, cabine e motores duplos; fundo transparente, orientação à direita.
- **Gerador Node 22+ sem dependências externas** em `scripts/generate-rivet-v3.mjs`, que parte de uma fonte compacta, converte para folhas PNG alfa e cria os efeitos.
- O pacote atual gera 15 arquivos PNG: 8 estados da nave (idle, climb, dive, fire, missile_launch, prism_charge, hit, destruction), propulsão, muzzle, pulso LV1, LV2, LV3, míssil e especial.
- Geração automática em `npm run dev`, `npm run build` e `npm test`, antes de carregar as texturas. Reproduzir manualmente: `npm run assets:rivet:v3`.
- As animações da Rivet V3 são registradas no Phaser e utilizadas na seleção e no combate.
- `Espaço` dispara pulso animado; `M` lança míssil com intervalo; `X` ativa uma rajada em leque de teste com cooldown; propulsão anima de forma independente.
- As teclas **1/2/3** mudam o visual e o dano do pulso **apenas para teste de integração**. **Power-ups reais, progresso salvo, upgrades e medidor de Ressonância ainda não estão implementados.**

## Técnica e limites

- Fonte visual V3 convertida para 160×110 pixels/32 cores antes da composição das animações; isso é um compromisso de prototipagem para colocar a nave no motor sem fundo.
- Slots de arma consistentes em coordenadas locais (ponta ~+69, míssil ~+40,-24, prism ~+55).
- Hitbox continua independente dos pixels do casco.
- A implementação é uma amostra da nova direção, **não aprovação artística final**. A comparação de qualidade com o pacote de revisão é obrigatória.
- Não tocar no StageDirector: a fase permanece em auto-scroll, sem waves.
- Finalização dos níveis LV1–3 e pickups planejada após o teste da arte V3.

## Como testar

```bash
git pull origin master
npm install
npm run dev
```

Selecionar Nolan. Setas/WASD, Espaço, M, X; 1/2/3 alteram nível de teste. Inspecionar animações e ausência de fundo/quadros verdes. Depois rodar `npm test` e `npm run build`.
