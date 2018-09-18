const hub = require('..').createHub('tres');

hub.on('i am', () => {
  hub.emit('nap');
});
hub.emitRemote('i am');
