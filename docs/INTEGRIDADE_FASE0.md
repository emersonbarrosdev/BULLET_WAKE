# Consolidação anterior ao sistema de casco

Data: 20/11/2026. Branch inicial: `feat/bullet-wake-evolucion-definitiva`, HEAD `ecd0e29`. Base local/remota: `90c4966`. Fetch confirmou que não havia commits remotos adicionais nem conflitos.

## Seleção das alterações

O histórico atual já incorpora `balance/fenda-stage-progression` (`5156844`) e `feat/supply-drone-carrier` (`842f962`), incluindo cronograma vertical de 360 s, helicópteros e drone animado. Os commits `2e7ea6c`, `1d41dd0`, `9532603`, `dd52ac8` e `ecd0e29` acrescentam controles padronizados, disparo, QA, contratos dos cinco pilotos, perfil v4, ranking e replay.

Foram preservadas as alterações não commitadas de cena, HUD, cronograma, áudio, entrada e capturas. O score desktop vertical agora ocupa o painel esquerdo em x=147, y=118, fora da arena x=160..608.

As branches `backup/hud-antes-da-atualizacao` e `fix/hud-fenda-fiel-aprovacao-20261117` foram inspecionadas separadamente. Contêm iterações sobrepostas de HUD e restaurações de versões anteriores do mundo/controles. Seu merge integral regrediria a progressão 360 s, drones, carga e contratos atuais. O HUD vigente já mantém rádio persistente, paginação, retrato e pausa lateral; as branches históricas permanecem preservadas como referência, sem merge cego.

## Validação da base

- `npm run typecheck`: aprovado.
- Primeira execução `npm test`: 417/418. O teste novo de foco tentava medir movimento durante a introdução. Preparação corrigida explicitamente para `state='play'`; nenhum contrato de gameplay foi relaxado.
- Segunda execução `npm test`: 418/418, zero ignorados ou cancelados.
- A inspeção visual detectou recorte grave da arena: o efeito de shake chamava `setScroll(0,0)` e anulava a centralização compensada pelo zoom. Corrigido para `centerOn` no centro virtual, incluindo retorno aos menus; regressão verificada também nas coordenadas de touch.
- Terceira execução `npm test`, após a correção de câmera: 418/418. A leitura do atlas de míssil foi corrigida para os quatro frames reais de 128×128; o asset original de 512×128 foi preservado. Build final aprovado.
- O script de navegador ganhou verificação dos cantos virtuais da câmera e importação explícita do helper do arco usado pelo bot serializado; não foram removidas as asserções de touch.
- `npm run build`: aprovado. Aviso existente de bundle acima de 500 kB.
- Diagnósticos do editor: nenhum erro.
- `node --experimental-strip-types scripts/arcade-route.mjs`: vitória nas duas simulações; Fenda 422,72 s, 199.055 pontos; Solar 323,02 s, 299.775 pontos. São bots, não playtests humanos.
- `node scripts/arcade-browser-check.mjs --both --performance`: aprovado, zero erros runtime; boot de produção sem globals de desenvolvimento, duas perspectivas, controles de gamepad virtual, touch com tiro/soltura/joystick/especial/pausa e capturas renovadas. Quatro cenários de desempenho (duas missões × qualidades 0/2), mediana próxima de 16,7 ms no Chrome deste ambiente. Aviso preexistente de máscara não suportada por WebGL permanece; não foi contado como erro nem aprovação artística final.
- Publicação: commit e workflows identificados no relatório final da funcionalidade após confirmação remota.

Os geradores executados por pretest/prebuild não produziram mudanças adicionais nos assets públicos rastreados.

Revisão estática adicional não encontrou bloqueadores críticos/altos. Risco médio preexistente: o ID de corrida usa seed fixa/tempo/score e pode colidir em repetições idênticas, suprimindo créditos duplicados. Não afeta a integridade dos arquivos salvos.

## Baseline de dano e arte

Início → `enterStage` restaura três vidas/equipamento → fontes de colisão convergem em `hurtPlayer` → cada impacto hoje conta como morte, reduz POWER, reposiciona e concede proteção → vidas zero geram derrota → Continue/checkpoint e resultados alimentam progresso, perfil, ranking e saves.

Fenda usa sprites RIVET UP de 256×256, 7 colunas de inclinação e 4 linhas de animação em `public/assets/arcade/pelagic-review/rivet-up-sheet.webp`. Solar usa os frames laterais aprovados de `public/assets/arcade/rivet.webp`, também 256×256; renderização lateral de 42×34 unidades. Colisão é independente da apresentação (núcleo elíptico 5×7 mais raio do projétil). Os sprites aprovados serão preservados; danos devem usar camadas adicionais.

Pontos obrigatórios para a próxima branch: estado de casco separado de vidas clássicas, impactos separados de destruições, recordes por regra, dados explícitos em carry/checkpoint/replay, sem trocar piloto por Nolan ao retomar checkpoint. Os pilotos alternativos já possuem armas/especiais no mundo, mas a cena atual ainda usa a silhueta RIVET com tintas distintas; isso não constitui arte própria final das cinco naves.
