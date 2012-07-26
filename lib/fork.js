var cluster   = require('cluster')
  , has       = require('./util').has
  , commands  = require('./globals').commands
  , hubs      = require('./globals').hubs
  , workers   = require('./globals').workers
  , queue     = require('./globals').queue
  , queuemsg  = require('./globals').queuemsg
  , isReady   = require('./globals').isReady
  , broadcast = require('./globals').broadcast
  , emit      = require('./globals').emit
  , Hub       = require('./hub')
  ;


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
 * Listen for events from master
 */
process.on('message', function(msg) {
  if (msg.cmd === commands.READY) {
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
 *
 * @return (child)
 */
var origFork = cluster.fork;
cluster.fork = function() {
  var worker = origFork();
  var events = {};
  var obj = { worker: worker, events: events, ready: false };
  workers.push(obj);

  function ononline() {
    obj.ready = true;

    // check if all workers are online and ready
    if (!isReady()) return;

    // process any messages that were buffered while the hub
    // was not ready
    var msg;
    while (msg = queue.shift()) msg.fn(msg.msg);

    // tell all workers hub is ready
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
      // if this is an emitted event, distribute it amongst all workers
      // who are listening for the event. Except the one who sent it
      case commands.EVENT:
        queuemsg(onevent, msg);
        break;

      // if it's on/off, add/remove counters to know if this worker should
      // get notified of any events or not
      case commands.ON:
        onon(msg);
        break;

      case commands.OFF:
        onoff(msg);
        break;

      case commands.OFFALL:
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

  worker.on('online', ononline);
  worker.on('message', onmessage);

  return worker;
};


/**
 * Remove workers on death
 */
cluster.on('exit', function(worker) {
  workers.forEach(function(obj, i) {
    if (obj.worker === worker) {
      workers.splice(i, 1);
      return false;
    }
  });
});
