const hub = require('..');

console.log('worker file')
  // Send msg to master.
hub.on('bad', () => {
  hub.emit('done');
});
