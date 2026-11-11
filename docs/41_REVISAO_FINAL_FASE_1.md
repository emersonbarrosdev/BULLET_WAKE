# Fase 1 — elenco e correções após a auditoria

Revisão de 11/11/2026. Esta entrega continua restrita à Fenda Pelágica. A produção das fases seguintes depende da aprovação do usuário.

## Elenco vigente

Ordem de seleção: **Bayek, Tita, Leona, Osvald e Hien**.

| Piloto | Direção do retrato | Conjunto preservado |
|---|---|---|
| Bayek | Egípcio, cabelo curto encaracolado, barba curta; protagonista | RIVET e todo o armamento antes associado a Terry |
| Tita | Ruiva de cabelo cobre, traje ameixa | MOTH / ondas verdes / Salto Fantasma |
| Leona | Mulher negra brasileira, tranças e traje jade | KESTREL / azul concentrado / Coroa Orbital |
| Osvald | Russo, veterano, barba grisalha e headset laranja | KNUCKLE / rubro / Ruptura Nova |
| Hien | Japonês, máscara e capacete escuros, cachecol vermelho | PEREGRINE e conjunto antes associado a Bento |

Pesquisa visual de Hien: [site oficial Sonic Wings Reunion](https://swr.success-corp.co.jp/) e [arte oficial consultada](https://swr.success-corp.co.jp/wp-content/themes/swr_v1_2_2/img/_spotlight/chara_hien.webp). A referência orienta o retrato; não altera a PEREGRINE. Hien ocupa a vaga secreta, ainda visível no desenvolvimento. Código futuro: **WAKEHIEN**. Bayek permanece disponível desde o início.

IDs persistentes de nave foram mantidos, evitando trocar recordes/progresso entre conjuntos. Perfis, HUD, história de missão, epílogos, acessibilidade e Bíblia usam os novos nomes. Motivações continuam pessoais, com identidade egípcia/brasileira/russa/japonesa registrada nas histórias e perfis.

Prompts: [retratos](42_PROMPTS_IDENTIDADES.json) e [combate](43_PROMPTS_COMBATE_FINAL.json). As imagens finais estão integradas ao projeto; nenhuma depende do diretório da ferramenta.

## Correções do combate

1. **Silhuetas individuais:** todas as cinco naves têm sprites de combate. MOTH e KNUCKLE receberam quatro frames próprios em visão superior. Projéteis, contato físico e coleta usam o casco real da nave, com concavidades e exclusão das chamas. Máscaras são lidas uma vez por frame e reutilizadas.
2. **Talassarca:** impactos locais danificam somente a parte realmente atingida. Excedente não é transferido à próxima peça. Núcleo exposto e seis partes são alvos separados; a casca permite passagem dos tiros até as armas/órgãos. Especiais usam orçamento de área explícito. Destruir uma peça interrompe seus ataques, sem apagar automaticamente todas as balas já emitidas.
3. **Especiais:** Leona ganhou lanças jade próprias; Hien, falcões de energia. Orçamento de 120 contra o chefe distribuído pelos impactos, sem dano instantâneo na ativação. Tita deixa a imagem da MOTH real e causa três pulsos de fase. Nova tem dano ligado à detonação. Proteção comum de 1,8 s; tempo visual não concede invulnerabilidade adicional.
4. **Metamorfose:** sequência desenhada de rachaduras, casca abrindo, fragmentos separados e organismo interno exposto, com mistura entre frames. Retirado o piscar de transparência. Entrada interna mantém a mudança de padrões e corredor de esquiva.
5. **Destruição:** mapa de dano em coordenadas locais determina a detonação final maior. Inimigos grandes usam explosões escalonadas também no choque; corpos dissipam rapidamente. Armas do chefe desaparecem junto da destruição.
6. **Normal:** a segunda metade amplia a pressão dos batedores; emboscadores aquáticos têm um padrão diferente das torres. Avisos e intervalo entre ataques permanecem. Compensação de dano efetivo da RIVET/PEREGRINE em chefes reduz a diferença causada pelo leque; rubro foi moderado contra Raia-Dente. Não se aumentou a quantidade de suprimentos.
7. **Progressão:** onze caixas, nove P/uma vida/um especial. Guia normal mostra apenas esses itens. Testes verificam perder um, dois ou três P, recuperação e viabilidade do Continue para cada armamento. Recuperação compara o marco completo (nível + progresso P), evitando combinar o nível de um item com o medidor de outro e inventar potência extra.
8. **Rádio:** Continue preserva mortes, intervalos e sacos de falas restantes. Gatilhos de pressão/medo ajustados à população real da fase. A fala de vitória também fica no resultado, sem desaparecer com a transição.

## Áudio

Três arranjos originais ampliados para 48 compassos: aproximadamente 98 s no menu, 81 s no oceano e 74 s no chefe. Piano, guitarras, baixo, cordas e bateria acústica amostrada; introdução mais contida, respostas melódicas, ponte e retorno da banda. Fontes/licença permanecem em [relatório de produção](39_ELENCO_COMBATE_AUDIO.md) e [GeneralUser GS](licenses/GeneralUser-GS.txt).

Canhão humano usa quatro transientes autorais pré-renderizados e reutilizados, com ataque mecânico/corpo grave em vez de sobrepor três pequenos estalos por salva. Explosões receberam ataque e grave em camadas; ataques alienígenas ficam abaixo do canhão na mistura. Os efeitos continuam síntese autoral; não são gravações de Sonic Wings. Pausa retém o cursor musical, inclusive quando o buffer ainda está sendo carregado. Ambiente espacial continua silenciando todo o áudio.

Metadados de duração e níveis: [score.json](../public/assets/audio/score.json). Pico PCM de renderização de −1,21 dBFS; RMS das três trilhas entre aproximadamente −17,2 e −16,5 dBFS. Isso verifica níveis técnicos, não substitui aprovação auditiva.

## Validação

- Testes automatizados: **180 passaram**. Build de produção aprovado; permanece o aviso de tamanho do bundle Phaser.
- [Capturas e relatório do navegador](screenshots/phase1-final/validation.json): 1366×768 e 1920×1080, cinco perfis, fluxo de missão, HUD, pausa, controles, saída, finais pessoais e armas próprias. Sem scroll/cortes ou erros de navegador na rodada visual.
- Medições de combate usam os sprites e sistemas da cena, com passos de 20 ms. Travessias completas usam entrada automatizada, disparo, movimento, coleta, esquiva e especiais; sem alterar vida, potência, HP dos inimigos ou invulnerabilidade. O relógio de tweens é sincronizado ao passo da simulação.
- Confrontos isolados medem eficiência dos armamentos sem especiais. Eles não equivalem a uma partida humana nem a uma conclusão de equilíbrio competitivo.

Travessias finais com os cinco pilotos (tempo de gameplay simulado; inclui chefes e mortes, sem Continue nessas cinco rotas):

| Piloto | Duração | Mortes | Potência ao concluir |
|---|---|---|---|
| Bayek | 3min21s | 2 | NV4 |
| Tita | 3min22s | 1 | NV4 |
| Leona | 3min17s | 2 | NV4 |
| Osvald | 3min47s | 2 | NV4 |
| Hien | 3min26s | 1 | NV4 |

A rota adicional de Bayek orientada a evitar três P deixou **dois efetivamente sem coleta**, concluiu em aproximadamente 3min30s e terminou no NV3. O relatório distingue intenção da política de teste e coleta real; não apresentar essa rota como perda confirmada de três P. A perda exata de um/dois/três P é coberta pelos testes puros de progressão.

Continue foi exercitado depois de três mortes: retomou com três vidas, preservou três mortes no rádio e não repôs especiais gratuitamente. Controle virtual: movimento, disparo, consumo de especial e pausa confirmados. Música ficou no mesmo cursor durante a pausa e retomou com uma única fonte. Água avançou dois segundos com scroll fixo. P95 da atualização nas travessias ficou abaixo de 1 ms nesta execução; **não é uma medição do FPS/renderização completos**.

O teste da água usava inicialmente igualdade exata para um número de ponto flutuante (resultado 1999,9999999999998 ms). A asserção foi corrigida para tolerância e a verificação da água foi repetida; os resultados anteriores de telas/rotas/áudio/controle foram preservados no mesmo relatório.


## O que ainda exige avaliação humana

- Aprovar a arte, os novos retratos e a metamorfose em movimento.
- Jogar a Fase 1 para avaliar diversão, risco da coleta e balanceamento entre pilotos. O teste automatizado comprova funcionamento e mede situações reproduzíveis, sem substituir esse julgamento.
- Ouvir música, tiro e explosões durante uma partida para aprovar timbre, melodia e mistura.
- Validar uma partida com controle físico. O teste de entrada padrão no navegador usa um controle virtual.

Nenhuma aprovação da Fase 1 ou liberação da Fase 2 é inferida destes testes.
