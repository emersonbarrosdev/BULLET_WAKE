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

O app inicia em retrato, mantém a tela ligada durante o uso, pausa ao perder foco e encaminha o botão Voltar para ESC no jogo. Um controle USB/Bluetooth detectado pelo Android abre a pergunta sobre paisagem. A mesma escolha fica em Opções → Configurações; paisagem requer controle conectado. Desconectar o controle pausa a partida e retorna ao retrato. A Activity muda a orientação sem recriar a WebView. Fenda ocupa a área vertical; Cidade Solar mantém a proporção de sua arena horizontal dentro da tela vertical, com os controles no espaço inferior. A gravação é local a este pacote, separada da versão de navegador.

Menus e modais usam composição própria de retrato, texto nativo e botões com alvo mínimo de 44 px CSS. O conteúdo extenso tem rolagem; as ações de retorno e confirmação permanecem acessíveis no rodapé. A tela inicial tem somente Jogar e Opções, botões 40% mais estreitos e aviões passando. Opções reúne Perfil e Hangar, Controles, Créditos e Configurações, nessa ordem. No hangar, Perfil vem antes de Pinturas e Conquistas. Configurações mantém os ajustes anteriores. O canvas de combate renderiza até 2× a resolução CSS e a câmera usa escala uniforme.

No Android, a nave atira automaticamente durante o voo, tanto no toque quanto com controle. Existem analógico, CARGA e ESP, além da pausa. Segurar CARGA suspende a rajada e soltar dispara o tiro carregado. O teclado e o controle na versão PC preservam seus comandos.

Em paisagem, os menus usam colunas e rodapés próprios para a altura reduzida. O HUD móvel à esquerda mostra nave, casco/vidas, potência, carga, especiais e pausa; os painéis completos de PC ficam ocultos. Uma nova partida ajusta a largura do campo à área disponível. Girar durante uma partida mantém sua geometria e a do replay, sem mover alvos ou distorcer sprites; iniciar uma nova partida aplica o campo amplo da orientação escolhida. Ao retornar ao retrato, HUD e alvos de toque acompanham a câmera.

QA de retrato: `node scripts/portrait-browser-check.mjs` registra capturas e verificações em `output/android-layout` para 320×640, 360×774 e 412×915. Os estados de derrota, resultado e encerramento usam fixtures de desenvolvimento; as capturas não significam conclusão humana da campanha. `node scripts/hull-browser-check.mjs --out=output/android-layout/hull --skip-performance` cobre dano, reparo, controles e pausa. Os relatórios de navegador distinguem emulação de validação no aparelho.

QA de paisagem: `node scripts/mobile-landscape-browser-check.mjs` verifica 640×320, 800×360 e 915×412, ordem dos menus, navegação pelo controle, conexão/reconexão, recusa/aceite do modal, disparo/carga/especial, configurações de orientação e retorno ao toque. A revisão .4 passou em 21 testes direcionados, 69 capturas de retrato e 53 de paisagem/rotação. A regressão completa anterior, na .3, passou em 546 testes e 40 capturas de casco. Os harnesses isolados usam `qa-game-access.mjs` para inspecionar a cena sem disponibilizar o painel DEV no mobile.

O relatório de build registra versão, tamanho e SHA-256. Um relatório de instalação só é escrito após o ADB confirmar instalação e abertura no aparelho. A existência do APK não certifica desempenho, áudio, multitoque ou controles em hardware físico.

Em 20/11/2026, a versão `0.1.0-hull-preview.2` foi instalada no Samsung SM-G980F / Android 13 e revisada em 18 telas/variações. O fluxo físico em treino confirmou tiro automático, movimento junto com CARGA, carga/soltura, especial, derrota, pausa e confirmação de saída. O relatório e as capturas ficam em `output/android/device-portrait`. Resultado/encerramento continuam validados por fixtures de navegador; campanha completa e desempenho sustentado no aparelho não foram certificados.

A versão atual é **0.1.0-hull-preview.4**, código 20261124, 53.766.614 bytes. O início foi redistribuído verticalmente, com logo menor e ações mais abaixo; Opções fica centralizado. Aviões de 32–38 px CSS passam um por vez na parte superior, em trajetos de 4,4 s, com os quatro frames originais da hélice. O modo Treino não aparece nem pode ser aberto pelo fluxo mobile. O painel DEV também não é montado no mobile servido em desenvolvimento; o APK continua com bundle de produção sem DevTools.

Todos os botões dos menus têm pressão visual, brilho e confirmação de 90 ms antes da ação. Há som de confirmação e feedback tátil nativo, respeitando a preferência de toque do Android. Toques duplicados são bloqueados durante a confirmação; arrastar/cancelar não confirma. Navegação pelo controle usa o mesmo comportamento. Reduzir movimento no sistema elimina o deslocamento dos botões e os voos decorativos.

Antes da implementação, a .3 foi inspecionada no Samsung e a composição nova foi experimentada por CSS temporário na própria WebView. Depois, a .4 foi instalada por atualização no **Samsung SM-G980F / Android 13**, preservando os dados. Foram conferidos dez estados/telas por toque: início normal/pressionado, Opções, Perfil, Pinturas, Controles, Créditos, Configurações, piloto e rotas. Confirmados centralização, logo proporcional, feedback visual, ausência de DEV/Treino e ciclo completo dos aviões; nenhum erro da aplicação. Evidências em `output/android/device-mobile-v4/report.json` e capturas. O aparelho ficou no início. Ainda falta validar rotação e entradas com controle físico USB/Bluetooth; a inspeção não mede a percepção humana de som/vibração.

Referências oficiais: [AAPT2](https://developer.android.com/tools/aapt2), [assinatura e build por linha de comando](https://developer.android.com/build/building-cmdline), [apksigner](https://developer.android.com/tools/apksigner).
