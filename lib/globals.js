var has = require('./util').has
  ;


// command constants
exports.commands = {
  EVENT  : 0
, ON     : 1
, OFF    : 2
, OFFALL : 3
, READY  : 4
};


/**
 * Keep track of hubs and workers
 */
var hubs = exports.hubs = {};
var workers = exports.workers = [];
var queue = exports.queue = [];


/**
 * Messages will be queued until all workers are online.
 */
exports.queuemsg = function queuemsg(fn, msg) {
  if (isReady()) {
    fn(msg);
  } else {
    queue.push({ fn: fn, msg: msg });
  }
};


/**
 * Returns true if all workers are online and ready
 */
var isReady = exports.isReady = function isReady() {
  var online = workers.filter(function(obj) { return obj.ready; });
  return online.length === workers.length;
};


/**
 * Broadcasts an event to all workers
 *
 * @param (string) id Hub id
 * @param (string) event
 * @param (Object) args
 * @param (Worker) origin
 */
exports.broadcast = function broadcast(id, event, args, origin) {
  workers.forEach(function(child) {
    if (origin && child.worker === origin) return;
    if (!has(child.events, event)) return;

    child.worker.send({
      dir   : __dirname
    , hub   : id
    , event : event
    , args  : args
    });

  });
};


/**
 * Emit events for a hub.
 *
 * @param (string) id Hub id
 * @param (string) event
 * @param (Object) args
 */
exports.emit = function emit(id, event, args) {
  var hub = hubs[id];

  // check if there are listeners for this event
  if (!has(hub._listeners, event)) return;
  
  hub._listeners[event].forEach(function(listener) {
    listener.apply({ local: false, remote: true }, args);
  });
};
