# Twitter Hashtag Watcher (Backend)

## Sobre o projeto

Essa aplicação foi criada com para o processo seletivo da Globo.

O objetivo é criar um aplicação controle que receba tweets com determinada hashtag e que, após serem aprovados, sejam mostrados em um telão.

O backend da aplicação foi feito em Node.js, usando websockets para comunicação com o frontend e a biblioteca Twit para fazer a stream dos tweets - também fazendo uso de websockets.

## Primeiros passos

Antes de iniciar o servidor, edite o arquivo `.env-example` colocando seus dados para a API do Twitter*. Após isso, renomeie o arquivo para `.env`.

*Se você ainda não tem seus dados de acesso à API do Twitter, consiga-os [neste link](https://developer.twitter.com).

### Instalação

Para instalar as dependências do projeto, basta rodar o seguinte comando:

Usuários de yarn:
`yarn`

Usuários de npm:
`npm install`

## Comandos

### Rodar servidor

Usuários de yarn:
`yarn start`

Usuários de npm:
`npm run start`

### Fazer a build do projeto

Usuários de yarn:
`yarn build`

Usuários de npm:
`npm run build`

Os arquivos da build serão salvos na pasta dist.
