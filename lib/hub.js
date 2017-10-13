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
 * @param (String) id
 */
var Hub = module.exports = function Hub(id) {
  this._id = id || '';
  if (hubs.has(this._id)) return hubs.get(this._id);
  hubs.set(this._id, this);

  this._listeners = new Map();
  this._onready = [];

  if (isMaster) {
    this._db = new EventVat();
    var self = this;

    self._db.onAny(function() {
      var args = Array.prototype.slice.call(arguments, 1);

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
  Hub.prototype[cmd] = function() {
    var args = Array.prototype.slice.call(arguments);
    var cb;

    if (typeof args[args.length - 1] === 'function') {
      cb = args.pop();
    }

    if (isMaster) {
      var rs = this._db[cmd].apply(this._db, args);
      if (cb) process.nextTick(() => { cb(rs); });
      return rs;

    } else {
      // If this is a worker, generate a random number so we know what
      // callback to call when the master responds
      var key;
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
 * @param (Object) message
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
 * @param (String) event
 * @param (Object) args...
 */
Hub.prototype.emit = function() {
  this.emitRemote.apply(this, arguments);
  this.emitLocal.apply(this, arguments);
};


/**
 * @alias for emit
 */
Hub.prototype.publish = Hub.prototype.emit;


/**
 * Emits an event only to the current process.
 *
 * @param (String) event
 * @param (Object) args...
 */
Hub.prototype.emitLocal = function(event) {
  var args = Array.prototype.slice.call(arguments, 1);
  emit(this._id, event, args);
};


/**
 * Emits an event only to all other workes in the hub including master.
 *
 * @param (String) event
 * @param (Object) args...
 */
Hub.prototype.emitRemote = function(event) {
  var args = Array.prototype.slice.call(arguments, 1);

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
 * @param (String) event The event to listen for.
 * @param (Function(args...)) listener The function that gets called
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
 * @param (String) event
 * @param (Function) listener
 */
Hub.prototype.off = function(event, listener) {
  if (!this._listeners.has(event)) return;

  // Remove local listener.
  var listeners = this._listeners.get(event);
  var found = false;
  for (var i = 0, l = listeners.length; i < l; i++) {
    var liss = listeners[i];
    if (liss === listener || liss.listener === listener) {
      listeners.splice(i, 1);
      found = true;
      break;
    }
  }

  // Tell master there is one less listener for this event.
  if (found && isWorker) {
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
 * @param (Number) n
 * @param (String) event
 * @param (Function(args...)) listener
 */
Hub.prototype.many = function(n, event, listener) {
  var self = this;

  function wrapper() {
    if (--n === 0) self.off(event, listener);
    listener.apply(this, arguments);
  }
  wrapper.listener = listener;

  self.on(event, wrapper);
};


/**
 * Shortcut for `many(1, event, listener)`
 *
 * @param (String) event
 * @param (Function(args...)) listener
 */
Hub.prototype.once = function(event, listener) {
  this.many(1, event, listener);
};


/**
 * Removes all listeners for the event.
 *
 * @param (String) event
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
