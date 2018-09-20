const hub = require('..');

hub.emitRemote('one-worker', 1, (sum) => {
  hub.emit('sum', sum);
}, 3);

hub.on('one-worker', (a, fn, c) => {
  fn(a + c);
});
