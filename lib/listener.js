const commands = require('./globals').commands;
const hubs     = require('./globals').hubs;
const emit     = require('./globals').emit;
const ready    = require('./globals').ready;


/**
 * Listen for events from master.
 */
process.on('message', (msg) => {
  if (msg.dir !== __dirname) return;
  if (msg.cmd === commands.READY) {
    return ready();
  }

  // Check if hub exists.
  const hub = hubs.get(msg.hub);
  if (!hub) return;

  if (msg.event) {
    hub.emitLocal(msg.event, ...msg.args);

  } else {
    // It can be a response to another command too.
    hub._cb.get(msg.key)(...msg.args);
    hub._cb.delete(msg.key);
  }
});

// Let master know this worker is ready to receive messages.
process.send({ cmd: commands.ONLINE, dir: __dirname });
