const hub = require('..');

hub.emit('yesmaster', { hello: 'there' });
hub.once('work', () => {
  hub.emit('donemaster');
});
