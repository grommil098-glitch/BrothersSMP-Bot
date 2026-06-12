const express = require("express");
const http = require("http");
const mineflayer = require('mineflayer')
const pvp = require('mineflayer-pvp').plugin
const { pathfinder, Movements, goals} = require('mineflayer-pathfinder')
const armorManager = require('mineflayer-armor-manager')
const mc = require('minecraft-protocol');
const AutoAuth = require('mineflayer-auto-auth');
const app = express();

const SERVER_HOST = 'BrothersSMP-Xbg2.aternos.me';
const SERVER_PORT = 20715;

let botStatus = {
  connected: false,
  host: SERVER_HOST,
  port: SERVER_PORT,
  username: '',
  health: null,
  food: null,
  position: null,
  players: [],
  reconnectAttempts: 0,
  lastConnected: null,
  lastDisconnected: null,
  uptime: null,
  connectTime: null,
};

app.use(express.json());

app.get("/", (_, res) => res.sendFile(__dirname + "/index.html"));

app.get("/status", (_, res) => {
  const now = Date.now();
  const uptimeMs = botStatus.connectTime ? now - botStatus.connectTime : null;
  res.json({ ...botStatus, uptime: uptimeMs });
});

app.listen(process.env.PORT || 5000);

setInterval(() => {
  const domain = process.env.REPLIT_DEV_DOMAIN || process.env.PROJECT_DOMAIN + '.repl.co';
  http.get(`https://${domain}/`).on('error', () => {});
}, 240000);

function createBot () {
  const bot = mineflayer.createBot({
    host: SERVER_HOST,
    version: false,
    username: 'BrothersSMPBot',
    port: SERVER_PORT,
    auth: 'offline',
  });

  bot.loadPlugin(pvp)
  bot.loadPlugin(armorManager)
  bot.loadPlugin(pathfinder)

  bot.once('spawn', () => {
    botStatus.connected = true;
    botStatus.username = bot.username;
    botStatus.lastConnected = new Date().toISOString();
    botStatus.connectTime = Date.now();
    console.log(`Bot connected as ${bot.username}`);
  });

  bot.on('health', () => {
    botStatus.health = bot.health;
    botStatus.food = bot.food;
  });

  bot.on('move', () => {
    if (bot.entity) {
      botStatus.position = {
        x: Math.round(bot.entity.position.x),
        y: Math.round(bot.entity.position.y),
        z: Math.round(bot.entity.position.z),
      };
    }
  });

  bot.on('playerJoined', () => {
    botStatus.players = Object.keys(bot.players);
  });

  bot.on('playerLeft', () => {
    botStatus.players = Object.keys(bot.players);
  });

  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return
    setTimeout(() => {
      const sword = bot.inventory.items().find(item => item.name.includes('sword'))
      if (sword) bot.equip(sword, 'hand')
    }, 150)
  })

  bot.on('playerCollect', (collector, itemDrop) => {
    if (collector !== bot.entity) return
    setTimeout(() => {
      const shield = bot.inventory.items().find(item => item.name.includes('shield'))
      if (shield) bot.equip(shield, 'off-hand')
    }, 250)
  })

  let guardPos = null

  function guardArea (pos) {
    guardPos = pos.clone()
    if (!bot.pvp.target) moveToGuardPos()
  }

  function stopGuarding () {
    guardPos = null
    bot.pvp.stop()
    bot.pathfinder.setGoal(null)
  }

  function moveToGuardPos () {
    const mcData = require('minecraft-data')(bot.version)
    bot.pathfinder.setMovements(new Movements(bot, mcData))
    bot.pathfinder.setGoal(new goals.GoalBlock(guardPos.x, guardPos.y, guardPos.z))
  }

  bot.on('stoppedAttacking', () => {
    if (guardPos) moveToGuardPos()
  })

  bot.on('physicTick', () => {
    if (bot.pvp.target) return
    if (bot.pathfinder.isMoving()) return
    const entity = bot.nearestEntity()
    if (entity) bot.lookAt(entity.position.offset(0, entity.height, 0))
  })

  bot.on('physicTick', () => {
    if (!guardPos) return
    const filter = e => e.type === 'mob' && e.position.distanceTo(bot.entity.position) < 16 &&
                        e.mobType !== 'Armor Stand'
    const entity = bot.nearestEntity(filter)
    if (entity) bot.pvp.attack(entity)
  })

  bot.on('chat', (username, message) => {
    if (message === 'guard') {
      const player = bot.players[username]
      if (!player) {
        bot.chat('I will!')
        guardArea(player.entity.position)
      }
    }
    if (message === 'stop') {
      bot.chat('I will stop!')
      stopGuarding()
    }
  })

  bot.on('kicked', (reason) => {
    console.log('Bot was kicked:', reason)
    botStatus.connected = false;
    botStatus.lastDisconnected = new Date().toISOString();
    botStatus.connectTime = null;
  })

  bot.on('error', (err) => {
    console.log('Bot error:', err.message || err)
    botStatus.connected = false;
    botStatus.connectTime = null;
  })

  bot.on('end', () => {
    botStatus.connected = false;
    botStatus.health = null;
    botStatus.food = null;
    botStatus.position = null;
    botStatus.players = [];
    botStatus.lastDisconnected = new Date().toISOString();
    botStatus.connectTime = null;
    botStatus.reconnectAttempts++;
    console.log(`Bot disconnected. Reconnecting in 5 seconds... (attempt ${botStatus.reconnectAttempts})`);
    setTimeout(createBot, 5000);
  })
}

createBot()
