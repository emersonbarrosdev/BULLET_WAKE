# T08 — Resolução maior e primeira fase em auto-scroll

**Estado:** implementação na master, validar gameplay e render no navegador real. Este marco substitui a visão de arena/ondas, como solicitado pelo proprietário.

## Decisões
- **768 × 432 pixels lógicos (16:9)**, antes 384 × 216. A mesma Rivet V2 de 112 × 54 frames fica próxima da escala 1:1 em vez de receber aumento de 3× ou 4×. Isso reduz pixels exagerados na tela; pixel art moderna mantém pixels definidos. Não é necessário refazer Moth ou Knuckle agora; suas folhas V1 ainda são provisórias.
- Resolução escalada com Phaser FIT, centralizada pelo CSS; as labels foram reposicionadas e aumentadas para o novo espaço.
- O combate agora tem cenário industrial orbital com **três planos de parallax contínuos** (nebulosa/estrelas, destroços, nervuras próximas). Texturas de cenário procedural são de protótipo, não o cenário final em pixel art.
- **Removido o modelo de ondas recorrentes.** `StageDirector` agenda aparições de Scout/Lancer **uma vez por distância de avanço**. Formações e interceptações acontecem durante a progressão.
- HUD mostra **FASE 01 — CINTURAO DE FERRUGEM**, nome do setor e progresso, em vez de ONDA 01, ONDA 02.
- Segmentos: corredor de evacuação → campo de destroços → anel industrial → aproximação da MALHA.
- Primeiro trecho tem aproximadamente **um minuto de gameplay roteirizado**, com término transparente: `TRECHO CONCLUIDO / DEMO`. **Não há boss nem fim de fase completo neste commit.** A campanha projetada mantém sua duração de 8–10 minutos por fase no produto final.
- Pilotos, sprites existentes, dano/vidas e tiros permanecem funcionais. Colisões dos projéteis do jogador agora testam o caminho entre frames para reduzir falhas por velocidade.
- Testes automatizados incluem progresso, ordem/quantidade de spawns, ausência de repetição automática, telegraph, hitpoints e término honesto.

## Estrutura de código
- `src/game/systems/stageDirector.ts`: diretor determinístico puro orientado a distância.
- `src/game/scenes/StageBackdrop.ts`: cenário 3 camadas com parallax TileSprites.
- `src/game/ui/CombatHud.ts`: barra de progresso, setor e indicadores.
- `src/game/ui/StageCompleteOverlay.ts`: encerramento do trecho de demonstração.
- `src/game/scenes/PrototypeScene.ts`: integração e controles.
- `tests/stageDirector.test.mjs`: testes das regras do trecho.
- `docs/11_ROADMAP.md`: tarefas reordenadas.

## Aceitação manual
1. `git pull origin master && npm run dev`; selecionar Nolan.
2. A Rivet deve mostrar acabamento mais fino e maior proporção de pixels da imagem; testar subida/descida/disparo.
3. O fundo deve rolar **sempre da direita para a esquerda**, mesmo sem disparos; há três velocidades de profundidade.
4. Os Scouts e Lancers surgem na lateral direita em formações conforme a nave progride — sem numeração de ondas, sem repetição do mesmo trecho.
5. O HUD deve exibir progresso de 0 a 100%, atualizar os setores e manter HP/vidas/score.
6. Ao perder todas as vidas, Game Over e reinício funcionam. Se sobreviver ao trecho, aparecer `TRECHO CONCLUIDO` (não fingir boss implementado).
7. Testar browser real em 16:9, viewport estreito e paisagem mobile. FPS ainda não medido.
8. Verificar arquivos de assets e console se houver quadros verdes: **verde/diagonal não é visual pretendido de inimigo**; isso pode indicar textura ausente e exige depuração de preload.

## Próximas etapas
Aprimorar sprites da Rivet, corrigir qualquer placeholder verde/ausência de textura observado e continuar a fase de cenário por trechos e encontros. **Sem voltar a criar rounds/ondas recorrentes.** Fazer arte das outras naves somente quando a Rivet estiver visualmente aceita.

## Proteção adicional para textura ausente
O Phaser desenha um quadrado verde com diagonal quando alguma textura não foi encontrada. O carregamento foi reforçado com URLs absolutas baseadas no Vite, nova tentativa ao iniciar a cena de combate e logs de falha por chave. A correção completa depende de confirmar no navegador se o arquivo falha por URL, cache ou decodificação. Se ainda houver quadrados verdes, abrir DevTools → Console/Network e verificar a chave/URL informada; não considerar aprovado só por CI.
