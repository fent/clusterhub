const hub    = require('..');
const assert = require('assert');


describe('Listen', () => {
  it('Emits to self', (done) => {
    hub.on('e', (a, b, c) => {
      assert.equal(a, 1);
      assert.equal(b, 2);
      assert.equal(c, 3);
      done();
    });

    hub.emit('e', 1, 2, 3);
  });

  describe('and unlisten', () => {
    it('Does not emit unlistened to event', (done) => {
      hub.on('a', done);
      hub.on('b', done);
      hub.off('b');
      hub.emit('a');
      hub.emit('b');
    });
  });

  describe('once', () => {
    it('Emits only once', (done) => {
      hub.once('hi', done);
      hub.emit('hi');
      hub.emit('hi');
      hub.emit('hi');
    });
  });
});

describe('Local EventVat database', () => {

  it('Can update and access db', (done) => {
    assert.ok(!hub.get('foo'));
    hub.set('foo', 'bar', (rs) => {
      assert.ok(rs);
      done();
    });
  });

  it('Emits events on function calls', (done) => {
    hub.on('incr one', () => {
      hub.get('one', 1);
      done();
    });

    hub.incr('one');
  });

});
