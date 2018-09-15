const cluster   = require('cluster');
const EventVat  = require('eventvat');
const commands  = require('./globals').commands;
const hubs      = require('./globals').hubs;
const broadcast = require('./globals').broadcast;
const emit      = require('./globals').emit;
const isMaster  = cluster.isMaster;
const isWorker  = cluster.isWorker;


module.exports = class Hub {
  /**
   * @constructor
   * @param {string} id
   */
  constructor(id) {
    this._id = id || '';
    hubs.set(this._id, this);
    this.isready = false;
    this._listeners = new Map();
    this._onready = [];

    if (isMaster) {
      this._db = new EventVat();
      this._db.onAny((event, ...args) => {
        if (this._listeners.has(event)) {
          this._listeners.get(event).forEach((listener) => {
            listener(...args);
          });
        }
        broadcast(this._id, event, args);
      });

    } else {
      this._cb = new Map();
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

    // Define some aliases.
    this.publish = this.emit;
    this.broadcast = this.emitRemote;
    this.addListener = this.on;
    this.subscribe = this.on;
    this.removeLIstener = this.off;
    this.unsubscribe = this.off;

  }

  /**
   * Sends message to master/worker.
   *
   * @param {Object} message
   */
  _send(message) {
    message.dir = __dirname;
    message.hub = this._id;

    // Check if channel is open.
    if (!process._channel) {
      this.emitLocal('error', new Error('Master channel closed'));
      return;
    }

    process.send(message);
  }

  /**
   * Emits event to all workers and the master in the hub.
   *
   * @param {string} event
   * @param {Object} ...args
   */
  emit(...args) {
    this.emitRemote(...args);
    this.emitLocal(...args);
  }

  /**
   * Emits an event only to the current process.
   *
   * @param {string} event
   * @param {Array.<Object>} ...args
   */
  emitLocal(event, ...args) {
    emit(this._id, event, args);
  }

  /**
   * Emits an event only to all other workes in the hub including master.
   *
   * @param {string} event
   * @param {Object} ...args
   */
  emitRemote(event, ...args) {
    if (isWorker) {
      this._send({ cmd: commands.EVENT, event, args });
    } else {
      broadcast(this._id, event, args);
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
      this._send({ cmd: commands.ON, event });
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
    }

    // Tell master there is one less listener for this event.
    if (i > -1 && isWorker) {
      this._send({ cmd: commands.OFF, event });
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
      this._send({ cmd: commands.OFFALL, event });
    }
  }

  /**
   * Calls cb when all children in the process are online and ready.
   *
   * @param {Fuction} cb
   */
  ready(cb) {
    if (this.isready) {
      process.nextTick(cb);
    } else {
      this._onready.push(cb);
    }
  }

  /**
   * Removes Hub instance from memory.
   */
  destroy() {
    this._db.die();
    hubs.delete(this._id);
  }
};
