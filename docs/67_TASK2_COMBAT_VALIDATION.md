# Tarefa 2 — combate e apresentação

Implementada depois da comparação visual das duas margens com o print e da verificação das emendas da Tarefa 1.

- Barcos recebem tratamento de cor e transparência na linha d'água, com proa e popa parcialmente submersas, espuma de contato e sem sombra de altitude.
- Pares de submarinos aparecem em lados opostos do canal: emergem por 1,2 s, ficam ancorados à água atirando e submergem. A arte horizontal tem dois estados e exposição progressiva; não usam o sprite genérico dos barcos.
- Aviões mantêm avanço para frente, inclusive nas antigas manobras de retorno. A rolagem UP fica em 38 antes dos chefes, sem a aceleração para 85.
- Formações adicionais e disparos mais rápidos. Cada família tem tamanho/cor fixos de projétil redondo; inimigos fracos usam tiros menores. A RIVET usa tiros normais vermelhos de diâmetro visual 10,5 e raio de colisão 3,6 em todos os níveis; os níveis continuam aumentando sua formação de tiro.
- Balão e três itens usam spritesheets próprios, com quatro quadros por tipo.
- Removidos os anéis de invulnerabilidade/aviso de poder e o vórtice final. Os sinais de disparo usam brilho pequeno no canhão. Impactos mostram uma silhueta vermelha com opacidade 40%, preservando 60% da arte original.
- Todo pixel sólido do casco de chefes e minibosses pode receber tiro. Impactos são atribuídos aos setores esquerdo, central ou direito. Quando um setor está destruído, seus impactos causam 25% do dano, distribuído entre os componentes restantes. Espaço transparente ao redor do sprite não recebe dano.
- O especial lança uma bomba por 0,65 s, seguida de explosão animada em área por 2,1 s, com limpeza dos tiros inimigos dentro da explosão. A saída automática após o chefe final foi mantida e testada mesmo com comando de movimento contrário.

Os valores de dano por setor são a implementação do comportamento solicitado pelo usuário; não há afirmação de que reproduzam uma fórmula interna de Sonic Wings.

Assets finais ImageGen integrado: `public/assets/arcade/pelagic-review/submarines.png`, `supply-items.png`, `bomb-flight.png`, `colossal-blast.png`. Prompts finais completos em `66_TASK2_ART_PROMPTS.json`. A primeira tentativa de atlas de explosão foi descartada porque os quadros se sobrepunham.

Validação: TypeScript e build Vite aprovados; 246 testes Node passaram. `scripts/pelagic-combat-check.mjs --routes` capturou o renderizador real em Chrome a 1366×768/1920×1080, sem erros de console, e concluiu ambas as missões usando as colisões reais dos sprites: Fenda em 319,88 s e Cidade em 309,17 s. São partidas simuladas por bot, não avaliação humana de dificuldade. Capturas/relatório em `docs/screenshots/pelagic-combat-v2/`.
