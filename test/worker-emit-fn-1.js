const hub = require('..');

hub.on('my-done', (done) => {
  hub.emit('same-done', done);
});
