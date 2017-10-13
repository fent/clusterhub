const hub     = require('..');
const cluster = require('cluster');
const WORKERS = 2;


if (cluster.isMaster) {
  var workers = [];
  for (var i = 0; i < WORKERS; i++) {
    workers.push(cluster.fork());
  }

  var n = WORKERS;
  hub.on('imready', () => {
    if (--n === 0) hub.emit('allready');
  });

  describe('Master', () => {

    it('Waits for workers to exit', (done) => {
      var n = WORKERS;
      cluster.on('exit', () => {
        if (--n === 0) done();
      });
    });

  });

} else {

  describe('Worker', () => {

    describe('Emit message to other worker', () => {
      it('Respond when all workers are listening', (done) => {
        hub.on('fromworker', done);

        hub.on('allready', () => {
          hub.emitRemote('fromworker');
        });
        hub.emit('imready');
      });
    });

    describe('Calls hub method', () => {

      it('Data should be shared amongst workers', (done) => {
        var n = 0;
        hub.on('incr work', () => {
          if (++n === WORKERS) {
            done();
          }
        });

        hub.ready(() => {
          setTimeout(() => {
            hub.incr('work');
          }, 100);
        });
      });
      
    });
  });

}
