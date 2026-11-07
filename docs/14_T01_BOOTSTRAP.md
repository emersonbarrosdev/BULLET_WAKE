# T01 — Bootstrap Phaser 4 + TypeScript + Vite

**Status: implementação versionada; validação de build depende do CI GitHub Actions ou execução local com npm.**

## Decisão
- Phaser **4.2.1** fixado como dependência de runtime, versão estável verificada na página oficial em 07/11/2026: https://phaser.io/download/release/v4.2.1
- TypeScript 5.9.3 e Vite 8.0.0 fixados para a base de projeto.
- Node 22.12 ou superior; .nvmrc escolhe linha Node 22.
- **Não incluir Angular** no gameplay. Vite serve o jogo como web app simples.
- Elemento **HTML Canvas**, renderização por WebGL onde possível via Phaser.AUTO e fallback Canvas automático.
- Resolução lógica 384×216, Scale.FIT, pixelArt para evitar blur, página com CSS responsivo.

## Arquivos
`index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `src/main.ts`,
`src/style.css`, `src/game/constants.ts`, `src/game/scenes/BootScene.ts`,
`.nvmrc`, `.gitignore`, `.github/workflows/check.yml`.

## Desenvolvimento local
```bash
nvm use
npm install
npm run typecheck
npm run dev
# Abrir URL local impressa pelo Vite
npm run build
npm run preview
```

**Dependências ainda sem `package-lock.json`** porque o executor de documentação não conseguiu alcançar registry.npmjs.org. Gerar e versionar `package-lock.json` após a primeira instalação bem-sucedida; então substituir `npm install` por `npm ci` no workflow.

## Resultado esperado
Uma tela diagnóstica dentro do Canvas com texto **BULLET WAKE / T01 | BOOTSTRAP**. O texto é SOMENTE uma indicação de engine carregada — não é menu definitivo, gameplay, pixel art nem sprite placeholder.

## Aceite
1. `npm run typecheck` passa sem erros.
2. `npm run build` gera `dist/`.
3. Browser exibe Canvas responsivo mantendo proporção 16:9.
4. Render/WebGL inspecionado no navegador.
5. Não foi adicionado Angular.
6. Dependências travadas em lockfile antes de declarar base totalmente reproduzível.

## Evidência
- Inspeção estática e commit no GitHub: possível.
- Instalação npm e build: **não executados** no ambiente de autoria por falha de DNS na conexão com npm.
- GitHub Actions é a verificação remota adicionada; registrar resultado do CI antes de marcar T01 como totalmente concluída.

**Próxima T02:** melhorias de escala, viewport, áreas seguras e testes de pixel perfect com dispositivos e múltiplas proporções.
