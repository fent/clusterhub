var cluster    = require('cluster')
  , EventVat = require('eventvat')


// command constants
var EVENT  = 0
  , ON     = 1
  , OFF    = 2
  , OFFALL = 3
  , READY  = 4


var isMaster = cluster.isMaster;
var isWorker = cluster.isWorker;


/**
 * Shortcut to check if a property exists in an object.
 * @param (Object) obj
 * @param (string) key
 * @return (boolean)
 */
function has(obj, key) {
  return Object.hasOwnProperty.call(obj, key);
}


/**
 * Keep track of hubs and workers
 */
var hubs = {};
var workers = [];
var queue = [];

function queuemsg(fn, msg) {
  if (isReady()) {
    fn(msg);
  } else {
    queue.push({ fn: fn, msg: msg });
  }
}


/**
 * Returns true if all workers are online and ready
 */
function isReady() {
  var online = workers.filter(function(obj) { return obj.ready; });
  return online.length === workers.length;
}


/**
 * When all workers are online, this tells all hubs in the current process
 */
function ready() {
  var key, hub, listener;

  for (key in hubs) {
    if (has(hubs, key)) {
      hub = hubs[key];
      if (hub.isready) continue;
      hub.isready = true;
      while (listener = hub._onready.shift()) listener();
    }
  }
}


/**
 * Filter for only online workers and calls fn on each.
 * @param (Function) fn
 */
function forWorkers(fn) {
  workers = workers.filter(function(child) {
    return !!child.worker._channel;
  });
  workers.forEach(fn);
}


/**
 * Broadcasts an event to all workers
 * @param (string) id Hub id
 * @param (string) event
 * @param (Object) args
 */
function broadcast(id, event, args, origin) {
  forWorkers(function(child) {
    if (origin && child.worker === origin) return;
    if (!has(child.events, event)) return;

    child.worker.send({
      dir   : __dirname
    , hub   : id
    , event : event
    , args  : args
    });

  });
}


/**
 * Emit events for a hub.
 * @param (string) id Hub id
 * @param (string) event
 * @param (Object) args
 */
function emit(id, event, args) {
  var hub = hubs[id];

  // check if there are listeners for this event
  if (!has(hub._listeners, event)) return;
  
  hub._listeners[event].forEach(function(listener) {
    listener.apply({ local: false, remote: true }, args);
  });
}


/**
 * Listen for events from master
 */
process.on('message', function(msg) {
  if (msg.cmd === READY) {
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


/**
 * Forks a worker and keeps a reference to it. Listens for any emitted
 * events so it can distribute them amongst any worker listeners.
 * @return (child)
 */
var origFork = cluster.fork;
cluster.fork = function() {
  var worker = origFork();
  var events = {};
  var obj = { worker: worker, events: events, ready: false };
  workers.push(obj);

  function onmessage(msg) {
    if (msg.cmd === 'online') {
      worker.emit('online');
      obj.ready = true;
      for (var key in hubs) {
        if (has(hubs, key)) hubs[key].emit('online', msg._workerId);
      }

      // check if all workers are online and ready
      if (!isReady()) return;

      // process any messages that were buffered while the hub
      // was not ready
      while (msg = queue.shift()) msg.fn(msg.msg);

      // tell all workers hub is ready
      forWorkers(function(child) {
        child.worker.send({ cmd: READY });
      });

      ready();
      return;
    }

    if (msg.hub === undefined  || msg.cmd === undefined) return;
    if (msg.dir !== __dirname) return;
    if (!has(hubs, msg.hub)) {
      new Hub(msg.hub);
    }

    switch (msg.cmd) {
      // if this is an emitted event, distribute it amongst all workers
      // who are listening for the event. Except the one who sent it
      case EVENT:
        queuemsg(onevent, msg);
        break;

      // if it's on/off, add/remove counters to know if this worker should
      // get notified of any events or not
      case ON:
        onon(msg);
        break;

      case OFF:
        onoff(msg);
        break;

      case OFFALL:
        onoffall(msg);
        break;

      // can be a EventVat command
      // in that case, execute it on the EventVat instance for this hub
      default:
        queuemsg(oncmd, msg);
    }
  }

  function onevent(msg) {
    broadcast(msg.hub, msg.event, msg.args, worker);
    emit(msg.hub, msg.event, msg.args);
  }

  function onon(msg) {
    if (has(events, msg.event)) {
      events[msg.event]++;
    } else {
      events[msg.event] = 1;
    }
  }

  function onoff(msg) {
    if (has(events, msg.event) && --events[msg.event] === 0) {
      delete events[msg.event];
    }
  }

  function onoffall(msg) {
    if (msg.event) {
      if (has(events, msg.event)) {
        delete events[msg.event];
      }
    } else {
      obj.events = events = {};
    }
  }

  function oncmd(msg) {
    var db = hubs[msg.hub]._db;
    var result = db[msg.cmd].apply(db, msg.args);

    // if key is given, then a callback is waiting for the result
    if (msg.key) {
      worker.send({
        dir  : __dirname
      , hub  : msg.hub
      , key  : msg.key
      , args : [result]
      });
    }
  }

  worker.on('message', onmessage);

  return worker;
};


/**
 * Remove workers on death
 */
cluster.on('death', function(worker) {
  workers.forEach(function(obj, i) {
    if (obj.worker === worker) {
      workers.splice(i, 1);
      return false;
    }
  });
});


/**
 * @constructor
 */
function Hub(id) {
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
 * @param (string) event
 * @param (Object) args...
 */
Hub.prototype.emitLocal = function(event) {
  var args = Array.prototype.slice.call(arguments, 1);
  emit(this._id, event, args);
};


/**
 * Emits an event only to all other workes in the hub including master.
 * @param (string) event
 * @param (Object) args...
 */
Hub.prototype.emitRemote = function(event) {
  var args = Array.prototype.slice.call(arguments, 1);

  if (isWorker) {
    this._send({
      cmd: EVENT
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
 * @param (string) event The event to listen for.
 * @param (function(args...)) listener The function that gets called
 *   when one of the workers emits it.
 */
Hub.prototype.on = function(event, listener) {
  if (!has(this._listeners, event)) this._listeners[event] = [];
  this._listeners[event].push(listener);

  if (isWorker) {
    this._send({
      cmd: ON
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
      cmd: OFF
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
 * @param (string) event
 * @param (function(args...)) listener
 */
Hub.prototype.once = function(event, listener) {
  this.many(1, event, listener);
};


/**
 * Removes all listeners for the event.
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
      cmd: OFFALL
    , event: event
    });
  }
};


/**
 * Tells fn when all children in the process are online and ready
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


/**
 * Export an intance of a hub. This can be used if the clusterhub user
 * doesn't wanna bother creating a new hub. It will be considered the global
 * hub. But it cannot be used to communicate with all the other hubs.
 */
var globalHub = new Hub();
globalHub.Hub = Hub;
globalHub.createHub = function(id) {
  return new Hub(id);
};

globalHub.getWorkers = function() {
  return workers.map(function(child) {
    return child.worker;
  });
};

module.exports = globalHub;


// expose cluster
globalHub.isMaster = isMaster;
globalHub.isWorker = isWorker;
globalHub.fork = cluster.fork;
