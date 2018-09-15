const hub = require('..');

hub.ready(() => {
  setTimeout(() => {
    hub.emit('hello', 42); }, 100);
});
