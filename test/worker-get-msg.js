const hub = require('..');

hub.on('bad', () => {
  hub.emit('done');
});
