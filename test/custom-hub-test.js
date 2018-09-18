const hub     = require('..');
const cluster = require('cluster');
const fork    = require('./fork');


describe('Create a hub with a custom id', () => {
  afterEach(cluster.disconnect);

  describe('Master to master', () => {
    it('Hub listens and emits events', (done) => {
      afterEach(() => h.destroy());
      const h = hub.createHub('1');
      h.on('myevent', done);
      h.emit('myevent');
    });
  });

  describe('Master to worker', () => {
    it('Albe to send and receive messages', (done) => {
      fork('worker-custom-1.js');
      const h = hub.createHub('one');
      after(() => h.destroy());
      h.emit('ping');
      h.on('pong', done);
    });

    it('Custom hubs don\'t receive messages from other hubs', (done) => {
      fork('worker-custom-2.js');
      hub.createHub('two');
      const h = hub.createHub('two');
      after(() => h.destroy());
      h.emit('two');
      h.on('success', done);
    });
  });

  describe('Worker to worker', () => {
    it('Two workers communicate with each other', (done) => {
      const h = hub.createHub('tres');
      after(() => h.destroy());
      const workers = 2;
      for (let i = 0; i < workers; i++) {
        fork('worker-custom-3.js');
      }
      let n = workers;
      h.on('nap', () => {
        if (--n === 0) done();
      });
    });
  });

});
