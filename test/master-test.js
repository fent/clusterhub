var hub = require('..');
var assert = require('assert');


describe('Listen', function() {
  it('Emits to self', function(done) {
    hub.on('e', function(a, b, c) {
      assert.equal(a, 1);
      assert.equal(b, 2);
      assert.equal(c, 3);
      done();
    });

    hub.emit('e', 1, 2, 3);
  });

  describe('and unlisten', function() {
    it('Does not emit unlistened to event', function(done) {
      hub.on('a', done);
      hub.on('b', done);
      hub.off('b');
      hub.emit('a');
      hub.emit('b');
    });
  });

  describe('once', function() {
    it('Emits only once', function(done) {
      hub.once('hi', done);
      hub.emit('hi');
      hub.emit('hi');
      hub.emit('hi');
    });
  });
});

describe('Local EventVat database', function() {

  it('Can update and access db', function(done) {
    assert.ok(!hub.get('foo'));
    hub.set('foo', 'bar', function(rs) {
      assert.ok(rs);
      done();
    });
  });

  it('Emits events on function calls', function(done) {
    hub.on('incr one', function() {
      hub.get('one', 1);
      done();
    });

    hub.incr('one');
  });

});
