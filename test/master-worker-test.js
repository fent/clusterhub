const hub      = require('..');
const commands = require('../lib/globals').commands;
const cluster  = require('cluster');
const assert   = require('assert');
const path     = require('path');
const fork     = require('./fork');


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

  it('Listeners are called in order', (done) => {
    fork('worker-master-order.js');
    const results = [];
    hub.on('the-event', () => results.push(1));
    hub.on('the-event', () => results.push(2));
    hub.prependListener('the-event', () => results.push(3));
    let doneCall = false;
    hub.on('after', () => {
      assert.equal(doneCall, true);
    });
    hub.prependManyListener(2, 'after', () => {
      doneCall = true;
      assert.deepEqual(results, [3, 1, 2]);
      done();
    });
  });

  describe('Send a badly formatted messages to each other', () => {
    it('Master and worker ignore it', (done) => {
      const worker = fork('worker-bad-msg.js');
      hub.on('done', done);
      hub.ready(() => {
        const dir = path.resolve(__dirname, '../lib');
        worker.send({ dir, hub: 'none' });
        worker.send({ dir, hub: '', cmd: commands.CB, key: -1 });
        worker.send({ dir, hub: '', cmd: commands.FN, key: -1 });
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

  describe('Emit event with a callback', () => {
    it('Function gets sent to worker then back to master', (done) => {
      fork('worker-emit-fn-1.js');
      hub.emit('my-done', done);
      hub.on('same-done', (done2) => done2());
    });

    it('Function gets sent between workers', (done) => {
      const WORKERS = 2;
      for (let i = 0; i < WORKERS; i++) {
        fork('worker-emit-fn-2.js');
      }
      let n = WORKERS;
      hub.on('sum', (sum) => {
        assert.equal(sum, 4);
        if (--n === 0) done();
      });
    });

    it('Deleted func does nothing', (done) => {
      fork('worker-emit-fn-3.js');
      hub._maxFuncs = 1;
      after(() => hub._maxFuncs = 100);
      let n = 2;
      hub.emit('bad-good', done, () => {
        if (--n == 0) throw Error('should not be called');
      });
    });
  });

});
