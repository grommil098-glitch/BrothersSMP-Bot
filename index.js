const express = require("express");
const http = require("http");
const bp = require('bedrock-protocol');
const app = express();

const SERVER_HOST = 'BrothersSMP-Xbg2.aternos.me';
const SERVER_PORT = 20715;
const BOT_USERNAME = 'BrothersSMPBot';

let botStatus = {
  connected: false,
  host: SERVER_HOST,
  port: SERVER_PORT,
  username: BOT_USERNAME,
  health: null,
  food: null,
  position: null,
  players: [],
  reconnectAttempts: 0,
  lastConnected: null,
  lastDisconnected: null,
  connectTime: null,
};

app.use(express.json());
app.get("/", (_, res) => res.sendFile(__dirname + "/index.html"));
app.get("/status", (_, res) => {
  const uptimeMs = botStatus.connectTime ? Date.now() - botStatus.connectTime : null;
  res.json({ ...botStatus, uptime: uptimeMs });
});
app.listen(process.env.PORT || 5000);

setInterval(() => {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.PROJECT_DOMAIN + '.repl.co';
  http.get(`https://${domain}/`).on('error', () => {});
}, 240000);

function createBot() {
  console.log(`Connecting to ${SERVER_HOST}:${SERVER_PORT}...`);

  let client;
  try {
    client = bp.createClient({
      host: SERVER_HOST,
      port: SERVER_PORT,
      username: BOT_USERNAME,
      offline: true,
      version: '1.26.20',
      skipPing: true,
    });
  } catch (err) {
    console.log('Failed to create client:', err.message);
    botStatus.reconnectAttempts++;
    setTimeout(createBot, 10000);
    return;
  }

  client.on('spawn', () => {
    console.log(`Bot spawned as ${BOT_USERNAME}`);
    botStatus.connected = true;
    botStatus.lastConnected = new Date().toISOString();
    botStatus.connectTime = Date.now();
  });

  client.on('player_list', (packet) => {
    try {
      const records = packet.records;
      if (records && records.records) {
        botStatus.players = records.records.map(r => r.username).filter(Boolean);
      }
    } catch (e) {}
  });

  client.on('update_attributes', (packet) => {
    try {
      if (packet.attributes) {
        for (const attr of packet.attributes) {
          if (attr.name === 'minecraft:health') botStatus.health = Math.round(attr.current);
          if (attr.name === 'minecraft:player.hunger') botStatus.food = Math.round(attr.current);
        }
      }
    } catch (e) {}
  });

  client.on('move_player', (packet) => {
    try {
      botStatus.position = {
        x: Math.round(packet.x),
        y: Math.round(packet.y),
        z: Math.round(packet.z),
      };
    } catch (e) {}
  });

  client.on('disconnect', (packet) => {
    console.log('Disconnected:', packet.message || 'unknown reason');
    resetAndReconnect();
  });

  client.on('kick', (packet) => {
    console.log('Kicked:', packet.message || 'unknown reason');
    resetAndReconnect();
  });

  client.on('error', (err) => {
    console.log('Bot error:', err.message || err);
    resetAndReconnect();
  });

  client.on('end', () => {
    console.log('Connection ended');
    resetAndReconnect();
  });

  function resetAndReconnect() {
    botStatus.connected = false;
    botStatus.health = null;
    botStatus.food = null;
    botStatus.position = null;
    botStatus.players = [];
    botStatus.lastDisconnected = new Date().toISOString();
    botStatus.connectTime = null;
    botStatus.reconnectAttempts++;
    console.log(`Reconnecting in 5 seconds... (attempt ${botStatus.reconnectAttempts})`);
    setTimeout(createBot, 5000);
  }
}

createBot();
