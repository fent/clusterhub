const hub = require('..');

hub.on('set bar', (value) => {
  hub.emit('result', value.toUpperCase());
});
hub.set('foo', 42);
