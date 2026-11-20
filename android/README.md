# APK de teste do BULLET WAKE

O APK inclui o build web de produção, sprites, áudio e fontes locais. A Activity nativa usa WebView com aceleração de hardware e origem HTTPS local interceptada pelos assets do pacote; o jogo abre sem servidor de desenvolvimento ou conexão com o computador. Armazenamento local permanece no aparelho entre atualizações por `adb install -r`.

Requisitos de autoria: JDK 17 ou superior em `JAVA_HOME`, Android SDK em `ANDROID_HOME` ou `ANDROID_SDK_ROOT` (no Windows também é reconhecido o caminho padrão do SDK). O script usa AAPT2, javac, D8, zipalign e apksigner já instalados. Não exige Gradle nem dependências AndroidX.

```sh
npm run android:apk
npm run android:install
```

O primeiro comando valida TypeScript, gera o build de produção e cria `output/android/BULLET_WAKE-hull-preview.apk`. O segundo aguarda até dez minutos por exatamente um dispositivo com depuração USB autorizada, instala preservando dados e abre a Activity. Não desinstala aplicativos para contornar conflitos de assinatura.

O pacote de teste é `dev.emersonbarros.bulletwake.preview`, nome **BULLET WAKE Teste**, Android mínimo 9 / API 28 e alvo API 34. Usa assinatura local de depuração em `.debug.keystore`, ignorada pelo Git. A inspeção nativa de WebView fica disponível nesse APK de teste; o bundle do jogo continua sem seus globals e painéis de desenvolvimento.

O app permite rotação, mantém o ecrã ligado durante o uso, pausa ao perder foco e encaminha o botão Voltar para ESC no jogo. Fenda usa a apresentação vertical em retrato; Cidade Solar pede paisagem. A gravação é local a este pacote, separada da versão de navegador.

O relatório de build registra tamanho e SHA-256. Um relatório de instalação só é escrito após o ADB confirmar instalação e abertura no aparelho. A existência do APK não certifica desempenho, áudio, multitoque ou controles em hardware físico.

Referências oficiais: [AAPT2](https://developer.android.com/tools/aapt2), [assinatura e build por linha de comando](https://developer.android.com/build/building-cmdline), [apksigner](https://developer.android.com/tools/apksigner).
