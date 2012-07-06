# clusterhub [![Build Status](https://secure.travis-ci.org/fent/clusterhub.png)](http://travis-ci.org/fent/clusterhub)

An attempt at giving multi process node programs a simple and efficient way to share data.


# Usage

```js
var cluster = require('cluster');
var numCPUs = require('os').cpus().length;
var hub = require('clusterhub');

if (cluster.isMaster) {
  // Fork workers.
  for (var i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

} else {
  hub.on('event', function(data) {
    // do something with `data`
  });

  // emit event to all workers
  hub.emit('event', { foo: 'bar' });
}
```

# Features

* Efficient event emitter system. Clusterhub will waste no time sending an event to a process that isn't listening for it. Events from the same process of a listener will be immediately emitted.
* In process database. Each hub has its own instance of a redis-like database powered by [EventVat](https://github.com/hij1nx/EventVat).
* Cluster agnostic. Apps that use clusterhub will work regardless if it uses cluster or not.

# Motive

Node.js is a perfect candidate to developing [Date Intensive Real-time Applications](http://video.nextconf.eu/video/1914374/nodejs-digs-dirt-about). Load balancing in these applications can become complicated when having to share data between processes.

A remote database can be an easy solution for this, but it's not the most optimal. Communicating with a local process is several times faster than opening remote requests from a database. And even if the database is hosted locally, the overhead of communicating with yet another program is lessened.

Note that this module is still experimental. It currently works by using a process's internal messaging system.

## Made with Clusterhub

* [socket.io-clusterhub](https://github.com/fent/socket.io-clusterhub) - Sync data between multi-process socket.io applications.
* [clusterchat](https://github.com/fent/clusterchat) - A multi-process chat that shows off socket.io-clusterhub.

# API

### hub.createHub(id)
Clusterhub already comes with a default global hub. Use this if you want to create a custom hub.

### Hub#destroy()
Call to disable hub from emitting and receiving remote messages/commands.

Additionally, all functions from the regular [EventEmitter](http://nodejs.org/docs/latest/api/events.html#events.EventEmitter) are included. Plus a couple of extras.

### Hub#emitLocal(event, [args...])
Use this to emit an event only to the current process.

### Hub#emitRemote(event, [args...])
Use this to emit an event only to other worker processes and master. Or only to workers if the current process is the master.

```js
hub.on('remotehello', function() {
  // hello from another process
});

hub.emitRemote('remotehello', { hello: 'there' });
```

All functions from [EventVat](https://github.com/hij1nx/EventVat) are included as well. Their returned value can be accessed by providing a callback as the last argument. Or optionally by its returned value if called by the master.

#### worker process
```
hub.set('foo', 'bar', function() {
  hub.get('foo', function(val) {
    console.log(val === 'bar'); // true
  });
});
```

#### master process
```
var returnedVal = hub.incr('foo', function(val) {
  // can be given a callback for consistency
  console.log(val === 1); // true
});

// but since it's the master process it has direct access to the database
console.log(returnedVal === 1); // true
```


# Install

    npm install clusterhub

To use with node v0.6.x look at the v0.1.x tag.

    npm install clusterhub@0.1.x


# Tests
Tests are written with [mocha](http://visionmedia.github.com/mocha/)

```bash
npm test
```

# License
MIT
