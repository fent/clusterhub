const hub = require('..');
const h = hub.createHub('two');

hub.on('two', () => {
  h.emit('error', ':(');
});
h.on('two', () => {
  h.emit('success');
});
