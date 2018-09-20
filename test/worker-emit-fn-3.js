const hub = require('..');

hub.on('bad-good', (good, bad) => {
  bad();
  good();
  bad();
});
