const hub = require('..');

setTimeout(() => {
  hub.emit('hello', 42);
}, 100);
