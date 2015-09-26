var cluster   = require('cluster');
var has       = require('./util').has;
var commands  = require('./globals').commands;
var hubs      = require('./globals').hubs;
var workers   = require('./globals').workers;
var queue     = require('./globals').queue;
var queuemsg  = require('./globals').queuemsg;
var isReady   = require('./globals').isReady;
var broadcast = require('./globals').broadcast;
var emit      = require('./globals').emit;
var ready     = require('./globals').ready;
var Hub       = require('./hub');


/**
 * Forks a worker and keeps a reference to it. Listens for any emitted
 * events so it can distribute them amongst any worker listeners.
 *
 * @return (cluster.Worker)
 */
var origFork = cluster.fork.bind(cluster);
cluster.fork = function(env) {
  var worker = origFork(env);
  var events = {};
  var obj = {
    worker: worker,
    events: events,
    ready: false,
    ononline: ononline,
    onmessage: onmessage,
  };
  workers.push(obj);

  function ononline() {
    obj.ready = true;

    // Check if all workers are online and ready.
    if (!isReady()) return;

    // Process any messages that were buffered while the hub was not ready.
    var msg;
    while (msg = queue.shift()) msg.fn(msg.msg);

    // Tell all workers hub is ready.
    workers.forEach(function(child) {
      child.worker.send({ cmd: commands.READY });
    });

    ready();
  }

  function onmessage(msg) {
    if (msg.hub === undefined || msg.cmd === undefined) return;
    if (msg.dir !== __dirname) return;
    if (!has(hubs, msg.hub)) {
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

    // If key is given, then a callback is waiting for the result.
    if (msg.key) {
      worker.send({
        dir  : __dirname,
        hub  : msg.hub,
        key  : msg.key,
        args : [result],
      });
    }
  }
  
  function onexit() {
    var index = workers.indexOf(obj);
    if (index >= 0) {
      workers.splice(index, 1);
    }
    worker.removeListener('online', obj.ononline);
    worker.removeListener('message', obj.onmessage);
    return false;
  }

  worker.on('online', ononline);
  worker.on('message', onmessage);
  worker.on('exit', onexit);
  worker.on('disconnect', onexit);

  return worker;
};
