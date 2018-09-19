const isWorker = require('cluster').isWorker;


// Command constants.
exports.commands = {
  EVENT  : 0,
  ON     : 1,
  OFF    : 2,
  OFFALL : 3,
  ONLINE : 4,
  READY  : 5,
};


/**
 * Keep track of hubs and workers.
 */
const hubs = exports.hubs = new Map();
const workers = exports.workers = [];
const msgqueue = exports.msgqueue = [];
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
exports.allReady = () => {
  return workers.length && workers.every(obj => obj.ready);
};

/**
 * Calls `fn` when all workers are online and ready.
 */
exports.onReady = (fn) => {
  if (exports.allReady() && !msgqueue.length) {
    fn();
  } else {
    onready.push(fn);
  }
};

/**
 * When all workers are online, this tells all hubs in the current process.
 */
exports.ready = () => {
  let listener;
  while ((listener = onready.shift()) != null) listener();
  if (!exports.allReady() && isWorker) {
    process.send({ cmd: exports.commands.READY, dir: __dirname });
  }
};
