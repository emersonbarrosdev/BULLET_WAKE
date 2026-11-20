# APK de teste do BULLET WAKE

O APK inclui o build web de produção, sprites, áudio e fontes locais. A Activity nativa usa WebView com aceleração de hardware e origem HTTPS local interceptada pelos assets do pacote; o jogo abre sem servidor de desenvolvimento ou conexão com o computador. Armazenamento local permanece no aparelho entre atualizações por `adb install -r`.

Requisitos de autoria: JDK 17 ou superior em `JAVA_HOME`, Android SDK em `ANDROID_HOME` ou `ANDROID_SDK_ROOT` (no Windows também é reconhecido o caminho padrão do SDK). O script usa AAPT2, javac, D8, zipalign e apksigner já instalados. Não exige Gradle nem dependências AndroidX.

```sh
npm run android:apk
npm run android:install
```

O primeiro comando valida TypeScript, gera o build de produção e cria `output/android/BULLET_WAKE-hull-preview.apk`. O segundo aguarda até dez minutos por exatamente um dispositivo com depuração USB autorizada, instala preservando dados e abre a Activity. Não desinstala aplicativos para contornar conflitos de assinatura.

O pacote de teste é `dev.emersonbarros.bulletwake.preview`, nome **Bullet Wake**, Android mínimo 9 / API 28 e alvo API 34. Usa assinatura local de depuração em `.debug.keystore`, ignorada pelo Git. A inspeção nativa de WebView fica disponível nesse APK de teste; o bundle do jogo continua sem seus globals e painéis de desenvolvimento.

Os recursos web são adicionados com JAR para garantir caminhos ZIP com `/` também no Windows. A geração verifica a presença de todos os arquivos de `dist` e rejeita caminhos com barras invertidas antes de assinar o APK.

O app usa orientação vertical, mantém a tela ligada durante o uso, pausa ao perder foco e encaminha o botão Voltar para ESC no jogo. Fenda ocupa a área vertical; Cidade Solar mantém a proporção de sua arena horizontal dentro da tela vertical, com os controles no espaço inferior. A gravação é local a este pacote, separada da versão de navegador.

Menus e modais usam composição própria de retrato, texto nativo e botões com alvo mínimo de 44 px CSS. O conteúdo extenso tem rolagem; as ações de retorno e confirmação permanecem acessíveis no rodapé. A tela inicial usa logo maior no alto e botões separados. O canvas de combate renderiza até 2× a resolução CSS e a câmera usa escala uniforme.

No touch, a nave atira automaticamente durante o voo. Existem analógico, CARGA e ESP, além da pausa. Segurar CARGA suspende a rajada e soltar dispara o tiro carregado. Isso não altera a opção de disparo acessível do teclado/controle.

QA de retrato: `node scripts/portrait-browser-check.mjs` registra capturas e verificações em `output/android-layout` para 320×640, 360×774 e 412×915. Os estados de derrota, resultado e encerramento usam fixtures de desenvolvimento; as capturas não significam conclusão humana da campanha. `node scripts/hull-browser-check.mjs --out=output/android-layout/hull --skip-performance` cobre dano, reparo, controles e pausa. Os relatórios de navegador distinguem emulação de validação no aparelho.

O relatório de build registra tamanho e SHA-256. Um relatório de instalação só é escrito após o ADB confirmar instalação e abertura no aparelho. A existência do APK não certifica desempenho, áudio, multitoque ou controles em hardware físico.

Em 20/11/2026, a versão `0.1.0-hull-preview.2` foi instalada no Samsung SM-G980F / Android 13 e revisada em 18 telas/variações. O fluxo físico em treino confirmou tiro automático, movimento junto com CARGA, carga/soltura, especial, derrota, pausa e confirmação de saída. O relatório e as capturas ficam em `output/android/device-portrait`. Resultado/encerramento continuam validados por fixtures de navegador; campanha completa e desempenho sustentado no aparelho não foram certificados.

Referências oficiais: [AAPT2](https://developer.android.com/tools/aapt2), [assinatura e build por linha de comando](https://developer.android.com/build/building-cmdline), [apksigner](https://developer.android.com/tools/apksigner).
