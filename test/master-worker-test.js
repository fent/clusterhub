const hub     = require('..');
const cluster = require('cluster');
const assert  = require('assert');
const path    = require('path');
const fork    = require('./fork');


if (cluster.isWorker) throw Error('file should not run under worker');

describe('Communicate from master to workers', () => {
  afterEach(cluster.disconnect);
  afterEach(() => hub.reset());

  it('Listens for event from a worker and responds', (done) => {
    fork('worker-master-1.js');
    hub.on('yesmaster', (data) => {
      assert.deepEqual(data, { hello: 'there' });
      hub.emit('work', 'now');
      hub.emit('work', 'now');
      hub.on('donemaster', done);
    });
  });

  it('Listens for set and get event', (done) => {
    fork('worker-master-2.js');
    hub.on('set foo', (value) => {
      assert.equal(value, 66);
      hub.set('bar', 'dog');
    });
    hub.on('result', (value) => {
      assert.equal(value, 'DOG');
      done();
    });
    hub.set('value', 24);
  });

  it('Does not emit worker to worker events', (done) => {
    fork('worker-master-3.js');
    hub.on('local', () => { throw Error('should not emit'); });
    hub.on('remote', (value) => {
      assert.equal(value, 'yes!');
      done();
    });
  });

  it('Listens and unlistens to events in order', (done) => {
    fork('worker-master-4.js');
    hub.removeAllListeners('hi');
    const f = () => {};
    hub.on('hi', f);
    hub.on('hi', () => {
      hub.off('hi', f);
      hub.off('hi', f);
      done();
    });
    hub.off('hi', () => {});
    hub.emit('call');
  });

  describe('Send a badly formatted messages to each other', () => {
    it('Master and worker ignore it', (done) => {
      const worker = fork('worker-bad-msg.js');
      hub.on('done', done);
      hub.ready(() => {
        const dir = path.resolve(__dirname, '../lib');
        worker.send({ dir, hub: 'none' });
        worker.send({});
        hub.emit('ok');
      });
    });
  });

  describe('Send a message from master first', () => {
    it('Worker should receive it after it connects', (done) => {
      fork('worker-get-msg.js');
      hub.on('done', done);
      hub.emit('bad');
    });
  });

});