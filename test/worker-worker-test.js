const hub     = require('..');
const cluster = require('cluster');
const fork    = require('./fork');
const WORKERS = 2;


if (cluster.isWorker) throw Error('file should not run under worker');

describe('Worker to worker inter-communication', () => {
  beforeEach(() => {
    for (let i = 0; i < WORKERS; i++) {
      fork('worker-to-worker.js');
    }

    let n = WORKERS;
    hub.on('imready', () => {
      if (--n === 0) hub.emit('allready');
    });
  });
  afterEach(cluster.disconnect);
  afterEach(() => hub.reset());

  it('Waits for workers to finish and exit', (done) => {
    let n = WORKERS;
    cluster.on('exit', () => {
      if (--n === 0) done();
    });
  });
});
