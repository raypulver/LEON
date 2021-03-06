var expect = require('chai').expect;
var LEON = require('..');
describe('LEON encoder/decoder', function () {
  it('is a bijection', function () {
    var obj = {a:1,b:2};
    var bounce = LEON.decode(LEON.encode(obj));
    var keys = Object.keys(obj);
    expect(keys.length).to.equal(2);
    expect(obj.a).to.equal(1);
    expect(obj.b).to.equal(2);
  });
  it('can agree on a Channel', function () {
    var template = {
      c: LEON.STRING,
      d: [{
        a: LEON.UINT8,
        b: LEON.BOOLEAN
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
    var buf = channel.encode(obj);
    var o = channel.decode(buf);
    expect(obj).to.eql(o);
  });
  it('should serialized signed quantities', function () {
    var channel = LEON.Channel({
      a: LEON.STRING,
      b: LEON.INT32,
      c: [{ d: LEON.BOOLEAN, e: LEON.DATE }]
    });
    var obj = { a: 'word', b: -500, c: [ { d: true, e: new Date(1435767518000) }, { d: false, e: new Date(
1435767518000) } ] };
    var ser = channel.encode(obj);
    expect(channel.decode(ser)).to.eql(obj);
  });
  it('should serialize unsigned quantities', function () {
    var channel = LEON.Channel({ strings: [ LEON.STRING ], numbers: [ LEON.INT32 ] });
    var obj = { strings: ['the', 'dog', 'ate', 'the', 'cat'], numbers: [100, 1000, 10000, 100000]};
    var buf = channel.encode(obj);
    expect(channel.decode(buf)).to.eql(obj);
  });
  it('can represent any floating point number with as much precision as JavaScript', function () {
    var obj = { a: -232.22, b: -23332.2222222, c: 232.22, d: 23332.222222 };
    expect(LEON.decode(LEON.encode(obj))).to.eql(obj);
  });
  it('can serialize a RegExp', function () {
    expect(LEON.decode(LEON.encode(/54/i)).toString()).to.equal('/54/i');
    expect(LEON.decode(LEON.encode(/54/)).toString()).to.equal('/54/');
  });
  it('can serialize a Buffer', function () {
    var buf = new Buffer(4);
    var num = 232323232;
    buf.writeUInt32LE(num, 0);
    var bounce = LEON.decode(LEON.encode(buf));
    expect(bounce.readUInt32LE(0)).to.equal(num);
  });
  it('can deduce a template', function () {
    var obj = [{ a: true, b: 'woop', c: [ -232222.22, 500, 59999 ] },
      { a: true, b: 'doop', c: [-600, 500, 400] },
      { a: false, b: 'shoop', c: [1, 2, 3] }
    ]
    var expected = [{a: LEON.BOOLEAN, b: LEON.STRING, c: [ LEON.DOUBLE ] }];
    var template = LEON.toTemplate(obj);
    expect(template).to.eql(expected); 
    var channel = LEON.Channel(template);
    expect(channel.decode(channel.encode(obj))).to.eql(obj);
  });
  it('should deduce a more complex template', function () {
    var obj = { woopdoop: 5, shoopdoop: [510, -510, 1, 0.5], doopwoop: [{
      a: true,
      b: 5,
      c: [5, 2, 1],
      d: 'woop',
      e: new Date(1300000000)
    }] };
    var channel = LEON.Channel(LEON.toTemplate(obj));
    var workingChannel = LEON.Channel({
      woopdoop: LEON.UINT8,
      shoopdoop: [LEON.DOUBLE],
      doopwoop: [{
        a: LEON.BOOLEAN,
        b: LEON.UINT8,
        c: [LEON.UINT8],
        d: LEON.STRING,
        e: LEON.DATE
      }]
    });
    var ser = channel.encode(obj);
    expect(channel.decode(ser)).to.eql(obj);
  });
  it('should know when it\'s a float and when it\'s a double', function () {
    expect(new Uint8Array(LEON.encode(((1 << 24) - 1) * Math.pow(2, 0 - 127)))[0]).to.equal(LEON.FLOAT);
    expect(new Uint8Array(LEON.encode(((1 << 24) + 1) * Math.pow(2, 0 - 127)))[0]).to.equal(LEON.DOUBLE);
  });
  it('should know how many bytes the integer will fit into', function () {
    expect(new Uint8Array(LEON.encode(-128))[0]).to.equal(LEON.INT8);
    expect(new Uint8Array(LEON.encode(-129))[0]).to.equal(LEON.INT16);
    expect(new Uint8Array(LEON.encode(255))[0]).to.equal(LEON.UINT8);
    expect(new Uint8Array(LEON.encode(256))[0]).to.equal(LEON.UINT16);
  });
  it('writes a float with the same bits as a Buffer would', function () {
    var ser = LEON.Channel(LEON.FLOAT).encode(-0.125);
    var expected = new Buffer(4);
    expected.writeFloatLE(-0.125, 0);
    for (i = 0; i < ser.length; ++i) {
      expect(expected[i]).to.equal(ser[i]);
    }
  });
  it('writes a double with the same bits as a Buffer would', function () {
    ser = LEON.Channel(LEON.DOUBLE).encode(-232.222);
    var expected = new Buffer(8);
    expected.writeDoubleLE(-232.222, 0);
    for (i = 0; i < ser.length; ++i) {
      expect(expected[i]).to.equal(ser[i]);
    }
  });
  it('filters data according to a schema', function () {
    var obj = { woop: 'doop', shoop: 'coop', loop: 'foop' };
    var channel = LEON.Channel({
      woop: LEON.STRING,
      shoop: LEON.STRING
    });
    var expected = { woop: 'doop', shoop: 'coop' };
    expect(channel.decode(channel.encode(obj))).to.eql(expected);
  });
  it('can represent a date with full precision', function () {
    var date = new Date(1438876995235);
    var ser = LEON.encode(date);
    date = LEON.decode(ser);
    expect(date.valueOf()).to.equal(1438876995235);
  });
  it('can serialize dynamic data along with typed data', function () {
    var obj = {
      staticallyTypedData: [
        {
          first: 55,
          second: 70,
          third: -100,
          fourth: false
        }, {
          first: 72,
          second: -50,
          third: -20,
          fourth: true
        }, {
          first: 33,
          second: 22,
          third: -22,
          fourth: false
        }
      ],
      dynamicallyTypedData: [
        { a: Infinity, b: NaN, c: /54/i },
        false,
        new Date(),
        { d: 5, e: true, f: 'woop' }
      ]
    };
    var channel = LEON.Channel({
      staticallyTypedData: [{ first: LEON.UINT8, second: LEON.INT8, third: LEON.INT8, fourth: LEON.BOOLEAN }],
      dynamicallyTypedData: [LEON.DYNAMIC]
    });
    var serialized = channel.encode(obj);
    expect(channel.decode(serialized)).to.eql(obj);
  });
  it('should provide a string representation of a Channel', function () {
    var expected = '{[Channel] STRING}';
    expect(LEON.Channel(LEON.STRING).inspect()).to.equal(expected);
  });
  it('should allow for user defined types', function () {
    LEON.defineType(0x10, {
      check: function (v) { return v instanceof Error; },
      encode: function (buf, v) { buf.writeStringUTF8(v.message); },
      decode: function (buf) { return Error(buf.readStringUTF8()); }
    });
    var payload = Error('woop');
    var bounce = LEON.decode(LEON.encode(payload));
    expect(bounce instanceof Error).to.eql(true);
    expect(bounce.message).to.eql('woop');
  });
});
    
function NOOP () {}
