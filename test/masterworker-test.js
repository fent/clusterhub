const hub     = require('..');
const cluster = require('cluster');
const assert  = require('assert');
const WORKERS = 1;


if (cluster.isMaster) {
  var workers = [];
  for (var i = 0; i < WORKERS; i++) {
    workers.push(cluster.fork());
  }

  hub.on('emitRemove', () => {
    hub.emit('a');
    hub.emit('b');
    hub.emit('remove');
  });

  hub.on('emitRubber', () => {
    hub.emit('rubber');
    hub.emit('rubber');
    hub.emit('rubber');
  });

  hub.on('local', () => {
    throw new Error('Received event that was supposed to be local');
  });

  describe('Master', () => {

    it('Listens for event from a worker and responds', (done) => {
      hub.on('yesmaster', (data) => {
        assert.deepEqual(data, { hello: 'there' });
        hub.emit('work', 'now');
        hub.emit('work', 'now');
        done();
      });
    });

    it('Listens for set event', (done) => {
      hub.on('set foo', (value) => {
        assert.equal(value, 42);
        done();
      });
    });

    it('Waits for workers to exit', (done) => {
      var n = WORKERS;
      cluster.on('exit', () => {
        if (--n === 0) done();
      });
    });

  });

} else {
  describe('Worker', () => {

    describe('Listen for event remotely', () => {
      it('Get a response from master', (done) => {
        hub.on('work', (data) => {
          assert.equal(data, 'now');
          hub.off('work'); // done should not fire twice
          done();
        });

        hub.emitRemote('yesmaster', { hello: 'there' });
        hub.emitLocal('yesmaster', 'noo');
      });
    });

    describe('Listen locally for event', () => {
      it('Event is emitted', (done) => {
        hub.on('letsgo', done);
        hub.emit('letsgo');
      });

      describe('and emit locally only', () => {
        it('Event is emitted only for this worker', (done) => {
          hub.on('local', done);
          hub.emitLocal('local');
        });
      });
    });

    describe('once', () => {
      it('Calls done() only once', (done) => {
        hub.once('rubber', done);
        hub.emit('emitRubber');
      });
    });

    describe('set', () => {
      it('gets correct value', (done) => {
        var foo = false;
        hub.on('set foo', (v) => {
          foo = v;
        });

        hub.set('foo', 42, (value) => {
          assert.equal(value, true);

          hub.get('foo', (value) => {
            assert.equal(foo, 42);
            assert.equal(value, 42);
            done();
          });

        });
      });
    });

    describe('removeAllListeners', () => {
      it('Does not fire any event', (done) => {
        var a = true;
        var b = true;

        hub.on('a', () => {
          a = false;
        });

        hub.on('b', () => {
          b = false;
        });

        hub.removeAllListeners();

        hub.once('remove', () => {
          assert(a);
          assert(b);
          done();
        });

        hub.emit('emitRemove');
      });

      describe('with explicit event', () => {
        it('Does not fire event', (done) => {
          var a = true;
          hub.on('a', () => {
            a = false;
          });

          hub.removeAllListeners('a');
          hub.once('remove', () => {
            assert(a);
            done();
          });

          hub.emit('emitRemove');
        });
      });

    });
  });
}
