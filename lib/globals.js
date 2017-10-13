// Command constants.
exports.commands = {
  EVENT  : 0,
  ON     : 1,
  OFF    : 2,
  OFFALL : 3,
  READY  : 4,
};


/**
 * Keep track of hubs and workers.
 */
const hubs = exports.hubs = new Map();
const workers = exports.workers = [];
const queue = exports.queue = [];


/**
 * Returns true if all workers are online and ready.
 */
const isReady = exports.isReady = function isReady() {
  var online = workers.filter(function(obj) { return obj.ready; });
  return online.length === workers.length;
};


/**
 * Messages will be queued until all workers are online.
 */
exports.queuemsg = (fn, msg) => {
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
exports.broadcast = (id, event, args, origin) => {
  workers.forEach((child) => {
    if (origin && child.worker === origin) return;
    if (!child.events.has(event)) return;

    child.worker.send({
      dir   : __dirname,
      hub   : id,
      event,
      args,
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
exports.emit = (id, event, args) => {
  var hub = hubs.get(id);

  // Check if there are listeners for this event.
  if (!hub._listeners.has(event)) return;
  
  hub._listeners.get(event).forEach((listener) => {
    listener.apply({ local: false, remote: true }, args);
  });
};

/**
 * When all workers are online, this tells all hubs in the current process.
 */
exports.ready = () => {
  for (var entry of hubs.entries()) {
    var hub = entry[1];
    if (hub.isready) continue;
    hub.isready = true;
    var listener;
    while ((listener = hub._onready.shift()) != null) listener();
  }
};
