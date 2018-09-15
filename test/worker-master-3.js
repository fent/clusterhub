const hub = require('..');
hub.emitLocal('local', { hi: 2 });
hub.emitRemote('remote', 'yes!');
