# Reformulação arcade — implementação e validação

13/11/2026. Escopo: as duas missões do [brief aprovado](54_DIRECAO_ARCADE_APROVADA.md), priorizando Fenda Pelágica antes de Cidade Solar. Esta revisão substitui a direção biomecânica anterior. [Bíblia atual](27_BULLET_WAKE_V2_DEFINITIVO.md).

## Entrega

- Nova identidade cartoon/anime, logo em seis versões, abertura animada pulável, seleção de piloto e missão, HUD, pausa, controles, opções, vitória, resultados, derrota e encerramento.
- Bayek/RIVET jogável em UP e SIDE, com sprites próprias, três motores e poses de inclinação. Tita, Leona, Osvald e Hien mantêm identidade, registros e novos retratos; não são selecionáveis nesta etapa.
- Motor compartilhado com movimentos, formações, tiro, recursos, coleta, dano e progresso. Conteúdo de cada missão é autoral, com perspectivas e obstáculos diferentes.
- Dez famílias: caça, interceptador, acrobata, bombardeiro, lancha, navio, tanque, torre, dirigível e disco alienígena. Articulações de armas terrestres/naval, hélices, quedas e explosões em camadas. Todos os tiros hostis são esféricos.
- Rajada de três pulsos, opção acessível, evolução NV1–FULL e mísseis automáticos preservando o tiro vermelho aprovado. Tormenta Escarlate aplica dano no contato com o alvo real.
- Onze caixas por roteiro, perda real de potência ao morrer, recuperação de um P comum, limites cinco vidas/especiais e excedentes em pontos. Passagem para Cidade Solar conserva exatamente o estado obtido na Fenda.
- Normal e Difícil; no Difícil, escoltas extras e cadências mais intensas sem aumentar HP. LOW/MED/HIGH afetam decoração, não simulação.
- Oito músicas originais para doze contextos, efeitos curtos cartoon e canhão principal preservado. Música inicia em 18%, com ganho de mixagem 0,52; efeitos à frente. Volume configurável e pausa com cursor preservado.

## Chefes e cenários

**Fenda Pelágica / UP:** mar tropical animado em camadas, costa, arquipélago, aceleração, patrulha naval, fenda e aproximação final. Miniboss naval com três alvos. Encouraçado Pula-Onda: três canhões, fuga, cinco segundos ausente, retorno ampliado com seis canhões; leques, pares mirados, salvas rápidas e grandes esferas radiais, com aviso e recuperação. O mar permanece animado na arena parada.

**Cidade Solar / SIDE:** horizonte urbano, parallax, pontes, portões, área industrial, barreiras destrutíveis e altitude. Miniboss transportador. Mega Dirigível Giro: hélices, deslocamento vertical, canhões independentes, leques escalonados, salvas oscilantes e ataque pesado mirado em três esferas. Não reutiliza a fuga nem o ataque radial naval. Destruição com inclinação, explosões e saída da RIVET.

O casco dos chefes não consome tiros destinados às armas e não distribui dano ao canhão mais próximo. Canhões destruídos param de atirar. Colisão dos inimigos usa alpha da sprite em produção; testes do modelo puro usam aproximação geométrica, por isso seus resultados não são intercambiáveis.

## Duração medida

Partidas completas automatizadas no navegador, usando a simulação real e colisão alpha das sprites. O bot movimenta, atira, tenta coletar, esquiva e usa especiais; não recebeu invulnerabilidade ou potência extra nestas duas partidas. A execução foi acelerada, portanto os tempos abaixo são do **relógio do combate**, não tempo de parede nem partidas humanas. Intro e saída automática ficam fora desse relógio.

| Missão | Duração de combate | Mortes | Saída |
|---|---:|---:|---|
| Fenda Pelágica | 340,758 s — aproximadamente **5min41s** | 1 | 3 vidas, NV1 + 1P, 0 especiais, 62.330 pontos |
| Cidade Solar | 347,892 s — aproximadamente **5min48s** | 1 | 3 vidas, NV3 + 1P, 0 especiais, 115.430 pontos |

A Cidade Solar começou com **3 vidas, NV1 + 1P, zero especiais e 62.330 pontos**, exatamente como a primeira terminou. Ambas ultrapassam cinco minutos sem depender de telas de loading. A duração humana pode variar conforme mortes, coleta e precisão nos módulos. [Evidência estruturada](screenshots/cartoon/browser-report.json).

## Testes executados

**224 testes passaram, zero falhas:** 207 regressões legadas preservadas e 17 testes da nova implementação. Incluem rajadas e cadência acessível, limites e excesso, perda/recuperação de potência, colisão alpha rejeitada, acertos reais em módulos, superfície sem colisão física, avisos, ausência de cinco segundos, especial frontal com dano limitado, mísseis FULL, save entre fases, dados inválidos, escoltas do Difícil, obstáculos, mix padrão, saída automática e diferença entre especiais dos chefes.

`npm test` com pré-geração de assets foi executado; após as correções finais, a suíte completa foi repetida com `node --experimental-strip-types --test tests/*.test.mjs`. TypeScript e build Vite passaram. Há aviso de tamanho do bundle principal: aproximadamente 1,668 MB minificado / 452 kB gzip, incluindo Phaser e compatibilidade legada; não houve erro de build. Não existe script de lint separado neste projeto.

O navegador de produção verificou:

- Carregamento dos atlas e áudio sem erros JavaScript ou falhas de recursos registradas.
- Teclado, movimentação/tiro/pausa por **controle virtual padrão**.
- Touch emulado: pressionar/soltar tiro, joystick, especial e pausa.
- Pausa congela relógio; desbloquear áudio/navegar em controles não reinicia música.
- Retorno do Pula-Onda, combate completo das duas missões e persistência exata dos recursos.
- Resultado, encerramento, Game Over, tentar novamente, cancelar saída e confirmar saída.
- Saída automática completa da nave, sem projéteis congelados nos resultados.
- Capturas em 1366×768 e interface compacta 854×480, sem corte dos menus verificados.

Durante a validação foram corrigidos: sobrescrita do snapshot da Fenda pela Cidade Solar; música religando na pausa; recortes com fragmentos vizinhos; ilhas ultrapassando a arena; tiros residuais no resultado; saída lateral curta demais. A primeira tentativa do teste touch habilitava emulação depois do boot do Phaser; o harness foi corrigido para habilitar antes da inicialização, como ocorre em um navegador touch real.

## Desempenho

Chrome headless, WebGL/ANGLE, AMD Radeon integrada (0x1681), Direct3D11, viewport 1366×768, deviceScaleFactor 1. Amostras de oito segundos **em tempo real** por perspectiva/qualidade, com chefe, horda de bombardeiros, FULL e especial. Estas amostras não são a simulação acelerada usada para medir as partidas.

| Cenário | FPS observado | Frame mediano / p95 | Pico de projéteis |
|---|---:|---:|---:|
| Fenda LOW | ~59,9 | 16,7 / 16,8 ms | 81 |
| Fenda HIGH | ~59,8 | 16,7 / 16,8 ms | 81 |
| Cidade LOW | ~59,8 | 16,7 / 16,8 ms | 155 |
| Cidade HIGH | ~59,8 | 16,7 / 16,8 ms | 155 |

Heap JS nas amostras: aproximadamente 21–37 MB, sem incluir VRAM. Pool de 640 projéteis e reaproveitamento de sprites de efeitos. [Medições completas](screenshots/cartoon/performance-report.json). Não extrapolar esses resultados para Android ou outros computadores.

## Áudio

Oito OGG estéreo a 44,1 kHz decodificados integralmente: zero amostras clipadas ou valores inválidos. Pico máximo medido abaixo de 0,80. Volume de transporte inicial confirmado em 0,0936 (18% × 0,52). [Validação dos arquivos](screenshots/cartoon/audio-validation.json), [procedência e licença](56_ARCADE_ASSETS.md). Os testes de transporte/mix e análise de arquivos não equivalem a escuta humana comparativa.

## Limitações e próximos critérios de aprovação

1. Aprovação artística e sonora pelo jogador continua pendente; não alegar que o bot ouviu ou julgou emoção, timbre ou diversão.
2. Controle físico e Android real não foram testados. Há adapter padrão e touch funcional emulado, mas não há medição de GPU móvel, latência física ou APK publicado nesta entrega.
3. Balanceamento foi exercitado por bot e testes de mecânicas; precisa de sessões humanas com diferentes níveis de habilidade. A tentativa automatizada sem usar especial perdeu na Fenda, o que indica pressão, não comprova por si só um Normal ideal.
4. Campanha completa, armas dos demais pilotos no novo motor, sexto piloto, Remix e três fases secretas são planejamento preservado. Nenhum desses conteúdos é declarado entregue.
5. O bundle pode futuramente separar cenas legadas por carregamento sob demanda. A medição atual indica fluidez no equipamento testado, não elimina essa oportunidade.

## Capturas

[Menu](screenshots/cartoon/title.webp), [pilotos](screenshots/cartoon/pilots.webp), [missões](screenshots/cartoon/missions.webp), [Pula-Onda](screenshots/cartoon/phase1-boss.webp), [retorno ampliado](screenshots/cartoon/phase1-return.webp), [Cidade Solar](screenshots/cartoon/phase2-city.webp), [Giro](screenshots/cartoon/phase2-boss.webp), [resultado da Fenda](screenshots/cartoon/result-phase1.webp), [resultado da Cidade](screenshots/cartoon/result-phase2.webp), [interface touch compacta](screenshots/cartoon/compact-touch.webp).

Publicação prevista nesta revisão: branch `master`, por push normal, sem force. O hash confirmado é informado na entrega; o relatório faz parte do próprio commit.
