var hub = require('..')
  , cluster = require('cluster')
  , assert = require('assert')
  , WORKERS = 2


if (cluster.isMaster) {
  var workers = [];
  for (var i = 0; i < WORKERS; i++) {
    workers.push(cluster.fork());
  }

  var n = WORKERS;
  hub.on('imready', function() {
    if (--n === 0) hub.emit('allready');
  });

  describe('Master', function() {

    it('Waits for workers to exit', function(done) {
      var n = WORKERS;
      function exit() {
        if (--n === 0) done();
      }

      cluster.on('exit', exit);
    });

  });

} else {

  describe('Worker', function() {

    describe('Emit message to other worker', function() {
      it('Respond when all workers are listening', function(done) {
        hub.on('fromworker', done);

        hub.on('allready', function() {
          hub.emitRemote('fromworker');
        });
        hub.emit('imready');
      });
    });

    describe('Calls hub method', function() {

      it('Data should be shared amongst workers', function(done) {
        var n = 0;
        hub.on('incr work', function() {
          if (++n === WORKERS) {
            done();
          }
        });

        hub.ready(function() {
          setTimeout(function() {
          hub.incr('work');
          }, 100);
        });
      });
      
    });
  });

}
