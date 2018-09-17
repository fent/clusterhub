const cluster   = require('cluster');
const commands  = require('./globals').commands;
const hubs      = require('./globals').hubs;
const workers   = require('./globals').workers;
const allOnline = require('./globals').allOnline;
const allReady  = require('./globals').allReady;
const broadcast = require('./globals').broadcast;
const emit      = require('./globals').emit;
const ready     = require('./globals').ready;
const Hub       = require('./hub');


cluster.on('fork', (worker) => {
  const events = new Map();
  const queue = [];

  const ononline = () => {
    obj.online = true;

    // Check if all workers are online.
    if (!allOnline()) return;

    // Tell all workers hub is ready.
    workers.filter(child => !child.ready).forEach((child) => {
      child.worker.send({ cmd: commands.READY, dir: __dirname });
    });
  };

  const onmessage = (msg) => {
    if (msg.dir !== __dirname) return;
    if (msg.cmd === commands.READY) {
      onready();
      return;
    }

    if (msg.hub === undefined || msg.cmd === undefined) return;
    if (!hubs.has(msg.hub)) {
      new Hub(msg.hub);
    }

    switch (msg.cmd) {
      // If this is an emitted event, distribute it amongst all workers
      // who are listening for the event. Except the one who sent it.
      case commands.EVENT:
        queuemsg(onevent, msg);
        break;

      // If it's on/off, add/remove counters to know if this worker should
      // get notified of any events or not.
      case commands.ON:
        onon(msg);
        break;

      case commands.OFF:
        onoff(msg);
        break;

      case commands.OFFALL:
        onoffall(msg);
        break;

      // Can be a EventVat command
      // in that case, execute it on the EventVat instance for this hub.
      default:
        queuemsg(oncmd, msg);
    }
  };

  const queuemsg = (fn, msg) => {
    if (allReady()) {
      fn(msg);
    } else {
      queue.push({ fn, msg });
    }
  };

  const onevent = (msg) => {
    broadcast(msg.hub, msg.event, msg.args, worker);
    emit(msg.hub, msg.event, msg.args);
  };

  const onon = (msg) => {
    if (events.has(msg.event)) {
      events.set(events.get, events.get(msg.event) + 1);
    } else {
      events.set(msg.event, 1);
    }
  };

  const onoff = (msg) => {
    if (events.has(msg.event)) {
      let n = events.get(msg.event) - 1;
      events.set(msg.event, n);
      if (n === 0) {
        events.delete(msg.event);
      }
    }
  };

  const onready = () => {
    obj.ready = true;
    if (allReady()) {
      ready();
      // Process any messages that were buffered while hubs were not ready.
      let msg;
      for (let worker of workers) {
        while ((msg = worker.queue.shift())) msg.fn(msg.msg);
      }
    }
  };

  const onoffall = (msg) => {
    if (msg.event) {
      events.delete(msg.event);
    } else {
      events.clear();
    }
  };

  const oncmd = (msg) => {
    const db = hubs.get(msg.hub)._db;
    const result = db[msg.cmd].apply(db, msg.args);

    // If key is given, then a callback is waiting for the result.
    if (msg.key) {
      worker.send({
        dir  : __dirname,
        hub  : msg.hub,
        key  : msg.key,
        args : [result],
      });
    }
  };
  
  const onexit = () => {
    let index = workers.indexOf(obj);
    if (index >= 0) {
      workers.splice(index, 1);
    }
    worker.removeListener('online', ononline);
    worker.removeListener('message', onmessage);
  };

  worker.on('online', ononline);
  worker.on('message', onmessage);
  worker.on('exit', onexit);
  worker.on('disconnect', onexit);

  let obj = {
    worker,
    events,
    queue,
    online: false,
    ready: false,
  };
  workers.push(obj);
});
