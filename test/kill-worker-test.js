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
  hub.on('hello', function() {
    if (--n === 0) {
      hub.emit('done');
    }
  });

  describe('Master', function() {

    it('Waits then destroy a random worker', function(done) {
      hub.on('done', done);

      hub.ready(function() {
        var worker = workers[Math.floor(Math.random() * WORKERS)];

        cluster.on('exit', function(worker) {
          cluster.fork();
        });

        worker.destroy();
      });

    });

  });

} else {

  describe('Worker', function() {
    describe('Calls hub method', function() {
      it('No errors until master finished', function(done) {
        hub.on('done', done);

        hub.ready(function() {
          setTimeout(function() {
            hub.emit('hello');
          }, 100);

        });
      });
      
    });
  });

}
