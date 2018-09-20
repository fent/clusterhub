const hub      = require('..');
const commands = require('../lib/globals').commands;
const path     = require('path');

// Send msg to master.
const dir = path.resolve(__dirname, '../lib');
process.send({ dir });
process.send({ dir, cmd: 2, hub: 'nonexistant' });
process.send({ dir, hub: '', cmd: commands.FN, key: -1 });
process.send({ cmd: 'nope' });
hub.on('ok', () => {
  hub.emit('done');
});
hub.emit('ready');
