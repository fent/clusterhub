var has      = require('./util').has;
var commands = require('./globals').commands;
var hubs     = require('./globals').hubs;
var emit     = require('./globals').emit;
var ready    = require('./globals').ready;


/**
 * Listen for events from master
 */
process.on('message', function(msg) {
  if (msg.cmd === commands.READY) {
    return ready();
  }

  // check if hub exists
  if (msg.dir !== __dirname) return;
  if (msg.hub === undefined || !has(hubs, msg.hub)) return;
  var hub = hubs[msg.hub];

  if (msg.event) {
    emit(msg.hub, msg.event, msg.args);

  } else {
    // it can be a response to another command too
    hub._cb[msg.key].apply(null, msg.args);
    delete hub._cb[msg.key];
  }
});
