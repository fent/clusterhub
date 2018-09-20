const isWorker = require('cluster').isWorker;


// Command constants.
exports.commands = {
  EVENT  : 0, // Event emitted
  ON     : 1, // Worker listening to event
  OFF    : 2, // Worker stops listening to event
  OFFALL : 3, // Worker stops listsening to all events of name
  ONLINE : 4, // Worker is online
  READY  : 5, // All workers are online and connected to master
  CB     : 6, // Worker receives callback to a db method
  FN     : 7, // Emitted function is called
};


/**
 * Keep track of hubs and workers.
 */
exports.hubs = new Map();
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

/**
 * If a message received contains references to functions from another process,
 * add a function to the args that when called, will let the other process know.
 *
 * If the function is garbage collected, it lets the other process know
 * that it's safe to delete it from its hub.
 *
 * @param {Hub} hub
 * @param {Object} msg
 * @param {!cluster.Worker} worker
 */
exports.parseFuncs = (hub, msg, worker) => {
  const send = worker ?
    (msg) => hub._sendWorker(worker, msg) :
    (msg) => hub._sendMaster(msg);
  if (msg.funcs) {
    for (let i = msg.funcs.length - 1; i >= 0; i--) {
      const func = msg.funcs[i];
      const fn = (...args) => send({
        cmd : exports.commands.FN,
        key : func.key,
        args,
      });
      msg.args.splice(func.i, 0, fn);
    }
  }
};
