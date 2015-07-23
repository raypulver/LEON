var expect = require('chai').expect;
var LEON = require('..');
describe('LEON encoder/decoder', function () {
  it('is a bijection', function () {
    var obj = {a:1,b:2};
    var bounce = LEON.parse(LEON.stringify(obj));
    var keys = Object.keys(obj);
    expect(keys.length).to.equal(2);
    expect(obj.a).to.equal(1);
    expect(obj.b).to.equal(2);
  });
  it('can agree on a Channel', function () {
    var template = {
      c: LEON.types.STRING,
      d: [{
        a: LEON.types.CHAR,
        b: LEON.types.BOOLEAN
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
    var buf = channel.stringify(obj);
    var o = channel.parse(buf);
    expect(obj).to.eql(o);
  });
  it('this should work', function () {
    var channel = LEON.Channel({
      a: LEON.types.STRING,
      b: LEON.types.INT,
      c: [{ d: LEON.types.BOOLEAN, e: LEON.types.DATE }]
    });
    var obj = { a: 'word', b: -500, c: [ { d: true, e: new Date(1435767518000) }, { d: false, e: new Date(
1435767518000) } ] };
    expect(channel.parse(channel.stringify(obj))).to.eql(obj);
  });
  it('this should work too', function () {
    var channel = LEON.Channel({ strings: [ LEON.types.STRING ], numbers: [ LEON.types.INT ] });
    var obj = { strings: ['the', 'dog', 'ate', 'the', 'cat'], numbers: [100, 1000, 10000, 100000]};
    var buf = channel.stringify(obj);
    expect(channel.parse(buf)).to.eql(obj);
  });
  it('can represent floating point numbers within reasonable precision', function () {
    var obj = { a: -232.22, b: -23332.2222222, c: 232.22, d: 23332.222222 };
    var EPS = 1e-15;
    var bounce = LEON.parse(LEON.stringify(obj));
    expect(Math.abs(bounce.a - obj.a) < EPS).to.be.true;
    expect(Math.abs(bounce.b - obj.b) < EPS).to.be.true;
    expect(Math.abs(bounce.c - obj.c) < EPS).to.be.true;
    expect(Math.abs(bounce.d - obj.d) < EPS).to.be.true;
  });
  it('can serialize a RegExp', function () {
    expect(LEON.parse(LEON.stringify(/54/i)).toString()).to.equal('/54/i');
    expect(LEON.parse(LEON.stringify(/54/)).toString()).to.equal('/54/');
  });
  it('can serialize a Buffer', function () {
    var buf = new Buffer(4);
    var num = 232323232;
    buf.writeUInt32LE(num, 0);
    var bounce = LEON.parse(LEON.stringify(buf));
    expect(bounce.readUInt32LE(0)).to.equal(num);
  });
  it('can deduce a template', function () {
    var obj = [{ a: true, b: 'woop', c: [ -232222.22, 500, 59999 ] },
      { a: true, b: 'doop', c: [-600, 500, 400] },
      { a: false, b: 'shoop', c: [1, 2, 3] }
    ]
    var expected = [{a: LEON.types.BOOLEAN, b: LEON.types.STRING, c: [ LEON.types.DOUBLE ] }];
    var template = LEON.toTemplate(obj);
    expect(template).to.eql(expected); 
    var channel = LEON.Channel(template);
    expect(channel.parse(channel.stringify(obj))).to.eql(obj);
    expect(JSON.stringify(obj).length > LEON.stringify(obj).length && LEON.stringify(obj).length > channel.stringify(obj).length).to.be.true;
  });
  it('should throw on an invalid template', function () {
    // I can't get chai's 'to.throw(Error)' feature to work tonight so just try to follow my logic, okay?
    var obj = { woopdoop: 5, shoopdoop: ['woop', 5 ] };
    try {
      LEON.toTemplate(obj);
      expect(false).to.be.true;
      // ^^^ so this hopefully should never run
    } catch (e) {
      if (e instanceof Error && e.message === 'Type mismatch.')  expect(true).to.be.true;
     else expect(true).to.be.false;
    }
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
      woopdoop: LEON.types.UNSIGNED_CHAR,
      shoopdoop: [LEON.types.DOUBLE],
      doopwoop: [{
        a: LEON.types.BOOLEAN,
        b: LEON.types.UNSIGNED_CHAR,
        c: [LEON.types.UNSIGNED_CHAR],
        d: LEON.types.STRING,
        e: LEON.types.DATE
      }]
    });
    var ser = channel.stringify(obj);
    expect(channel.parse(ser)).to.eql(obj);
  });
});
    
function NOOP () {}
