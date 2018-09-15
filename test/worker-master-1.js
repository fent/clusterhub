const cluster = require('cluster');
const hub     = require('..');

hub.emit('yesmaster', { hello: 'there' });
hub.once('work', cluster.worker.disconnect);
