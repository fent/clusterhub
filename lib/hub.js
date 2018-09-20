const cluster  = require('cluster');
const EventVat = require('eventvat');
const commands = require('./globals').commands;
const hubs     = require('./globals').hubs;
const onReady  = require('./globals').onReady;
const workers  = require('./globals').workers;
const isMaster = cluster.isMaster;
const isWorker = cluster.isWorker;


module.exports = class Hub {
  /**
   * @constructor
   * @param {string} id
   */
  constructor(id) {
    this._id = id || '';
    hubs.set(this._id, this);
    this._listeners = new Map();
    this._funcs = new Map();
    this._funcsHistory = new Set();
    this._maxFuncs = 100;

    if (isMaster) {
      this._db = new EventVat();
      this._db.onAny((event, ...args) => {
        this._sendWorkers(event, args);
        this.emitLocal(event, ...args);
      });

    } else {
      this._callbacks = new Map();
    }

    // Attach all commands from EventVat to Hub. This sends a command to the
    // master process to deal with hub data.
    Object.keys(EventVat.prototype).forEach((cmd) => {
      if (typeof this[cmd] === 'function') return;
      this[cmd] = (...args) => {
        let cb;
        if (typeof args[args.length - 1] === 'function') {
          cb = args.pop();
        }

        if (isMaster) {
          let rs = this._db[cmd](...args);
          if (cb) process.nextTick(() => { cb(rs); });
          return rs;

        } else {
          const key = this._keyFunc(this._callbacks, cb);
          this._sendMaster({ cmd, args, key });
        }
      };
    });

    // Define some aliases.
    this.publish = this.emit;
    this.broadcast = this.emitRemote;
    this.addListener = this.on;
    this.subscribe = this.on;
    this.removeLIstener = this.off;
    this.unsubscribe = this.off;

  }

  /**
   * Sends an event to all workers.
   *
   * @param {string} event
   * @param {Array.<Object>} args
   * @param {!cluster.Worker} origin
   */
  _sendWorkers(event, args, origin) {
    onReady(() => {
      args = args.slice();
      const funcs = this._keyArgFuncs(args);
      workers
        .filter(child => child.worker !== origin && child.events.has(event))
        .forEach((child) => {
          this._sendWorker(child.worker, { event, args, funcs });
        });
    });
  }

  /**
   * Send message to a single worker.
   *
   * @param {cluster.Worker} worker
   * @param {Object} msg
   */
  _sendWorker(worker, msg) {
    msg.dir = __dirname;
    msg.hub = this._id;
    worker.send(msg);
  }

  /**
   * Sends message to master.
   *
   * @param {Object} msg
   */
  _sendMaster(msg) {
    msg.dir = __dirname;
    msg.hub = this._id;
    if (msg.args) {
      msg.args = msg.args.slice();
      msg.funcs = this._keyArgFuncs(msg.args);
    }
    process.send(msg);
  }

  /**
   * Assigns a key to a function so that it can be called from another process.
   *
   * @param {Map} map
   * @param {Function} fn
   * @return {string} key
   */
  _keyFunc(map, fn) {
    let key;
    if (fn) {
      while (map.has((key = Math.ceil(Math.random() * 20000))));
      map.set(key, fn);
    }
    return key;
  }


  /**
   * Save references for arguments that are functions,
   * letting them be called by other processes.
   *
   * @param {Array.<Object>} args
   * @return {Array.<Object} Array of indices and keys for reference.
   */
  _keyArgFuncs(args) {
    const funcs = [];
    for (let i = args.length - 1; i >= 0; i--) {
      const arg = args[i];
      if (typeof arg === 'function') {
        args.splice(i, 1);
        funcs.push({ i, key: this._keyFunc(this._funcs, arg) });
      }
    }
    return funcs.length ? funcs : null;
  }

  /**
   * Calls a function that was called by another process.
   *
   * @param {Object} msg
   */
  _callFunc(msg) {
    const fn = this._funcs.get(msg.key);
    if (fn) {
      fn(...msg.args);
      this._funcsHistory.delete(msg.key);
      this._funcsHistory.add(msg.key);
      if (this._funcsHistory.size > this._maxFuncs) {
        const key = this._funcsHistory.keys().next().value;
        this._funcs.delete(key);
        this._funcsHistory.delete(key);
      }
    }
  }

  /**
   * Emits event to all workers and the master in the hub.
   *
   * @param {string} event
   * @param {Object} ...args
   */
  emit(event, ...args) {
    this.emitRemote(event, ...args);
    this.emitLocal(event, ...args);
  }

  /**
   * Emits an event only to the current process.
   *
   * @param {string} event
   * @param {Array.<Object>} ...args
   */
  emitLocal(event, ...args) {
    // Check if there are listeners for this event.
    if (!this._listeners.has(event)) return;
    this._listeners.get(event).forEach((listener) => {
      listener(...args);
    });
  }

  /**
   * Emits an event only to all other workes in the hub including master.
   *
   * @param {string} event
   * @param {Object} ...args
   */
  emitRemote(event, ...args) {
    if (isWorker) {
      this._sendMaster({ cmd: commands.EVENT, event, args });
    } else {
      this._sendWorkers(event, args);
    }
  }

  /**
   * Starts listening to an event within the hub.
   *
   * @param {string} event The event to listen for.
   * @param {Function(...args)} listener The function that gets called
   *   when one of the workers emits it.
   */
  on(event, listener) {
    if (!this._listeners.has(event)) this._listeners.set(event, []);
    this._listeners.get(event).push(listener);

    if (isWorker) {
      this._sendMaster({ cmd: commands.ON, event });
    }
  }

  /**
   * Removes a listener from listening to an event.
   *
   * @param {string} event
   * @param {Function} listener
   */
  off(event, listener) {
    if (!this._listeners.has(event)) return;

    // Remove local listener.
    let listeners = this._listeners.get(event);
    let i = listeners
      .findIndex(liss => liss === listener || liss.listener === listener);
    if (i > -1) {
      listeners.splice(i, 1);

      // Tell master there is one less listener for this event.
      if (isWorker) {
        this._sendMaster({ cmd: commands.OFF, event });
      }
    }
  }

  /**
   * Listens for n number of the event and then stops listening.
   *
   * @param {number} n
   * @param {string} event
   * @param {Function(...args)} listener
   */
  many(n, event, listener) {
    const wrapper = (...args) => {
      if (--n === 0) this.off(event, listener);
      listener(...args);
    };
    wrapper.listener = listener;
    this.on(event, wrapper);
  }

  /**
   * Shortcut for `many(1, event, listener)`
   *
   * @param {string} event
   * @param {Function(...args)} listener
   */
  once(event, listener) {
    this.many(1, event, listener);
  }

  /**
   * Removes all listeners for the event.
   *
   * @param {string} event
   */
  removeAllListeners(event) {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }

    if (isWorker) {
      this._sendMaster({ cmd: commands.OFFALL, event });
    }
  }

  /**
   * Removes all listeners and clears the db.
   */
  reset() {
    this.removeAllListeners();
    this._funcs.clear();
    this._funcsHistory.clear();
    if (isMaster) {
      this._db.die();
    } else {
      this._callbacks.clear();
    }
  }

  /**
   * Removes Hub instance from memory.
   */
  destroy() {
    this.reset();
    hubs.delete(this._id);
  }
};
