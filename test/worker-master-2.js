const hub = require('..');

hub.on('set bar', (value) => {
  hub.removeAllListeners('foo bar');
  hub.emit('result', value.toUpperCase());
});
hub.get('value', (value) => {
  hub.set('foo', value + 42);
});
