const cluster   = require('cluster');
const commands  = require('./globals').commands;
const hubs      = require('./globals').hubs;
const workers   = require('./globals').workers;
const queue     = require('./globals').queue;
const queuemsg  = require('./globals').queuemsg;
const isReady   = require('./globals').isReady;
const broadcast = require('./globals').broadcast;
const emit      = require('./globals').emit;
const ready     = require('./globals').ready;
const Hub       = require('./hub');


/**
 * Forks a worker and keeps a reference to it. Listens for any emitted
 * events so it can distribute them amongst any worker listeners.
 *
 * @return {cluster.Worker}
 */
const origFork = cluster.fork.bind(cluster);
cluster.fork = (env) => {
  let worker = origFork(env);
  let events = new Map();

  const onmessage = (msg) => {
    if (msg.cmd === commands.READY) {
      onready(msg);
      return;
    }

    if (msg.hub === undefined || msg.cmd === undefined) return;
    if (msg.dir !== __dirname) return;
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

    // Check if all workers are online and ready.
    if (!isReady()) return;

    // Process any messages that were buffered while the hub was not ready.
    let msg;
    while ((msg = queue.shift())) msg.fn(msg.msg);

    // Tell all workers hub is ready.
    workers.filter(child => !child.readySent).forEach((child) => {
      child.worker.send({ cmd: commands.READY });
      child.readySent = true;
    });

    ready();
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
    worker.removeListener('message', obj.onmessage);
  };

  worker.on('message', onmessage);
  worker.on('exit', onexit);
  worker.on('disconnect', onexit);

  let obj = {
    worker,
    events,
    onmessage,
    ready: false,
    readySent: false,
  };
  workers.push(obj);

  return worker;
};
