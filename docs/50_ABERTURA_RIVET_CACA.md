# Abertura — RIVET atualizada

Revisão de 11/11/2026. Complementa a [revisão da nave e especial](48_RIVET_CACA_TORMENTA_ESCARLATE.md).

A abertura usa o caça atual da RIVET, branco e escarlate, com dois motores, fuselagem fina e estabilizadores separados. O eixo ficou vertical e as asas niveladas. A envergadura ilustrada caiu de aproximadamente 49% para 32% da largura da arte: mais espaço para o cenário, sem perder a identidade do protagonista. A perspectiva de apresentação é ilustrada; a gameplay continua ortográfica superior.

Foi mantida a nave ilustrada porque ela comunica a identidade do caça e conversa com a pintura existente. Uma silhueta apagaria detalhes que acabaram de ser aprovados. Logotipo, fortaleza, alienígena, oceano e assinatura do estúdio foram preservados. O menu de duas opções já não tinha nave e continua com sua arte e áreas clicáveis originais.

## Asset e integração

- [Arte final](../public/assets/title/title-rivet-hornet.webp): 1672×941, 363.078 bytes, WebP de qualidade 94.
- Edição com **image_gen nativo**, usando a abertura anterior como alvo e a sheet aprovada do caça como referência. Somente conversão PNG→WebP fora da ferramenta, sem pintura ou composição adicional.
- [Prompt exato e caminhos](51_PROMPT_ABERTURA_RIVET.json).
- Abertura e fundos compartilhados da seleção/resultado apontam para o asset novo. A imagem antiga permanece no histórico.

## Verificação

Build/TypeScript aprovados; permanece o aviso conhecido de tamanho do bundle Phaser. A [verificação no navegador de produção](screenshots/title-hornet/validation.json) cobre 1366×768, 1920×1080, 2560×1080 e 1280×1024: arte inteira sem cortes nem deformação, imagem decodificada, botões dentro da tela, acesso por Enter, opções, controles, retorno e seleção dos cinco pilotos. Zero erros de navegador.

[Captura da abertura](screenshots/title-hornet/attract-1366x768.webp) · [Captura do menu](screenshots/title-hornet/main-1366x768.webp).

Esta revisão é de apresentação. Mecânicas, escala de combate, músicas e efeitos sonoros não foram alterados.
