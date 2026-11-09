# Correção final dos assets de seleção de pilotos

Data: 09/11/2026. Diretriz canônica: [Bíblia V2, seção 8](27_BULLET_WAKE_V2_DEFINITIVO.md#8-seleção-de-pilotos--correção-final-dos-assets-09112026).

## Arquivos finais

| Asset | Arquivo | Formato |
|---|---|---|
| RIVET independente | [ship-nolan.webp](../public/assets/pilot-selection/ship-nolan.webp) | 606×330, WebP com alfa |
| Nolan ilustrado | [portrait-nolan.webp](../public/assets/pilot-selection/portrait-nolan.webp) | 768×1152, WebP |
| Cora ilustrada | [portrait-cora.webp](../public/assets/pilot-selection/portrait-cora.webp) | 768×1152, WebP |
| Harlan ilustrado | [portrait-harlan.webp](../public/assets/pilot-selection/portrait-harlan.webp) | 768×1152, WebP |

Produção com a ferramenta integrada `image_gen`, uma geração por asset. Referências locais já existentes no projeto; sem imagens externas. Conversão para WebP com FFmpeg. A RIVET teve apenas margens transparentes normalizadas para igualar a ocupação visual das outras naves; sua pintura é nova. Moth e Knuckle foram mantidas como referências do conjunto. A key art de abertura permanece intacta.

## Conjunto de prompts finais

### RIVET — stylized-concept

Asset isolado de nave para o menu de seleção de pilotos do BULLET WAKE. Referência 1: RIVET anterior, somente identidade; referências 2 e 3: Moth e Knuckle, para enquadramento, ponto de vista, luz superior esquerda, contraste e densidade de detalhes. Criar pintura independente, sem reutilizar pixels ou reproduzir a composição promocional. Casco branco, painéis vermelhos, canopy âmbar, asas angulares agressivas e exatamente três propulsores traseiros distintos. Vista elevada em três quartos, frente à esquerda/baixo e traseira à direita/cima. Nave inteira, margem livre, fundo transparente, proporção horizontal aproximada 1,85:1. Pintura sci-fi de detalhes moderados, realces contidos e silhueta nítida. Brilho laranja curto nos bocais; sem chamas longas, moldura, cenário, texto ou marca-d'água.

### Nolan — style-transfer / identity-preserve

Repintar o retrato existente em ilustração concept art de arcade 2D premium, painterly 2.5D. Preservar o mesmo rosto jovem, cabelo preto desalinhado, sobrancelhas fortes, cicatriz diagonal, expressão determinada, pose em três quartos, traje preto de gola alta com acabamento vermelho e alças cinzentas. Retrato vertical 2:3, cabeça e parte superior do peito. Pele fosca, pinceladas largas de guache visíveis, sombras angulares simplificadas, contornos seletivos, massas de cabelo pintadas e tecido ilustrado. Luz vermelha lateral contida e fundo bordô pintado. Reduzir brilho da pele e volume suavemente renderizado. Sem 3D, pele fotográfica, superfícies enceradas/plásticas, poros, realces de aerógrafo, texto, borda ou UI.

### Cora — style-transfer / identity-preserve

Repintar o retrato existente usando o novo Nolan apenas como referência de técnica, pincelada, contraste e acabamento. Preservar o mesmo rosto feminino adulto, cabelo branco curto ao vento, sobrancelhas escuras, cicatriz diagonal, expressão confiante, pose em três quartos, traje escuro de gola alta com acabamento roxo/magenta e alças. Retrato vertical 2:3, cabeça e parte superior do peito. Pele fosca, guache visível, sombras gráficas angulares, contornos seletivos e cabelo/tecido pintados. Luz magenta contida e fundo bordô/ameixa pintado. Diminuir fortemente os reflexos da bochecha e nariz. Sem 3D, fotorealismo, pele plástica/encerada, gradientes de aerógrafo, texto, borda ou UI. Não adotar gênero, cabelo ou cores do uniforme de Nolan.

### Harlan — style-transfer / identity-preserve

Repintar o retrato existente usando o novo Nolan apenas como referência de técnica e acabamento. Preservar o mesmo homem maduro, careca, rosto largo, barba curta grisalha, cicatriz diagonal, olhar severo para cima, pose em três quartos, dispositivo circular luminoso laranja na orelha e armadura preta pesada com inserto laranja no peito. Retrato vertical 2:3, cabeça e parte superior do peito, margem sobre o couro cabeludo. Pele fosca inclusive na cabeça, pinceladas largas de guache, sombras gráficas angulares, barba e armadura pintadas. Luz âmbar contida e fundo bordô/umbra pintado. Luz tecnológica confinada aos equipamentos. Sem 3D, pele fotográfica, sombreamento plástico, poros, aerógrafo, cabeça brilhante, texto, borda ou UI. Não adotar cabelo ou acabamento vermelho de Nolan.

## Verificação reproduzível

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado; aviso preexistente de bundle acima de 500 kB.
- `npm test`: 125 aprovados, zero falhas.
- `node scripts/validate-pilot-selection.mjs`: aprovado no build de produção, Chrome headless real, com as duas resoluções e os três perfis.
- [Capturas reais](screenshots/pilot-selection-final/) inspecionadas: conjunto coerente de naves, RIVET sem aparência de recorte, retratos ilustrados, controles visíveis e espaçamentos preservados.
- [Relatório de medidas](screenshots/pilot-selection-final/validation.json): comparação exata com a geometria anterior aprovada, zero rolagem/cortes/overflow e zero erros de navegador.

O teste de geometria lê o CSS do commit em `HEAD` como referência. Na execução desta entrega, `HEAD` era `7eff0cb`; execuções após novos commits comparam com a referência então vigente.
