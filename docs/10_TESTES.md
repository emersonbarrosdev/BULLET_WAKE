# 10 — Bíblia de testes e definição de pronto

Todo item só vira "feito" quando houver código/arte real, teste e evidência. Lint, typecheck, build, smoke de gameplay e inspeção visual a cada tarefa. A cada **10 tarefas**, executar regressão geral antes de seguir.

## Matriz
| ID | Caso | Aceite |
|---|---|---|
| MOV-01 | segurar cima/baixo | silhueta inclina com frames realmente diferentes |
| MOV-02 | diagonal | mesma velocidade resultante que direções cardinais |
| MOV-03 | voltar a idle | pivô não salta, motor segue animado |
| MOV-04 | alt-tab / background | nenhum teleporte por delta excessivo |
| SPR-01 | 3 naves em grayscale | silhuetas reconhecíveis |
| SPR-02 | alternar todos estados | nenhuma animação com frames clonados |
| SPR-03 | disparo em subida/descida | muzzle acompanha canhão |
| SPR-04 | export | PNG alpha, fonte editável, frames+manifesto |
| HIT-01 | receber tiro | -1 integridade, i-frame funcionando |
| HIT-02 | HP=0 | -1 vida, destruição só uma vez |
| HIT-03 | hits simultâneos | sem dano duplo em invulnerabilidade |
| COL-01 | dash Moth em parede | nunca atravessa sólido |
| WPN-01 | upgrades | exatamente LV1–3 |
| SPC-01 | Nolan | rajada leque correta, sem travar nave |
| SPC-02 | Cora | dash com tempo/colisão justos |
| SPC-03 | Harlan | limpa balas só dentro do alcance |
| ENM-01 | spawn | nenhum inimigo nasce sobre jogador |
| ENM-02 | IA | todos ataques têm telegraph e recuperação |
| BOS-01 | módulos | partes quebráveis sem hit duplicado |
| BOS-02 | boss com 3 pilotos | vencível por todos, com espaço de esquiva |
| HUD-01 | mobile | controles não bloqueiam a nave |
| SAVE-01 | checkpoint | não duplica score/pickups |
| SAVE-02 | persistência | save versionado e recuperável |
| FX-01 | grande explosão | projéteis perigosos legíveis |
| AUD-01 | troca de foco | sem áudio duplicado |
| PERF-01 | ondas densas | 60 FPS como meta medida, sem picos graves |
| END-01 | vitória | epílogo correto por piloto |

## Testes de arte
Verificar sprites 1x/2x/4x, fundo claro/escuro, grid, alfa, colisão visual honesta, frames separados, rastro sem flicker e partículas que não mascaram hazards. Fazer screenshots/vídeos de cada estado; rejeitar placeholders antes de release.

## Gates
Gate T10: 1min jogável e vídeo. T20: 2min com três pilotos. T30: 5min + especiais + miniboss. T40: 10min fase 1 + boss + saves; T50/T60 demais fases. T70: build release PC e Android + QA e performance. Registrar resultado com data, plataforma, versão, evidência e bugs.

## Bloqueadores
Qualquer nave inacessível, boss impossível com um piloto, hitbox injusta, perda de save, crash mobile, arte placeholder no build final, bala invisível ou FPS insuficiente sem plano. Não declarar QA concluído só por escrever este arquivo.
