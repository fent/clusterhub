const hub     = require('..');
const cluster = require('cluster');
const assert  = require('assert');
const fork    = require('./fork');


if (cluster.isWorker) throw Error('file should not run under worker');

describe('Communicate from master to workers', () => {
  it('Listens for event from a worker and responds', (done) => {
    fork('worker-master-1.js');
    hub.on('yesmaster', (data) => {
      assert.deepEqual(data, { hello: 'there' });
      hub.emit('work', 'now');
      hub.emit('work', 'now');
      done();
    });
  });

  it('Listens for set and get event', (done) => {
    fork('worker-master-2.js');
    after(cluster.disconnect);
    hub.on('set foo', (value) => {
      assert.equal(value, 42);
      hub.set('bar', 'dog');
    });
    hub.on('result', (value) => {
      assert.equal(value, 'DOG');
      done();
    });
  });

  it('Does not emit worker to worker events', (done) => {
    fork('worker-master-3.js');
    after(cluster.disconnect);
    hub.on('local', () => { throw Error('should not emit'); });
    hub.on('remote', (value) => {
      assert.equal(value, 'yes!');
      done();
    });
  });
});
