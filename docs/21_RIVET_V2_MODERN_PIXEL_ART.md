# Rivet V2 — implementar uma nave de cada vez

**Situação:** integração de gameplay realizada na branch `master`; TypeScript, build e testes de PNG pelo CI. **Revisão visual no navegador pendente.**

## Decisão do usuário
O acabamento v0.1 estava excessivamente simples e ampliava pixels grandes. A aprovação foi para uma direção de **pixel art moderna**, com camadas de casco, reflexos, cabine e turbinas de aparência mais rica. Neste ciclo **somente a Rivet / Nolan Fitch** recebe a revisão de sprites. Não foi produzida nenhuma V2 para Moth, Knuckle ou inimigos; as folhas V1 permanecem disponíveis apenas para preservar a jogabilidade existente.

## Entrega técnica
- Fonte de sprite original da Rivet, baseada no quadro da referência visual aprovada, conservada como **paleta RGBA + pixels RLE** dentro de `scripts/generate-rivet-v2.mjs`.
- O gerador reproduz seis folhas **PNG indexadas com transparência**, **112×54 por quadro**, sem conexão externa, sem dependência de ferramentas de desenho:
  - `idle.png`: 8 frames com pulsação de turbina;
  - `subida.png`: 8 poses de inclinação ascendente;
  - `descida.png`: 8 poses descendentes;
  - `disparo.png`: 8 frames com recuo e muzzle flash;
  - `dano.png`: 6 flashes e centelhas sobre o casco;
  - `destruicao.png`: 8 frames com fragmentação e clarão.
- `src/game/assets/spriteAssets.ts` registra esses seis estados sob as chaves de animação já existentes (`ship-rivet-*`) e adiciona `fire`. Os frames são animados pelo Phaser e têm alpha real.
- `PilotSelectScene` mostra a nova Rivet sem alterar as outras duas opções.
- `PrototypeScene` apresenta o novo sprite a escala reduzida para 384×216, altera a pose de acordo com o movimento/tiro/dano e preserva lógica de hitbox, vidas, score e Game Over.
- A renderização continua pixel art nearest-neighbor com `Phaser.AUTO` e canvas FIT.

## Reproduzir PNGs
Na raiz do projeto:
```bash
node scripts/generate-rivet-v2.mjs
npm test
npm run dev
```
Os PNGs já estão versionados, portanto `npm run dev` funciona sem gerar nada. Executar o gerador apenas para regenerá-los.

## Importante sobre qualidade
A V2 usa mais pixels e detalhes do que a V1. Os estados de movimento foram **derivados do casco-base com transformações discretas**, não desenhados à mão quadro a quadro — será necessário polir as inclinações para eliminar artefatos da rotação e confirmar o desenho artístico. Sem fingir acabamento definitivo, FPS medido ou teste mobile. A próxima prioridade é aceitar e polir a Rivet **antes** de produzir arte equivalente para outras naves e especiais.

## Checklist em navegador
1. Selecionar Nolan: Rivet maior, cabine e motores mais definidos, com frames distintos na seleção;
2. Testar WASD: nave sobe e desce com inclinações visíveis, mantendo a ponta à direita;
3. Segurar Espaço: sprite dispara e mostra flash, a cadência permanece 8/s;
4. Receber um impacto: 6 frames de hit/flash, i-frames intactos;
5. Morrer: animação de destruição antes da tela Game Over;
6. Reiniciar e usar Esc para selecionar outros pilotos; verificar que a V2 não alterou Moth/Knuckle;
7. Verificar que o PNG tem fundo transparente, sem recorte aparente e sem sobreposição às barras do HUD.
