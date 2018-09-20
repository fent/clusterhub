const hub = require('..');

hub.on('bad-good', (good, bad) => {
  good();
  bad();
});
