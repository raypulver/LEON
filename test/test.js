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
    bufShouldBe.append([0x00, 0x02, 0x77, 0x6f, 0x6f, 0x70, 0x00, 0x6b, 0x65, 0x79, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x01, 0x09, 0x00, 0x11, 0x14]);
    expect(bufferEquals(bufShouldBe.buffer, buf)).to.be.true;
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
