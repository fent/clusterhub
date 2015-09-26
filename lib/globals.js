var has = require('./util').has;


// Command constants
exports.commands = {
  EVENT  : 0,
  ON     : 1,
  OFF    : 2,
  OFFALL : 3,
  READY  : 4,
};


/**
 * Keep track of hubs and workers
 */
var hubs = exports.hubs = {};
var workers = exports.workers = [];
var queue = exports.queue = [];


/**
 * Returns true if all workers are online and ready.
 */
var isReady = exports.isReady = function isReady() {
  var online = workers.filter(function(obj) { return obj.ready; });
  return online.length === workers.length;
};


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
 * Broadcasts an event to all workers.
 *
 * @param (String) id Hub id
 * @param (String) event
 * @param (Object) args
 * @param (cluster.Worker) origin
 */
exports.broadcast = function broadcast(id, event, args, origin) {
  workers.forEach(function(child) {
    if (origin && child.worker === origin) return;
    if (!has(child.events, event)) return;

    child.worker.send({
      dir   : __dirname,
      hub   : id,
      event : event,
      args  : args,
    });

  });
};


/**
 * Emit events for a hub.
 *
 * @param (String) id Hub id
 * @param (String) event
 * @param (Object) args
 */
exports.emit = function emit(id, event, args) {
  var hub = hubs[id];

  // Check if there are listeners for this event.
  if (!has(hub._listeners, event)) return;
  
  hub._listeners[event].forEach(function(listener) {
    listener.apply({ local: false, remote: true }, args);
  });
};

/**
 * When all workers are online, this tells all hubs in the current process.
 */
exports.ready = function() {
  for (var key in hubs) {
    if (has(hubs, key)) {
      var hub = hubs[key];
      if (hub.isready) continue;
      hub.isready = true;
      var listener;
      while (listener = hub._onready.shift()) listener();
    }
  }
};
