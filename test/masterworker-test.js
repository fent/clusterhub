var hub = require('..')
  , cluster = require('cluster')
  , assert = require('assert')
  , WORKERS = 1


if (cluster.isMaster) {
  var workers = [];
  for (var i = 0; i < WORKERS; i++) {
    workers.push(cluster.fork());
  }

  hub.on('emitRemove', function() {
    hub.emit('a');
    hub.emit('b');
    hub.emit('remove');
  });

  hub.on('emitRubber', function() {
    hub.emit('rubber');
    hub.emit('rubber');
    hub.emit('rubber');
  });

  hub.on('local', function() {
    throw new Error('Received event that was supposed to be local');
  });

  describe('Master', function() {

    it('Listens for event from a worker and responds', function(done) {
      hub.on('yesmaster', function(data) {
        assert.deepEqual(data, { hello: 'there' });
        hub.emit('work', 'now');
        hub.emit('work', 'now');
        done();
      });
    });

    it('Listens for set event', function(done) {
      hub.on('set foo', function(value) {
        assert.equal(value, 42);
        done();
      });
    });

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

    describe('Listen for event remotely', function() {
      it('Get a response from master', function(done) {
        hub.on('work', function(data) {
          assert.equal(data, 'now');
          hub.off('work'); // done should not fire twice
          done();
        });

        hub.emitRemote('yesmaster', { hello: 'there' });
        hub.emitLocal('yesmaster', 'noo');
      });
    });

    describe('Listen locally for event', function() {
      it('Event is emitted', function(done) {
        hub.on('letsgo', done);
        hub.emit('letsgo');
      });

      describe('and emit locally only', function() {
        it('Event is emitted only for this worker', function(done) {
          hub.on('local', done);
          hub.emitLocal('local');
        });
      });
    });

    describe('once', function() {
      it('Calls done() only once', function(done) {
        hub.once('rubber', done);
        hub.emit('emitRubber');
      });
    });

    describe('set', function() {
      it('gets correct value', function(done) {
        var foo = false;
        hub.on('set foo', function(v) {
          foo = v;
        });

        hub.set('foo', 42, function(value) {
          assert.equal(value, true);

          hub.get('foo', function(value) {
            assert.equal(foo, 42);
            assert.equal(value, 42);
            done();
          });

        });
      });
    });

    describe('removeAllListeners', function() {
      it('Does not fire any event', function(done) {
        var a = true
          , b = true

        hub.on('a', function() {
          a = false;
        });

        hub.on('b', function() {
          b = false;
        });

        hub.removeAllListeners();

        hub.once('remove', function() {
          assert(a);
          assert(b);
          done();
        });

        hub.emit('emitRemove');
      });

      describe('with explicit event', function() {
        it('Does not fire event', function(done) {
          var a = true;
          hub.on('a', function() {
            a = false;
          });

          hub.removeAllListeners('a')
          hub.once('remove', function() {
            assert(a);
            done();
          });

          hub.emit('emitRemove');
        });
      })

    });
  });
}
