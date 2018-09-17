const hub = require('..');

// Send msg to master.
process.send({ cmd: 'nope' });
hub.emit('done');
