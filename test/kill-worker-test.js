const hub     = require('..');
const cluster = require('cluster');
const WORKERS = 2;


if (cluster.isMaster) {
  var workers = [];
  for (var i = 0; i < WORKERS; i++) {
    workers.push(cluster.fork());
  }

  var n = WORKERS;
  hub.on('hello', () => {
    if (--n === 0) {
      hub.emit('done');
    }
  });

  describe('Master', () => {

    it('Waits then destroy a random worker', (done) => {
      hub.on('done', done);

      hub.ready(() => {
        var worker = workers[Math.floor(Math.random() * WORKERS)];

        cluster.on('exit', () => {
          cluster.fork();
        });

        worker.destroy();
      });

    });

  });

} else {

  describe('Worker', () => {
    describe('Calls hub method', () => {
      it('No errors until master finished', (done) => {
        hub.on('done', done);

        hub.ready(() => {
          setTimeout(() => {
            hub.emit('hello');
          }, 100);

        });
      });
      
    });
  });

}
