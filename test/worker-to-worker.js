const cluster = require('cluster');
const hub     = require('..');

hub.on('fromworker', () => {
  hub.reset();
  cluster.worker.disconnect();
});
hub.on('allready', () => {
  hub.emitRemote('fromworker');
});
hub.emit('imready');
