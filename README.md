# EACH Grand Prix

Jogo de corrida feito para a dinâmica do seminário de Gestão das Aquisições em TI, na disciplina de Gestão de Projetos de TI do curso de Sistemas de Informação da EACH-USP.

Cada grupo da turma é uma equipe. A equipe monta o carro escolhendo, peça por peça, se compra de um fornecedor caro, de um barato ou se fabrica na própria oficina. Depois os carros correm 5 voltas numa pista desenhada em cima do mapa do campus, e cartas de evento mudam o resultado a cada volta.

O regulamento completo está em [REGULAMENTO.md](REGULAMENTO.md).

Dá para jogar a versão offline em https://cerqueira11.github.io/each-grand-prix/. O modo online foi usado na apresentação e depois desligado. Para religar, é preciso um projeto Firebase próprio, como explicado em "Modo online", e trocar `ONLINE_ENABLED` para `true` em `js/core.js`.

## Como abrir

O jogo roda no navegador, sem instalar nada e sem internet. Basta abrir o `index.html`.

Ele foi pensado para um computador ligado ao projetor. O organizador controla tudo pela tela e os líderes das equipes falam as escolhas em voz alta.

O progresso fica salvo no navegador. Se a página fechar sem querer, a partida continua de onde parou. O botão "Reiniciar jogo" apaga tudo.

## Como jogar

1. Cadastre as equipes conforme os grupos chegam, até 9.
2. Sorteie a ordem de escolha.
3. Siga a fila e registre de onde vem cada peça do carro de cada equipe.
4. Comece a corrida. No fim de cada volta aparece a carta do evento e, depois dela, a classificação por 5 segundos.
5. Depois da quinta volta vem o pódio.

## Modo online

No modo online, cada líder monta o carro pelo próprio celular e o telão mostra a corrida. Ele precisa de internet no computador do telão e nos celulares. Se a rede falhar, o modo offline continua funcionando.

1. No computador do telão, abra o site e clique em "Jogar com celulares".
2. O telão mostra um código de 4 letras e um QR code. Cada líder aponta a câmera do celular para o QR code, ou abre `jogador.html` e digita o código, e escolhe a equipe.
3. Com as equipes dentro, o organizador abre a montagem e começa um cronômetro (3 minutos por padrão, ajustável no telão, com botão de +1 minuto). Cada líder escolhe as peças no celular e envia o carro. Quando o tempo acaba, quem não enviou tem o carro enviado do jeito que estava: peça sem escolha vai para a oficina, e lance que estoure o orçamento é zerado. Se o celular estiver fechado, o telão faz isso com o que já estava escolhido.
4. As peças Premium são disputadas num leilão de lance fechado. Para cada peça Premium pedida, a equipe dá um lance em moedas. Se mais equipes pedirem uma peça do que o estoque, levam os maiores lances e só elas pagam o lance. Quem perde fica com a peça econômica. Se ninguém disputar, ninguém paga. Quando o empate cai no limite do estoque, o telão sorteia entre as equipes empatadas e avisa no resultado do leilão.
5. O organizador faz o leilão, o telão mostra quem levou cada peça e a corrida começa. Durante a corrida, o celular mostra a posição da equipe e o efeito da carta de cada volta no carro dela. No fim, mostra a colocação e os pontos.

Se um celular travar, o líder pode abrir o link de novo no mesmo aparelho e volta para a mesma equipe. Pelo telão, o organizador pode liberar uma equipe para outro celular entrar ou reabrir um carro já enviado.

Para rodar o modo online com o seu próprio Firebase:

1. Crie um projeto no Firebase, ative o Realtime Database e o login anônimo.
2. Registre um app web e cole a configuração em `js/firebase-config.js`.
3. Publique as regras com `firebase deploy --only database`, ajustando o projeto em `.firebaserc`.
4. Sirva os arquivos por HTTP (o modo online não funciona abrindo o arquivo direto do disco), por exemplo com `python -m http.server`, ou publique num site estático.

O modo online guarda os dados num banco do Firebase (Realtime Database), com login anônimo. As regras de acesso ficam em `database.rules.json`: cada celular só mexe na própria equipe, os lances só ficam visíveis para o telão e para a própria equipe, e só o telão que criou a sala controla a partida.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | Telas do jogo |
| `css/style.css` | Visual |
| `js/config.js` | Peças, preços, cartas, equipes e desenho da pista |
| `js/core.js` | Estado salvo, avisos na tela e regras das peças |
| `js/setup.js` | Cadastro das equipes e sorteio da ordem |
| `js/buy.js` | Montagem dos carros |
| `js/race.js` | Corrida, cartas, animação da pista |
| `js/results.js` | Pódio |
| `js/main.js` | Reinício e inicialização |
| `js/auction.js` | Regras do leilão e conferência do carro enviado pelo celular |
| `js/online-host.js` | Modo online do telão: sala, QR code, leilão e envio das voltas |
| `js/firebase-config.js` | Configuração pública do Firebase |
| `jogador.html`, `js/jogador.js`, `css/jogador.css` | Tela do celular |
| `js/vendor/qrcode.js` | Gerador de QR code (Kazuhiko Arase, licença MIT) |
| `database.rules.json` | Regras de acesso do banco |
| `sim.py` | Simulação usada para equilibrar os números |
| `sim_leilao.py` | Simulação que compara o leilão com a fila sorteada |

## Equilíbrio

Os preços, as notas e as cartas foram testados com `sim.py`. Ele gera todas as combinações de carro que cabem nas regras e põe cada uma para correr centenas de vezes contra as estratégias mais fortes. A ideia é que nenhuma combinação vença sempre.

Com os números atuais, a melhor estratégia vence perto de 30% das corridas, e montar o carro todo na oficina ou todo no fornecedor econômico quase nunca leva o título.

Para rodar a simulação com as regras atuais:

```
python sim.py v10s
```

O nome `v10s` indica a versão das regras. As versões anteriores ficaram no arquivo para comparação.

O leilão do modo online foi testado com `python sim_leilao.py`. Nele, a melhor estratégia vence perto de 25% das corridas, e lances de 0, 2 e 4 moedas ficam competitivos. Na fila sorteada, a mesma estratégia ganhava cerca de 6 pontos a mais quando era a primeira da fila do que quando era a última. No leilão essa diferença some, porque quem leva a peça depende do lance e não da ordem.
