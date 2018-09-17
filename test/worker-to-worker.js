const cluster = require('cluster');
const hub     = require('..');

hub.on('fromworker', () => cluster.worker.disconnect());
hub.on('allready', () => {
  hub.emitRemote('fromworker');
});
hub.emit('imready');
