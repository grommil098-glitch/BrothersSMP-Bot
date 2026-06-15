const bp = require('bedrock-protocol');
const http = require('http');

// Fake web server to stop Render from making clones
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot is alive!");
}).listen(process.env.PORT || 3000);

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
app.get("/ping", (_, res) => res.send("pong"));
app.get("/status", (_, res) => {
  const uptimeMs = botStatus.connectTime ? Date.now() - botStatus.connectTime : null;
  res.json({ ...botStatus, uptime: uptimeMs });
});
app.listen(process.env.PORT || 5000);

setInterval(() => {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.PROJECT_DOMAIN + '.repl.co';
  https.get(`https://${domain}/ping`).on('error', () => {});
}, 60000);

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

  let currentPos = { x: 0, y: 64, z: 0, yaw: 0, pitch: 0 };
  let antAfkInterval = null;

  client.on('spawn', () => {
    console.log(`Bot spawned as ${BOT_USERNAME}`);
    botStatus.connected = true;
    botStatus.lastConnected = new Date().toISOString();
    botStatus.connectTime = Date.now();

    // Anti-AFK: every 30 seconds rotate and jump to avoid kick
    antAfkInterval = setInterval(() => {
      try {
        // Rotate slightly so the bot looks active
        currentPos.yaw = (currentPos.yaw + 45) % 360;
        
// Sends a chat message every 30 seconds to trick Aternos into staying online
      const messages = ["Hello!", "Still here!", "Keeping the server alive!", "No sleeping!", "Beep boop!"];
      const randomMessage = messages[Math.floor(Math.random() * messages.length)];
      
      client.write('text', {
        type: 'chat',
        needs_translation: false,
        source_name: client.username || 'Bot',
        xuid: '',
        platform_chat_id: '',
        message: randomMessage
      });
        // Jump (start + stop jump action)
        client.write('player_action', {
          runtime_id: 1n,
          action: 'jumping',
          position: { x: Math.floor(currentPos.x), y: Math.floor(currentPos.y), z: Math.floor(currentPos.z) },
          result_position: { x: Math.floor(currentPos.x), y: Math.floor(currentPos.y), z: Math.floor(currentPos.z) },
          face: 0,
        });

        console.log('Anti-AFK action sent');
      } catch (e) {
        // Silently ignore if packet fails
      }
    }, 30000);
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
      currentPos.x = packet.position.x;
      currentPos.y = packet.position.y;
      currentPos.z = packet.position.z;
      botStatus.position = {
        x: Math.round(packet.position.x),
        y: Math.round(packet.position.y),
        z: Math.round(packet.position.z),
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
    if (antAfkInterval) { clearInterval(antAfkInterval); antAfkInterval = null; }
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
