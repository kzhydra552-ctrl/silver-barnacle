import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  throw new Error('Preencha DISCORD_TOKEN, CLIENT_ID e GUILD_ID no arquivo .env.');
}

const commands = [
  new SlashCommandBuilder()
    .setName('set')
    .setDescription('Publica um painel do Hydra Hub')
    .addSubcommand(sub => sub.setName('painel').setDescription('Publica o painel neste canal')),
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configura o conteúdo do painel')
    .addStringOption(o => o.setName('descricao').setDescription('Descrição exibida no painel').setRequired(false))
    .addStringOption(o => o.setName('conteudo').setDescription('Conteúdo autorizado enviado por DM').setRequired(false)),
  new SlashCommandBuilder()
    .setName('gerarkeys')
    .setDescription('Gera chaves de resgate')
    .addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade de chaves, de 1 a 50').setMinValue(1).setMaxValue(50).setRequired(false)),
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Mostra o status das chaves')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
console.log('Comandos registrados no servidor com sucesso.');
