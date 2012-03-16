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

    it('Waits then kill a random worker', function(done) {
      hub.on('done', done);

      hub.ready(function() {
        var worker = workers[Math.floor(Math.random() * WORKERS)];
        worker.kill();

        cluster.on('death', function(worker) {
          cluster.fork();
        });
      });

    });

  });

} else {

  describe('Worker', function() {
    describe('Calls hub method', function() {
      it('No errors until master finished', function(done) {
        hub.on('done', done);

        hub.ready(function() {
          setInterval(function() {
            hub.incr('foo');
          }, Math.floor(Math.random() * 100));

          setTimeout(function() {
            hub.emit('hello');
          }, 100);

        });
      });
      
    });
  });

}
