const cluster   = require('cluster');
const EventVat  = require('eventvat');
const commands  = require('./globals').commands;
const hubs      = require('./globals').hubs;
const broadcast = require('./globals').broadcast;
const emit      = require('./globals').emit;
const isMaster  = cluster.isMaster;
const isWorker  = cluster.isWorker;


/**
 * @constructor
 * @param {string} id
 */
let Hub = module.exports = function Hub(id) {
  this._id = id || '';
  if (hubs.has(this._id)) return hubs.get(this._id);
  hubs.set(this._id, this);

  this._listeners = new Map();
  this._onready = [];

  if (isMaster) {
    this._db = new EventVat();
    let self = this;

    self._db.onAny(function() {
      let args = Array.prototype.slice.call(arguments, 1);

      if (self._listeners.has(this.event)) {
        self._listeners.get(this.event).forEach((listener) => {
          listener.apply(null, args);
        });
      }
      broadcast(self._id, this.event, args);
    });

  } else {
    this._cb = new Map();
  }
};

Hub.prototype.isready = false;


/**
 * Attach all commands from EventVat to Hub. This sends a command to the
 * master process to do with hub data.
 */
Object.keys(EventVat.prototype).forEach((cmd) => {
  Hub.prototype[cmd] = function(...args) {
    let cb;
    if (typeof args[args.length - 1] === 'function') {
      cb = args.pop();
    }

    if (isMaster) {
      let rs = this._db[cmd](...args);
      if (cb) process.nextTick(() => { cb(rs); });
      return rs;

    } else {
      // If this is a worker, generate a random number so we know what
      // callback to call when the master responds.
      let key;
      if (cb) {
        while (this._cb.has((key = Math.floor(Math.random() * 20000))));
        this._cb.set(key, cb);
      }

      this._send({ cmd, args, key });
    }
  };
});


/**
 * Sends message to master/worker.
 *
 * @param {Object} message
 */
Hub.prototype._send = function(message) {
  message.dir = __dirname;
  message.hub = this._id;

  // Check if channel is open.
  if (!process._channel) {
    this.emitLocal('error', new Error('Master channel closed'));
    return;
  }

  process.send(message);
};


/**
 * Emits event to all workers and the master in the hub.
 *
 * @param {string} event
 * @param {Object} ...args
 */
Hub.prototype.emit = function(...args) {
  this.emitRemote(...args);
  this.emitLocal(...args);
};


/**
 * @alias for emit
 */
Hub.prototype.publish = Hub.prototype.emit;


/**
 * Emits an event only to the current process.
 *
 * @param {string} event
 * @param {Array.<Object>} ...args
 */
Hub.prototype.emitLocal = function(event, ...args) {
  emit(this._id, event, args);
};


/**
 * Emits an event only to all other workes in the hub including master.
 *
 * @param {string} event
 * @param {Object} ...args
 */
Hub.prototype.emitRemote = function(event, ...args) {
  if (isWorker) {
    this._send({ cmd: commands.EVENT, event, args });
  } else {
    broadcast(this._id, event, args);
  }
};


/**
 * @alias for emitRemote
 */
Hub.prototype.broadcast = Hub.prototype.emitRemote;


/**
 * Starts listening to an event within the hub.
 *
 * @param {string} event The event to listen for.
 * @param {Function(...args)} listener The function that gets called
 *   when one of the workers emits it.
 */
Hub.prototype.on = function(event, listener) {
  if (!this._listeners.has(event)) this._listeners.set(event, []);
  this._listeners.get(event).push(listener);

  if (isWorker) {
    this._send({ cmd: commands.ON, event });
  }
};


/**
 * @alias for on
 */
Hub.prototype.addListener = Hub.prototype.on;
Hub.prototype.subscribe = Hub.prototype.on;


/**
 * Removes a listener from listening to an event.
 *
 * @param {string} event
 * @param {Function} listener
 */
Hub.prototype.off = function(event, listener) {
  if (!this._listeners.has(event)) return;

  // Remove local listener.
  let listeners = this._listeners.get(event);
  let i = listeners
    .findIndex(liss => liss === listener || liss.listener === listener);
  if (i > -1) {
    listeners.splice(i, 1);
  }

  // Tell master there is one less listener for this event.
  if (i > -1 && isWorker) {
    this._send({ cmd: commands.OFF, event });
  }
};


/**
 * @alias
 */
Hub.prototype.removeListener = Hub.prototype.off;
Hub.prototype.unsubscribe = Hub.prototype.off;


/**
 * Listens for n number of the event and then stops listening.
 *
 * @param {number} n
 * @param {string} event
 * @param {Function(...args)} listener
 */
Hub.prototype.many = function(n, event, listener) {
  const wrapper = (...args) => {
    if (--n === 0) this.off(event, listener);
    listener(...args);
  };
  wrapper.listener = listener;
  this.on(event, wrapper);
};


/**
 * Shortcut for `many(1, event, listener)`
 *
 * @param {string} event
 * @param {Function(args...)} listener
 */
Hub.prototype.once = function(event, listener) {
  this.many(1, event, listener);
};


/**
 * Removes all listeners for the event.
 *
 * @param {string} event
 */
Hub.prototype.removeAllListeners = function(event) {
  if (event) {
    this._listeners.delete(event);
  } else {
    this._listeners.clear();
  }

  if (isWorker) {
    this._send({ cmd: commands.OFFALL, event });
  }
};


/**
 * Calls fn when all children in the process are online and ready.
 */
Hub.prototype.ready = function(fn) {
  if (this.isready) {
    process.nextTick(fn);
  } else {
    this._onready.push(fn);
  }
};


/**
 * Removes Hub instance from memory.
 */
Hub.prototype.destroy = function() {
  this._db.die();
  hubs.delete(this._id);
};
