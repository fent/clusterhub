const hub  = require('..');
const path = require('path');

// Send msg to master.
const dir = path.resolve(__dirname, '../lib');
process.send({ dir });
process.send({ dir, cmd: 2, hub: 'nonexistant' });
process.send({ cmd: 'nope' });
hub.on('ok', () => {
  hub.emit('done');
});
hub.emit('ready');
