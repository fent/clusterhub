const commands = require('./globals').commands;
const hubs     = require('./globals').hubs;
const emit     = require('./globals').emit;
const ready    = require('./globals').ready;


/**
 * Listen for events from master
 */
process.on('message', (msg) => {
  if (msg.cmd === commands.READY) {
    return ready();
  }

  // check if hub exists
  if (msg.dir !== __dirname) return;
  if (msg.hub === undefined || !hubs.has(msg.hub)) return;
  var hub = hubs.get(msg.hub);

  if (msg.event) {
    emit(msg.hub, msg.event, msg.args);

  } else {
    // it can be a response to another command too
    hub._cb.get(msg.key).apply(null, msg.args);
    hub._cb.delete(msg.key);
  }
});
