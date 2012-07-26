var cluster   = require('cluster')
  , EventVat  = require('eventvat')
  , has       = require('./util').has
  , commands  = require('./globals').commands
  , hubs      = require('./globals').hubs
  , broadcast = require('./globals').broadcast
  , emit      = require('./globals').emit
  , isMaster  = cluster.isMaster
  , isWorker  = cluster.isWorker
  ;


/**
 * @constructor
 * @param (string) id
 */
var Hub = module.exports = function Hub(id) {
  this._id = id || '';
  if (has(hubs, this._id)) return hubs[this._id];
  hubs[this._id] = this;

  this._listeners = {};
  this.isready = false;
  this._onready = [];

  if (isMaster) {
    this._db = new EventVat();
    var self = this;

    self._db.onAny(function() {
      var args = Array.prototype.slice.call(arguments);

      if (has(self._listeners, this.event)) {
        self._listeners[this.event].forEach(function(listener) {
          listener.apply(null, args);
        });
      }
      broadcast(self._id, this.event, args);
    });

  } else {
    this._cb = {};
  }
};


/**
 * Attach all commands from EventVat to Hub. This sends a command to the
 * master process to do with hub data.
 */
Object.keys(EventVat.prototype).forEach(function(cmd) {
  Hub.prototype[cmd] = function() {
    var self = this
      , args = Array.prototype.slice.call(arguments)
      , cb

    if (typeof args[args.length - 1] === 'function') {
      cb = args.pop();
    }

    if (isMaster) {
      var rs = self._db[cmd].apply(self._db, args)
      if (cb) process.nextTick(function() { cb(rs); });
      return rs;

    } else {
      // if this is a worker, generate a random number so we know what
      // callback to call when the master responds
      if (cb) {
        var key;
        while (has(self._cb, (key = Math.floor(Math.random() * 20000))));
        self._cb[key] = cb;
      }

      self._send({
        cmd: cmd
      , args: args
      , key: key
      });

    }
  };
});


/**
 * Sends message to master/worker
 *
 * @param (Object) message
 */
Hub.prototype._send = function(message) {
  message.dir = __dirname;
  message.hub = this._id;

  // check if channel is open
  if (!process._channel) {
    this.emitLocal('error', new Error('Master channel closed'));
    return;
  }

  process.send(message);
};


/**
 * Emits event to all workers and the master in the hub.
 *
 * @param (string) event
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
 * @param (string) event
 * @param (Object) args...
 */
Hub.prototype.emitLocal = function(event) {
  var args = Array.prototype.slice.call(arguments, 1);
  emit(this._id, event, args);
};


/**
 * Emits an event only to all other workes in the hub including master.
 *
 * @param (string) event
 * @param (Object) args...
 */
Hub.prototype.emitRemote = function(event) {
  var args = Array.prototype.slice.call(arguments, 1);

  if (isWorker) {
    this._send({
      cmd: commands.EVENT
    , event: event
    , args: args
    });
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
 * @param (string) event The event to listen for.
 * @param (function(args...)) listener The function that gets called
 *   when one of the workers emits it.
 */
Hub.prototype.on = function(event, listener) {
  if (!has(this._listeners, event)) this._listeners[event] = [];
  this._listeners[event].push(listener);

  if (isWorker) {
    this._send({
      cmd: commands.ON
    , event: event
    });
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
 * @param (string) event
 * @param (function) listener
 */
Hub.prototype.off = function(event, listener) {
  if (!has(this._listeners, event)) return;

  // remove local listener
  var listeners = this._listeners[event];
  var found = false;
  for (var i = 0, l = listeners.length; i < l; i++) {
    var liss = listeners[i];
    if (liss === listener || liss.listener === listener) {
      listeners.splice(i, 1);
      found = true;
      break;
    }
  }

  // tell master there is one less listener for this event
  if (found && isWorker) {
    this._send({
      cmd: commands.OFF
    , event: event
    });
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
 * @param (number) n
 * @param (string) event
 * @param (function(args...)) listener
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
 * @param (string) event
 * @param (function(args...)) listener
 */
Hub.prototype.once = function(event, listener) {
  this.many(1, event, listener);
};


/**
 * Removes all listeners for the event.
 *
 * @param (string) event
 */
Hub.prototype.removeAllListeners = function(event) {
  if (event) {
    if (has(this._listeners, event)) {
      delete this._listeners[event];
    }
  } else {
    this._listeners = {};
  }

  if (isWorker) {
    this._send({
      cmd: commands.OFFALL
    , event: event
    });
  }
};


/**
 * Calls fn when all children in the process are online and ready
 */
Hub.prototype.ready = function(fn) {
  if (this.isready) {
    process.nextTick(fn);
  } else {
    this._onready.push(fn);
  }
};


/**
 * Removes Hub instance from memory
 */
Hub.prototype.destroy = function() {
  this._db.die();
  delete hubs[this._id];
};
