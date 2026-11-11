# Fase 1 — chefe integrado, RIVET FULL, escala e nu metal

Revisão de 11/11/2026, posterior à [revisão do elenco](41_REVISAO_FINAL_FASE_1.md). Escopo: somente Fenda Pelágica. Não representa aprovação artística ou sonora do usuário nem liberação para produzir outras fases.

## Mudanças entregues

### Talassarca: anatomia e alvos reais

As três baterias fazem parte das duas artes completas do organismo. Foram removidas as pequenas torres independentes e as marcas ciano sobre os órgãos. As novas sheets possuem quatro frames registrados: repouso e brilho das baterias esquerda, direita e central. As peças destruídas deixam uma área carbonizada na própria superfície; não reaparecem como armas funcionando.

Arquivos finais: [casca integrada](../public/assets/combat-hd/talassarca-integrated.webp) e [forma interna integrada](../public/assets/combat-hd/inner-integrated.webp). [Prompts e registro das imagens](45_PROMPTS_TALASSARCA_INTEGRADO.json). Geração/edição pelo image_gen nativo; montagem em quatro células de 512 px preservando o alfa.

Cada camada tem seis alvos anatômicos: três órgãos e três baterias. A colisão recorta a região da peça sobre o alfa do frame real, respeitando seus vazios. O casco fora dessas regiões permite passagem dos tiros; a nave pode sobrevoá-lo. Um disparo vindo de baixo pode alcançar uma bateria dorsal sem ser consumido pela cauda ou por um círculo invisível no centro.

O identificador da peça acompanha o contato até a aplicação do dano, inclusive no laser largo. Não se repete o teste de um laser com o raio menor de uma bala. Peças destruídas deixam de bloquear e disparar. Dano excedente de um tiro não passa a outra peça. HP da camada é a soma do HP das peças: 6×100 na casca e 6×60 na forma interna. O dano de área do especial distribui seu orçamento entre os alvos vivos; mantém a referência autoral de cinco/três especiais. A metamorfose de 2,4 s continua impedindo transferência de dano entre camadas.

### RIVET: cinco níveis próprios

| Estado | Tiros por salva | Mísseis automáticos | P para a próxima melhoria |
|---|---:|---|---:|
| NV1 | 1 frontal | nenhum | 2 |
| NV2 | 2 paralelos | nenhum | 2 |
| NV3 | 3 direções | 2 juntos | 2 |
| NV4 | 3 pares / 6 tiros | 2 juntos | 3 |
| NV5 / FULL | 7 tiros encorpados | 3 guiados | máximo |

Os nove P do roteiro continuam suficientes para chegar a FULL, sem aumentar as onze caixas existentes. NV3/NV4 lançam mísseis a cada 1,5 s; FULL, a cada 1,1 s. Os guiados procuram inimigos ou peças vivas à frente e têm velocidade de giro limitada. A cadência principal permanece rápida segurando o botão. Os projéteis partem da posição atual da nave.

Os demais conjuntos mantêm quatro estados, com três P por melhoria. Não há troca obrigatória de cores: verde pertence à MOTH, rubro à KNUCKLE. HUD, guia, limite de potência e recuperação usam a regra da nave. FULL recupera potência por até três marcos físicos sem duplicar P.

As quantidades seguem os prints e a orientação do usuário. Tempos, dano e limiares de P são calibração de Bullet Wake; não são valores alegadamente extraídos de uma ROM de Sonic Wings.

### Escala e abertura

Naves: arte de 40 para 34 unidades, redução de 15%, com limites de movimento ajustados. Inimigos comuns e portadores: redução de 12%. O alfa útil da nave ocupa menos que o retângulo da sheet. Arena, laterais e tipografia foram preservadas. O chefe mantém ocupação útil próxima de 80%/100% da largura do corredor nas duas camadas.

A abertura usa enquadramento que contém a composição inteira. Em proporções diferentes da arte, surgem áreas de respiro em vez de cortar logotipo, nave ou assinatura. Verificado em 1366×768, 1920×1080, 2560×1080 e 1280×1024. Os botões continuam ancorados à mesma composição.

### Música: substituição da fonte e do arranjo

A primeira tentativa com guitarra General MIDI foi rejeitada pelo usuário. Os timbres de guitarra desse banco foram substituídos por gravações de humbuckers da **Unreal Instruments METAL-GTX**. A trilha usa palhetadas down/up, round robins, palm mute e sustentações reais, com gravações independentes à esquerda e à direita.

Novos riffs graves em B/F♯, síncopes, pausas secas e respostas melódicas curtas substituem os solos anteriores. Processamento: sobreamostragem 4×, quatro estágios não lineares, resposta de gabinete 4×12 gravado e filtragem. Baixo e bateria acústica amostrada permanecem na instrumentação; intervenções de scratch são pontuais. Não há melodias nem gravações de Slipknot ou dos jogos de referência.

Retorno posterior do usu?rio: a guitarra pesada foi aprovada; a guitarra aguda de resposta foi rejeitada. A base r?tmica, seu timbre e as partes de baixo/bateria foram preservados. A resposta foi baixada uma oitava, encurtada e reduzida em aproximadamente 5,4 dB, com corte suave de brilho em 3,8 kHz. Mant?m papel de refor?o m?dio/grave, sem solo agudo sobre a base.

Refer?ncia instrumental consultada: [Rig Rundown com Mick Thomson e Jim Root](https://www.premierguitar.com/videos/rig-rundown/slipknot), incluindo afina??es graves e configura??o de guitarras/amplifica??o; [entrevista de est?dio com os dois guitarristas](https://www.musicradar.com/news/guitars/slipknots-mick-thomson-and-jim-root-talk-gear-tone-and-being-flat-broke-580682). A aplica??o ao jogo ? uma decis?o de arranjo original: guitarras r?tmicas graves em primeiro plano, baixo e bateria ac?stica sustentando o pulso, respostas curtas e scratches pontuais. N?o ? uma reprodu??o de grava??es da banda.

Arquivos: [menu](../public/assets/audio/menu.ogg), [Fase 1](../public/assets/audio/stage1.ogg), [chefe](../public/assets/audio/boss.ogg). [Metadados de produção e medidas](../public/assets/audio/score.json). A aprovação auditiva continua dependendo de escuta do usuário, não das medidas de volume.

Produção: [composição](../scripts/compose-score.py) e [renderização](../scripts/render-heavy-score.py). Banco de guitarra, SoundFont e ferramentas ficam no diretório local ignorado `tmp/audio-tools`, não no pacote do jogo. A versão final inclui apenas os arranjos OGG. Para reproduzir a renderização, obter METAL-GTX pelo [site do autor](https://unreal-instruments.wixsite.com/unreal-instruments/metal-gtx), extrair `Mute_Down`, `Mute_Up`, `Sus_Down`, `Sus_Up` e `Pick_Scratch` para `tmp/audio-tools/metal/UI_METAL-GTX/Samples`; manter as ferramentas FluidSynth/FFmpeg e GeneralUser GS usadas na produção anterior. IRs: [repositório da fonte](https://github.com/averagenative/0xFX/tree/master/resources/ir/bundled).

Avisos preservados: [METAL-GTX](licenses/METAL-GTX.txt), [gabinetes](licenses/4x12-IR.txt), [GeneralUser GS](licenses/GeneralUser-GS.txt). As amostras brutas de guitarra não são redistribuídas.

## Referências consultadas e limites

- [Documentação oficial Toaplan de Fire Shark](https://www.toaplangames.co.jp/en/license/license-09.html): diferencia contato com inimigos aéreos e sobrevoo de alvos terrestres/marítimos; explica cores independentes e evolução por P. Essa regra não significa uma cascata azul→verde→vermelho.
- [Manual original Aero Fighters, versão SNES, digitalização](https://manuals.plus/m/a161d0191efce5685e3a7c11d1757c8423ec42c8fa2fa398412bb7d8fe4493ed): tiro, estoque de especial, P/F/1UP, armamentos por aeronave e chefes de grande porte. É uma versão diferente do arcade e não fornece todos os números de dano/cadência/geometria.
- Os prints enviados pelo usuário orientam os cinco estados da RIVET. Não foi realizada uma medição quadro a quadro de uma ROM para alegar equivalência numérica completa.

## Verificação e pendências

Evidência de navegador: [resultado completo](screenshots/phase1-rivet5/validation.json) e [capturas](screenshots/phase1-rivet5/). O teste foi executado sobre o build real, com colisões da cena e coleta física de itens.

As seis rotas automatizadas incluíram os cinco pilotos e uma rota adicional de Bayek tentando evitar P. Todas concluíram a fase. A política adicional tentou evitar três itens, mas perdeu efetivamente somente um; não deve ser apresentada como partida completa sem três P. Há testes de progressão para perder um, dois e três itens. P coletados de recuperação são contados separadamente da existência das nove caixas do roteiro.

Tempos observados ficaram entre aproximadamente 3min15s e 3min41s, com mortes e recuperação em algumas rotas. São resultados de uma estratégia automatizada, não uma garantia de duração ou aprovação da dificuldade Normal. A necessidade de mirar nas partes do chefe passou a fazer parte da estratégia.

Ainda precisam de avaliação humana: sensação de peso da nova guitarra e mistura com SFX, leitura das partes do chefe durante combate e satisfação com a escala. O controle virtual teve regressão de movimento, disparo, especial e pausa; a validação física será registrada apenas após ler a evidência do teste com o dispositivo real. O [painel local de teste físico](../scripts/controller-check.html) usa a gameplay real e `navigator.getGamepads`, sem sobrescrever a API.
