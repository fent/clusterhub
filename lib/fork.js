const cluster    = require('cluster');
const commands   = require('./globals').commands;
const hubs       = require('./globals').hubs;
const workers    = require('./globals').workers;
const allOnline  = require('./globals').allOnline;
const allReady   = require('./globals').allReady;
const ready      = require('./globals').ready;
const parseFuncs = require('./globals').parseFuncs;
const msgqueue   = require('./globals').msgqueue;
const Hub        = require('./hub');


cluster.on('fork', (worker) => {
  const events = new Map();

  const ononline = () => {
    obj.online = true;

    // Check if all workers are online.
    if (!allOnline()) return;

    // Tell all workers hub is ready.
    workers.filter(child => !child.ready).forEach((child) => {
      child.worker.send({ cmd: commands.READY, dir: __dirname });
    });
  };

  const onready = () => {
    obj.ready = true;
    if (allReady()) {
      // Process any messages that were buffered while hubs were not ready.
      let fn;
      while ((fn = msgqueue.shift())) fn();
      ready();
    }
  };

  const oncmd = (msg) => {
    const hub = hubs.get(msg.hub);
    let db, result;
    parseFuncs(hub, msg, worker);
    switch (msg.cmd) {
      // If this is an emitted event, distribute it amongst all workers
      // who are listening for the event. Except the one who sent it.
      case commands.EVENT:
        hub._sendWorkers(msg.event, msg.args, worker);
        hub.emitLocal(msg.event, ...msg.args);
        break;

      // If it's on/off, add/remove counters to know if this worker should
      // get notified of any events or not.
      case commands.ON:
        if (events.has(msg.event)) {
          events.set(msg.event, events.get(msg.event) + 1);
        } else {
          events.set(msg.event, 1);
        }
        break;

      case commands.OFF:
        if (events.has(msg.event)) {
          let n = events.get(msg.event) - 1;
          events.set(msg.event, n);
          if (n === 0) {
            events.delete(msg.event);
          }
        }
        break;

      case commands.OFFALL:
        if (msg.event) {
          events.delete(msg.event);
        } else {
          events.clear();
        }
        break;

      case commands.FN:
        hub._callFunc(msg);
        break;

      // Can be a EventVat command
      // in that case, execute it on the EventVat instance for this hub.
      default:
        db = hubs.get(msg.hub)._db;
        result = db[msg.cmd](...msg.args);

        // If key is given, then a callback is waiting for the result.
        if (msg.key) {
          hub._sendWorker(worker, {
            cmd  : commands.CB,
            key  : msg.key,
            args : [result],
          });
        }
    }
  };

  worker.on('message', (msg) => {
    if (msg.dir !== __dirname) return;
    if (msg.cmd === commands.ONLINE) {
      ononline();
      return;
    }

    if (msg.cmd === commands.READY) {
      onready();
      return;
    }

    if (msg.hub == null || msg.cmd == null) return;
    if (!hubs.has(msg.hub)) {
      new Hub(msg.hub);
    }

    if (allReady()) {
      oncmd(msg);
    } else {
      msgqueue.push(oncmd.bind(this, msg));
    }
  });

  worker.on('disconnect', () => {
    workers.splice(workers.indexOf(obj), 1);
  });

  let obj = {
    worker,
    events,
    online: false,
    ready: false,
  };
  workers.push(obj);
});
