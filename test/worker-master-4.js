const hub = require('..');

hub.removeAllListeners();
hub.many(2, 'call', () => {
  hub.removeAllListeners('call');
  hub.removeAllListeners();
  hub.off('call');
  hub.emit('hi');
});
hub.on('call', () => {});
hub.removeAllListeners('strike');
const f = () => {};
hub.on('nothing', f);
hub.on('nothing', f);
hub.off('nothing', f);
