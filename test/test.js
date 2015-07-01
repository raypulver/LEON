var expect = require('chai').expect;
var BufferWriter = require('./buffer-writer');
var LEON = require('..');
describe('LEON encoder/decoder', function () {
  it('is a bijection', function () {
    var obj = {a:1,b:2};
    var bounce = LEON.parse(LEON.bufferify(obj));
    var keys = Object.keys(obj);
    expect(keys.length).to.equal(2);
    expect(obj.a).to.equal(1);
    expect(obj.b).to.equal(2);
  });
  it('and it\'s in the right direction', function () {
    var obj = { woop: true, key: NOOP };
    var buf = LEON.bufferify(obj);
    var bufShouldBe = BufferWriter();
    bufShouldBe.append([0x00, 0x02, 0x77, 0x6f, 0x6f, 0x70, 0x00, 0x6b, 0x65, 0x79, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x01, 0x09, 0x00, 0x20, 0x14]);
    expect(bufferEquals(bufShouldBe.buffer, buf)).to.be.true;
  });
  it('can agree on a Channel', function () {
    var template = {
      c: LEON.types.String,
      d: [{
        a: LEON.types.SignedChar,
        b: LEON.types.Boolean
      }]
    };
    var obj = {
      c: 'woop',
      d: [{
        a: 125,
        b: true
      }, {
        a: 124,
        b: false
      }]
    };
    var channel = LEON.Channel(template);
    var buf = channel.bufferify(obj);
    var o = channel.parse(buf);
    expect(obj).to.eql(o);
  });
  it('this should work', function () {
    var channel = LEON.Channel({
      a: LEON.types.String,
      b: LEON.types.SignedInt,
      c: [{ d: LEON.types.Boolean, e: LEON.types.Date }]
    });
    var obj = { a: 'word', b: -500, c: [ { d: true, e: new Date(1435767518000) }, { d: false, e: new Date(
1435767518000) } ] };
    expect(channel.parse(channel.bufferify(obj))).to.eql(obj);
  });
  it('this should work too', function () {
    var channel = LEON.Channel({ strings: [ LEON.types.String ], numbers: [ LEON.types.Int ] });
    var obj = { strings: ['the', 'dog', 'ate', 'the', 'cat'], numbers: [100, 1000, 10000, 100000]};
    var buf = channel.bufferify(obj);
    expect(channel.parse(buf)).to.eql(obj);
  });
});
    
function bufferEquals(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a.readUInt8(i) !== b.readUInt8(i)) return false;
  }
  return true;
}

function NOOP () {}
