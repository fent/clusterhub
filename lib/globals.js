const isWorker = require('cluster').isWorker;


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
const onready = [];


/**
 * Returns true if all workers are online and ready.
 */
exports.allOnline = () => {
  return workers.length && workers.every(obj => obj.online);
};

/**
 * Returns true if all workers are online and ready to communicate.
 */
const allReady = exports.allReady = () => {
  return workers.length && workers.every(obj => obj.ready);
};

/**
 * Broadcasts an event to all workers.
 *
 * @param {string} id Hub id
 * @param {string} event
 * @param {Array.<Object>} args
 * @param {cluster.Worker} origin
 */
exports.broadcast = (id, event, args, origin) => {
  exports.onReady(() => {
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
  });
};

/**
 * Calls `fn` when all workers are online and ready.
 */
exports.onReady = (fn) => {
  if (allReady()) {
    fn();
  } else {
    onready.push(fn);
  }
};

/**
 * Emit events for a hub.
 *
 * @param {string} id Hub id
 * @param {string} event
 * @param {Array.<Object>} args
 */
exports.emit = (id, event, args) => {
  const hub = hubs.get(id);

  // Check if there are listeners for this event.
  if (!hub._listeners.has(event)) return;
  
  hub._listeners.get(event).forEach((listener) => {
    listener(...args);
  });
};

/**
 * When all workers are online, this tells all hubs in the current process.
 */
exports.ready = () => {
  let listener;
  while ((listener = onready.shift()) != null) listener();
  if (!allReady() && isWorker) {
    process.send({ cmd: exports.commands.READY, dir: __dirname });
  }
};
