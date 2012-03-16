var hub = require('..')
  , cluster = require('cluster')
  , assert = require('assert')
  , WORKERS = 1


if (cluster.isMaster) {
  var workers = [];
  for (var i = 0; i < WORKERS; i++) {
    workers.push(cluster.fork());
  }

  describe('Master', function() {
    it('Wait until all workers are alive', function(done) {
      hub.ready(done);
    });
  });

} else {

  describe('Worker', function() {
    describe('Calls hub method', function() {
      it('Errors emitted', function(done) {
        var errd = false;

        // hub.on() might generate an error
        hub.on('error', function(err) {
          errd = true;
        });

        hub.ready(function() {
          hub.incr('foo');

          assert.ok(errd);
          done();
        });
      });
      
    });
  });

}
