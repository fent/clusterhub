const commands   = require('./globals').commands;
const hubs       = require('./globals').hubs;
const ready      = require('./globals').ready;
const parseFuncs = require('./globals').parseFuncs;


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
  let fn;
  if (!hub) return;

  switch (msg.cmd) {
    case commands.CMD:
      parseFuncs(hub, msg);
      hub.emitLocal(msg.event, ...msg.args);
      break;

    // It can be a response to another command too.
    case commands.CB:
      fn = hub._callbacks.get(msg.key);
      if (fn) {
        fn(...msg.args);
        hub._callbacks.delete(msg.key);
      }
      break;

    case commands.FN:
      hub._callFunc(msg);
      break;
  }
});

// Let master know this worker is ready to receive messages.
process.send({ cmd: commands.ONLINE, dir: __dirname });
