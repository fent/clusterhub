const hub     = require('..');
const cluster = require('cluster');
const fork    = require('./fork');
const WORKERS = 2;


if (cluster.isWorker) throw Error('file should not run under worker');

describe('Kill and resurrect a random worker', () => {
  it('Worker is able to reconnect to hub', (done) => {
    const workers = [];
    for (let i = 0; i < WORKERS; i++) {
      workers.push(fork('worker-kill.js'));
    }
    after(cluster.disconnect);

    let n = WORKERS;
    hub.on('hello', () => {
      if (--n === 0) {
        hub.emit('done');
      }
    });

    hub.on('done', done);

    hub.ready(() => {
      let worker = workers[Math.floor(Math.random() * WORKERS)];

      cluster.once('exit', () => {
        fork('worker-kill.js');
      });

      worker.destroy();
    });
  });
});
