# Hydra Key Bot

Bot Discord em Node.js para gerenciar chaves de acesso de um conteúdo autorizado. O projeto usa comandos slash, painel com botões, resgate único por usuário do Discord e armazenamento local em `data/store.json`.

> Este projeto não executa scripts externos, não usa `loadstring`, não coleta HWID e não tenta contornar mecanismos de segurança. O conteúdo entregue por DM deve ser autorizado por você e adequado às regras da plataforma.

## Funcionalidades

| Recurso | Funcionamento |
|---|---|
| `/gerarkeys` | Gera de 1 a 50 chaves no formato `HYDRA-XXXX-XXXX-XXXX`. |
| `/set painel` | Publica o painel interativo no canal atual. |
| `/config` | Altera a descrição do painel e o conteúdo autorizado enviado por DM. |
| `Resgatar chave` | Abre um formulário e vincula uma chave disponível ao usuário Discord. |
| `Ver conteúdo` | Envia o conteúdo configurado por mensagem direta após o resgate. |
| `Resetar resgate` | Permite que um administrador libere o resgate de um usuário. |
| `/status` | Mostra o total de chaves, resgates e chaves disponíveis. |

## Instalação

Instale o [Node.js 18.17 ou superior](https://nodejs.org/), crie uma aplicação no [Discord Developer Portal](https://discord.com/developers/applications), crie o bot e copie o token. Nunca publique o token em mensagens, repositórios ou capturas de tela.

Depois, execute:

```bash
npm install
cp .env.example .env
```

Preencha o `.env` com `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID` e, opcionalmente, `ADMIN_ROLE_ID`. O `GUILD_ID` é usado para registrar os comandos rapidamente em um servidor específico.

Registre os comandos e inicie o bot:

```bash
npm run register
npm start
```

O bot precisa ser convidado para o servidor com os escopos `bot` e `applications.commands`. Para publicar o painel, o bot precisa conseguir enviar mensagens e incorporar links no canal escolhido.

## Fluxo recomendado

Primeiro use `/gerarkeys quantidade:10` como administrador. Em seguida, execute `/config` para definir a descrição e o conteúdo autorizado. Por fim, execute `/set painel`. Os usuários clicam em **Resgatar chave**, informam a chave e clicam em **Ver conteúdo** para receber a mensagem privada.

Os dados ficam em `data/store.json`. Faça cópias de segurança desse arquivo e não o publique, pois ele contém o estado das chaves resgatadas.

## Alternativas de execução

| Abordagem | Vantagens | Limitações | Complexidade |
|---|---|---|---|
| Executar localmente com `npm start` | Gratuito e simples para testes | O computador precisa permanecer ligado | Baixa |
| Hospedar em um serviço Node.js | Disponível continuamente | Exige configurar variáveis secretas e hospedagem | Média |

## Segurança

Use um token novo se o atual vazar, mantenha `data/store.json` fora do Git e dê ao bot somente as permissões necessárias. O sistema identifica o usuário pelo ID do Discord, não por HWID ou dados do dispositivo.
