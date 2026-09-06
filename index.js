import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ModalBuilder,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';

const DATA_DIR = path.resolve('data');
const DB_FILE = path.join(DATA_DIR, 'store.json');
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error('DISCORD_TOKEN não foi configurado. Copie .env.example para .env e preencha o token.');
  process.exit(1);
}

const defaultStore = {
  config: {
    description: 'Resgate uma chave para liberar o conteúdo autorizado.',
    deliveryContent: process.env.DEFAULT_DELIVERY_CONTENT || 'Conteúdo autorizado do seu projeto.'
  },
  keys: {},
  claims: {},
  panels: {}
};

let store = structuredClone(defaultStore);
let saveQueue = Promise.resolve();
function saveStore(next = store) {
  store = next;
  saveQueue = saveQueue.then(async () => {
    const temp = `${DB_FILE}.tmp`;
    await fs.writeFile(temp, JSON.stringify(store, null, 2), 'utf8');
    await fs.rename(temp, DB_FILE);
  });
  return saveQueue;
}

async function loadStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    return { ...defaultStore, ...JSON.parse(await fs.readFile(DB_FILE, 'utf8')) };
  } catch {
    await saveStore(defaultStore);
    return structuredClone(defaultStore);
  }
}

store = await loadStore();

function isAdmin(interaction) {
  if (interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) return true;
  const roleId = process.env.ADMIN_ROLE_ID;
  return Boolean(roleId && interaction.member?.roles?.cache?.has(roleId));
}

function newKey() {
  const raw = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `HYDRA-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 16)}`;
}

function panelComponents() {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('hydra_claim').setLabel('Resgatar chave').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('hydra_view').setLabel('Ver conteúdo').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('hydra_reset').setLabel('Resetar resgate').setStyle(ButtonStyle.Secondary)
  )];
}

function panelEmbed() {
  return new EmbedBuilder()
    .setColor(0x00aaff)
    .setTitle('Hydra Hub | Sistema de acesso')
    .setDescription(store.config.description)
    .addFields({ name: 'Como usar', value: 'Clique em **Resgatar chave**, informe sua chave e depois use **Ver conteúdo** para receber a entrega autorizada por DM.' })
    .setFooter({ text: 'As chaves são de uso único.' });
}

async function replyEphemeral(interaction, content) {
  if (interaction.replied || interaction.deferred) return interaction.followUp({ content, ephemeral: true });
  return interaction.reply({ content, ephemeral: true });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => {
  console.log(`Bot conectado como ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'set' && interaction.options.getSubcommand() === 'painel') {
        if (!isAdmin(interaction)) return replyEphemeral(interaction, 'Você precisa ser administrador para publicar o painel.');
        const message = await interaction.channel.send({ embeds: [panelEmbed()], components: panelComponents() });
        store.panels[message.id] = { channelId: message.channel.id, createdAt: new Date().toISOString() };
        await saveStore();
        return replyEphemeral(interaction, 'Painel publicado neste canal.');
      }

      if (interaction.commandName === 'config') {
        if (!isAdmin(interaction)) return replyEphemeral(interaction, 'Você precisa ser administrador para configurar o bot.');
        const description = interaction.options.getString('descricao');
        const content = interaction.options.getString('conteudo');
        if (description) store.config.description = description;
        if (content) store.config.deliveryContent = content;
        await saveStore();
        return replyEphemeral(interaction, 'Configuração salva. O próximo painel usará os novos valores.');
      }

      if (interaction.commandName === 'gerarkeys') {
        if (!isAdmin(interaction)) return replyEphemeral(interaction, 'Você precisa ser administrador para gerar chaves.');
        const amount = Math.min(interaction.options.getInteger('quantidade') || 1, 50);
        const generated = [];
        for (let i = 0; i < amount; i += 1) {
          let key = newKey();
          while (store.keys[key]) key = newKey();
          store.keys[key] = { createdAt: new Date().toISOString(), claimedBy: null, claimedAt: null };
          generated.push(key);
        }
        await saveStore();
        return replyEphemeral(interaction, `Chaves geradas com sucesso:\n\`${generated.join('\n')}\``);
      }

      if (interaction.commandName === 'status') {
        if (!isAdmin(interaction)) return replyEphemeral(interaction, 'Você precisa ser administrador para consultar o status.');
        const total = Object.keys(store.keys).length;
        const claimed = Object.values(store.keys).filter(k => k.claimedBy).length;
        return replyEphemeral(interaction, `Chaves: **${total}** totais, **${claimed}** resgatadas, **${total - claimed}** disponíveis.`);
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'hydra_claim') {
        const modal = new ModalBuilder().setCustomId('hydra_claim_modal').setTitle('Resgatar chave');
        const input = new TextInputBuilder().setCustomId('key').setLabel('Sua chave').setPlaceholder('HYDRA-ABCD-1234-5678').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'hydra_view') {
        if (!store.claims[interaction.user.id]) return replyEphemeral(interaction, 'Você ainda não resgatou uma chave.');
        try {
          await interaction.user.send(`**Hydra Hub — conteúdo autorizado**\n\n${store.config.deliveryContent}`);
          return replyEphemeral(interaction, 'Enviei o conteúdo autorizado na sua DM.');
        } catch {
          return replyEphemeral(interaction, 'Não consegui enviar DM. Ative as mensagens diretas neste servidor e tente novamente.');
        }
      }

      if (interaction.customId === 'hydra_reset') {
        if (!isAdmin(interaction)) return replyEphemeral(interaction, 'O reset de resgate é restrito a administradores.');
        const modal = new ModalBuilder().setCustomId('hydra_reset_modal').setTitle('Resetar resgate');
        const input = new TextInputBuilder().setCustomId('discord_id').setLabel('ID do usuário Discord').setPlaceholder('123456789012345678').setStyle(TextInputStyle.Short).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'hydra_claim_modal') {
      const key = interaction.fields.getTextInputValue('key').trim().toUpperCase();
      const record = store.keys[key];
      if (!record) return replyEphemeral(interaction, 'Essa chave não existe.');
      if (record.claimedBy) return replyEphemeral(interaction, 'Essa chave já foi resgatada.');
      if (store.claims[interaction.user.id]) return replyEphemeral(interaction, 'Você já possui um resgate ativo.');
      record.claimedBy = interaction.user.id;
      record.claimedAt = new Date().toISOString();
      store.claims[interaction.user.id] = { key, claimedAt: record.claimedAt };
      await saveStore();
      return replyEphemeral(interaction, 'Chave resgatada com sucesso. Clique em **Ver conteúdo** para receber a entrega na DM.');
    }

    if (interaction.isModalSubmit() && interaction.customId === 'hydra_reset_modal') {
      const userId = interaction.fields.getTextInputValue('discord_id').trim();
      const claim = store.claims[userId];
      if (!claim) return replyEphemeral(interaction, 'Esse usuário não possui resgate ativo.');
      if (store.keys[claim.key]) {
        store.keys[claim.key].claimedBy = null;
        store.keys[claim.key].claimedAt = null;
      }
      delete store.claims[userId];
      await saveStore();
      return replyEphemeral(interaction, 'Resgate resetado; a chave voltou a ficar disponível.');
    }
  } catch (error) {
    console.error(error);
    if (!interaction.replied && !interaction.deferred) await replyEphemeral(interaction, 'Ocorreu um erro interno.');
  }
});

async function registerCommands() {
  const { CLIENT_ID, GUILD_ID } = process.env;
  if (!CLIENT_ID || !GUILD_ID) {
    console.warn('CLIENT_ID ou GUILD_ID ausente; comandos slash não foram registrados automaticamente.');
    return;
  }
  const commands = [
    new SlashCommandBuilder().setName('set').setDescription('Publica o painel').addSubcommand(s => s.setName('painel').setDescription('Publica o painel neste canal')),
    new SlashCommandBuilder().setName('config').setDescription('Configura o painel').addStringOption(o => o.setName('descricao').setDescription('Descrição').setRequired(false)).addStringOption(o => o.setName('conteudo').setDescription('Conteúdo autorizado enviado por DM').setRequired(false)),
    new SlashCommandBuilder().setName('gerarkeys').setDescription('Gera chaves').addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade de 1 a 50').setMinValue(1).setMaxValue(50).setRequired(false)),
    new SlashCommandBuilder().setName('status').setDescription('Mostra o status das chaves')
  ].map(command => command.toJSON());
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log('Comandos slash registrados.');
}

await registerCommands();
client.login(TOKEN);
