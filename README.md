# EACH Grand Prix

Jogo de corrida feito para a dinâmica do seminário de Gestão das Aquisições em TI, na disciplina de Gestão de Projetos de TI do curso de Sistemas de Informação da EACH-USP.

Cada grupo da turma é uma equipe. A equipe monta o carro escolhendo, peça por peça, se compra de um fornecedor caro, de um barato ou se fabrica na própria oficina. Depois os carros correm 5 voltas numa pista desenhada em cima do mapa do campus, e cartas de evento mudam o resultado a cada volta.

O regulamento completo está em [REGULAMENTO.md](REGULAMENTO.md).

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
| `sim.py` | Simulação usada para equilibrar os números |

## Equilíbrio

Os preços, as notas e as cartas foram testados com `sim.py`. Ele gera todas as combinações de carro que cabem nas regras e põe cada uma para correr centenas de vezes contra as estratégias mais fortes. A ideia é que nenhuma combinação vença sempre.

Com os números atuais, a melhor estratégia vence perto de 30% das corridas, e montar o carro todo na oficina ou todo no fornecedor econômico quase nunca leva o título.

Para rodar a simulação com as regras atuais:

```
python sim.py v10s
```

O nome `v10s` indica a versão das regras. As versões anteriores ficaram no arquivo para comparação.
