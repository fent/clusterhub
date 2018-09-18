const hub = require('..').createHub('one');

hub.on('ping', () => {
  hub.emit('pong');
});
