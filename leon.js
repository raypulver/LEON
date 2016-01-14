;(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define(factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.LEON = factory();
  }
})(this, function () {
  'use strict';
  function uncurry(fn) {
    return function () {
      return Function.call.apply(fn, arguments);
    };
  }
  var $Array = Array,
      Array$prototype = $Array.prototype,
      Array$forEach = uncurry(Array$prototype.forEach),
      $Object = Object,
      Object$create = $Object.create || function (prototype) {
        function Type () { return this; }
        Type.prototype = prototype;
        return new Type();
      },
      Object$keys = $Object.keys || function (obj) {
        var ret = [], key;
        for (key in obj) {
          if (obj.hasOwnProperty(key)) { ret.push(key); }
        }
        return ret;
      };

  function $Hash(obj) {
    var ret = Object$create(null);
    if (obj) {
      Array$forEach(Object$keys(obj), function (v) {
        ret[v] = obj[v];
      });
    }
    return ret;
  }

  var root = this,
      previousLEON = root && root.LEON,
  // define the constants here so we know where to find them
      ARRAY_BUFFER_DEFAULT_ALLOC = 0x10000,
      UINT8 = 0xff,
      INT8 = 0xfe,
      UINT16 = 0xfd,
      INT16 = 0xfc,
      UINT32 = 0xfb,
      INT32 = 0xfa,
      FLOAT = 0xf9,
      DOUBLE = 0xf8,
      ARRAY = 0xf6,
      OBJECT = 0xf5,
      STRING = 0xf4,
      UTF8STRING = 0xf4,
      BOOLEAN = 0xf3,
      TRUE = 0xf3,
      FALSE = 0xf2,
      NULL = 0xf0,
      UNDEFINED = 0xef,
      DATE = 0xee,
      BUFFER = 0xed,
      REGEXP = 0xec,
      NAN = 0xeb,
      INFINITY = 0xe7,
      MINUS_INFINITY = 0xe6,
      RATIONAL = 0xe4,
      COMPLEX = 0xe3,
      SYMBOL = 0xe1,
      CHANNEL = 0xdc,
      DYNAMIC = 0xdd,
      UTF16STRING = 0xdc,
      EMPTY = 0xe5,
  // need a few shims before we do anything
      Object$prototype = $Object.prototype,
      $String = String,
      String$fromCharCode = String.fromCharCode,
      toString = root && root.toString || Object$prototype.toString,
      Array$isArray = $Array.isArray || function (val) { 
        return '[object Array]' === toString.call(val);
      },
  // fall back to Object$keys
      Object$getOwnPropertyNames = $Object.getOwnPropertyNames || Object$keys,
  // we only need a basic version of reduce
      Array$reduce = uncurry(Array$prototype.reduce || function (cb, accum, thisArg) {
        var i;
        for (i = 0; i < this.length; ++i) {
          accum = cb.call(thisArg, accum, this[i], i, this);
        }
        return accum;
      }),
      Array$forEach = uncurry(Array$prototype.forEach),
      types = $Hash({
        UINT8: UINT8,
        INT8: INT8,
        UINT16: UINT16,
        INT16: INT16,
        UINT32: UINT32,
        INT32: INT32,
        FLOAT: FLOAT,
        DOUBLE: DOUBLE,
        STRING: STRING,
        UTF8STRING: UTF8STRING,
        UTF16STRING: UTF16STRING,
        BOOLEAN: BOOLEAN,
        DATE: DATE,
        BUFFER: BUFFER,
        REGEXP: REGEXP,
        COMPLEX: COMPLEX,
        RATIONAL: RATIONAL,
        SYMBOL: SYMBOL,
        DYNAMIC: DYNAMIC
      }),
      IS_NODE, NATIVE_LITTLE_ENDIAN, HAS_TYPED_ARRAYS, HAS_SYMBOLS;
  var registry = $Hash({
    types: new $Array(256),
    checkers: []
  });
  function checkSplice(constant) {
    for (var i = 0; i < registry.checkers.length; ++i) {
      if (constant === registry.checkers[i].constant) {
        registry.checkers.splice(i, 1);
        return;
      }
    }
  }
  function defineType(constant, opts) {
    if (typeof constant !== 'number') throw TypeError('Constant must be numeric.');
    if (constant < 0 || constant > 255) throw RangeError('Constant must be between 0 and 255.');
    if (typeof opts !== 'object') opts = {};
    if (!registry.types[constant]) registry.types[constant] = $Hash({});
    if (typeof opts.check === 'function') {
      checkSplice(constant);
      registry.checkers.push($Hash({ constant: constant, detect: opts.check }));
    }
    if (typeof opts.encode === 'function') registry.types[constant].encode = opts.encode;
    if (typeof opts.decode === 'function') registry.types[constant].decode = opts.decode;
    if (typeof opts.name === 'string') registry.types[constant].name = 'string';
  }
  function undefineType(constant) {
    if (typeof constant !== 'number') throw TypeError('Argument must be numeric.');
    delete registry.types[constant];
    checkSplice(constant);
  }
// detect environment

  if (HAS_TYPED_ARRAYS = (function () {
    try {
      new Uint8Array(4);
      return true;
    } catch (e) {
      IS_NODE = false;
      NATIVE_LITTLE_ENDIAN = null;
      return false;
    }
  })()) {
    // alias typed arrays that we use a lot
    var $Uint8Array = Uint8Array, $ArrayBuffer = ArrayBuffer,
    // need a couple unions
        buf32 = new $ArrayBuffer(4),
        bytes32 = new $Uint8Array(buf32),
        float = new Float32Array(buf32),
        buf64 = new $ArrayBuffer(8),
        bytes64 = new $Uint8Array(buf64),
        double = new Float64Array(buf64);

    if (IS_NODE = (function () {
      // we just need to know there's a Buffer
        try {
          new Buffer(4);
          return true;
        } catch (e) {
          return false;
        }
    })()) {
      var $Buffer = Buffer, Buffer$isBuffer = $Buffer.isBuffer;
    }

    NATIVE_LITTLE_ENDIAN = (function () {
      var tmp = new $ArrayBuffer(2);
      var ubytes = new $Uint8Array(tmp);
      var ushort = new Uint16Array(tmp);
      ushort[0] = 1;
      return !!ubytes[0];
    })();
  }
  var symCache = {};
  var $Symbol = typeof Symbol === 'function' ? Symbol : function Symbol (str) {
    if (!symCache[str]) symCache[str] = { toString: function () { return str; } };
    return symCache[str];
  };
  function Complex (r, i) {
    if (!(this instanceof Complex)) return new Complex(r, i);
    this.r = r;
    this.i = i;
  }
  function Rational (p, q) {
    if (!(this instanceof Rational)) return new Rational(p, q);
    this.p = p;
    this.q = q;
  }
  // error message helper
  function typeToStr(type) {
    if (typeof type === 'object') {
      if (Array$isArray(type)) {
        if (type.object) return 'OBJECT';
        return 'ARRAY';
      }
      return 'OBJECT';
    }
    if (type === ARRAY) return 'ARRAY';
    if (type === OBJECT) return 'OBJECT';
    if (registry.types[type]) {
      if (registry.types[type].name) return registry.types[type].name;
      else return 'custom unnamed';
    }
    for (var keys = Object$keys(types), i = 0; i < keys.length; ++i) {
      if (types[keys[i]] === type) return keys[i];
    }
    return 'unknown type';
  }
  // mass assignment function used on the LEON object at the end of construction
  function assignTo (obj) {
    if (typeof obj !== 'object') throw TypeError('Argument must be an object');
    var ret = function (props) {
      Array$forEach(Object$keys(props), function (v) {
        this[v] = props[v];
      }, obj);
      return ret;
    };
    return ret;
  }
  // gives you the two's complement in n bits
  function complement(v, bits) {
    if (bits >= 32) return -v;
    return (((1 << bits) - 1) ^ v) + 1;
  }
  return (function () {
    var $$ReallocMixin = (function () {
      // define realloc according to the environment
      var realloc;
      if (HAS_TYPED_ARRAYS) {
        realloc = function realloc (size) {
          if (typeof size === 'undefined') size = this.buffer.byteLength << 1;
          var tmp = this.buffer;
          this.buffer = new $ArrayBuffer(size);
          var bytes = new $Uint8Array(tmp);
          var newBytes = new $Uint8Array(this.buffer);
          newBytes.set(bytes, 0);
          this.uchars = new $Uint8Array(this.buffer);
          this.chars = new Int8Array(this.buffer);
          return this;
        }
      } else {
        realloc = function realloc(size) {
          if (size === void 0) size = this.buffer.length << 1;
          this.buffer.length = size;
          return this;
        };
      }
      return function () {
        this._realloc = realloc;
      }
    })();
    var $$BufferMixin = (function () {
      var writeInt8,
          writeFloatLE,
          writeFloatBE,
          writeDoubleLE,
          writeDoubleBE,
          writeUInt8,
          writeUInt16LE,
          writeUInt16BE,
          writeUInt32LE,
          writeUInt32BE,
          readInt8,
          readFloatLE,
          readFloatBE,
          readDoubleLE,
          readDoubleBE,
          length;

      // interestingly enough, it is much faster to do bitwise arithmetic on individual bytes than it is to use a DataView or construct a temporary typed array view, so we do the math on the unsigned bytes. thus, the signed versions of these functions are the same whether we have typed arrays or not, except for single bytes in which it is faster to use the Int8Array view if we have it.

      if (HAS_TYPED_ARRAYS) {
        writeUInt8 = function writeUInt8 (val, offset) {
          if (offset >= this.buffer.byteLength) this._realloc();
          this.uchars[offset] = val;
          return this; 
        }
        writeInt8 = function writeInt8 (val, offset) {
          if (offset >= this.buffer.byteLength) this._realloc();
          this.chars[offset] = val;
          return this;
        };
        writeUInt16LE = function writeUInt16LE (val, offset) {
          if (offset >= this.buffer.byteLength - 1) this._realloc();
          this.uchars[offset] = val & 0xFF;
          this.uchars[offset + 1] = val >>> 8;
          return this;
        };
        writeUInt16BE = function writeUInt16BE (val, offset) {
          if (offset >= this.buffer.byteLength - 1) this._realloc();
          this.uchars[offset] = val >>> 8;
          this.uchars[offset + 1] = val & 0xFF;
          return this;
        };
        writeUInt32LE = function writeUInt32LE (val, offset) {
          if (offset >= this.buffer.byteLength - 3) this._realloc();
          this.uchars[offset] = val & 0xFF;
          this.uchars[offset + 1] = (val >>> 8) & 0xFF;
          this.uchars[offset + 2] = (val >>> 16) & 0xFF;
          this.uchars[offset + 3] = val >>> 24;
          return this;
        };
        writeUInt32BE = function writeUInt32BE (val, offset) {
          if (offset >= this.buffer.byteLength - 3) this._realloc();
          this.uchars[offset + 3] = val & 0xFF;
          this.uchars[offset + 2] = (val >>> 8) & 0xFF;
          this.uchars[offset + 1] = (val >>> 16) & 0xFF;
          this.uchars[offset] = val >>> 24;
          return this;
        };
        readInt8 = function readInt8 (offset) {
          return this.chars[offset];
        };
        if (NATIVE_LITTLE_ENDIAN) {
          writeFloatLE = function (val, offset) {
            if (offset >= this.buffer.byteLength - 3) this._realloc();
            float[0] = val;
            this.uchars.set(bytes32, offset);
            return this;
          }
          writeFloatBE = function (val, offset) {
            if (offset >= this.buffer.byteLength - 3) this._realloc();
            float[0] = val;
            this.uchars[offset] = bytes32[3];
            this.uchars[offset + 1] = bytes32[2];
            this.uchars[offset + 2] = bytes32[1];
            this.uchars[offset + 3] = bytes32[0];
            return this;
          }
          writeDoubleLE = function writeDoubleLE (val, offset) {
            if (offset >= this.buffer.byteLength - 7) this._realloc();
            double[0] = val;
            this.uchars.set(bytes64, offset);
            return this;
          };
          writeDoubleBE = function writeDoubleLE (val, offset) {
            if (offset >= this.buffer.byteLength - 7) this._realloc();
            double[0] = val;
            this.uchars[offset] = bytes64[7];
            this.uchars[offset + 1] = bytes64[6];
            this.uchars[offset + 2] = bytes64[5];
            this.uchars[offset + 3] = bytes64[4];
            this.uchars[offset + 4] = bytes64[3];
            this.uchars[offset + 5] = bytes64[2];
            this.uchars[offset + 6] = bytes64[1];
            this.uchars[offset + 7] = bytes64[0];
            return this;
          };
          readFloatLE = function readFloatLE (offset) {
            bytes32[0] = this.uchars[offset];
            bytes32[1] = this.uchars[offset + 1];
            bytes32[2] = this.uchars[offset + 2];
            bytes32[3] = this.uchars[offset + 3];
            return float[0];
          };
          readFloatBE = function readFloatBE (offset) {
            bytes32[0] = this.uchars[offset + 3];
            bytes32[1] = this.uchars[offset + 2];
            bytes32[2] = this.uchars[offset + 1];
            bytes32[3] = this.uchars[offset + 0];
            return float[0];
          };
          readDoubleLE = function readDoubleLE (offset) {
            bytes64[0] = this.uchars[offset];
            bytes64[1] = this.uchars[offset + 1];
            bytes64[2] = this.uchars[offset + 2];
            bytes64[3] = this.uchars[offset + 3];
            bytes64[4] = this.uchars[offset + 4];
            bytes64[5] = this.uchars[offset + 5];
            bytes64[6] = this.uchars[offset + 6];
            bytes64[7] = this.uchars[offset + 7];
            return double[0];
          };
          readDoubleBE = function readDoubleBE (offset) {
            bytes64[0] = this.uchars[offset + 7];
            bytes64[1] = this.uchars[offset + 6];
            bytes64[2] = this.uchars[offset + 5];
            bytes64[3] = this.uchars[offset + 4];
            bytes64[4] = this.uchars[offset + 3];
            bytes64[5] = this.uchars[offset + 2];
            bytes64[6] = this.uchars[offset + 1];
            bytes64[7] = this.uchars[offset];
            return double[0];
          };
        } else {
          writeFloatLE = function writeFloatLE (val, offset) {
            if (offset >= this.buffer.byteLength - 3) this._realloc();
            float[0] = val;
            this.uchars[offset] = bytes32[3];
            this.uchars[offset + 1] = bytes32[2];
            this.uchars[offset + 2] = bytes32[1];
            this.uchars[offset + 3] = bytes32[0];
            return this;
          };
          writeFloatBE = function writeFloatBE (val, offset) {
            if (offset >= this.buffer.byteLength - 3) this._realloc();
            float[0] = val;
            this.uchars[offset] = bytes32[0];
            this.uchars[offset + 1] = bytes32[1];
            this.uchars[offset + 2] = bytes32[2]
            this.uchars[offset + 3] = bytes32[3];
            return this;
          };
          writeDoubleLE = function writeDoubleLE (val, offset) {
            if (offset >= this.buffer.byteLength - 7) this._realloc();
            double[0] = val;
            this.uchars[offset] = bytes64[7];
            this.uchars[offset + 1] = bytes64[6];
            this.uchars[offset + 2] = bytes64[5];
            this.uchars[offset + 3] = bytes64[4];
            this.uchars[offset + 4] = bytes64[3];
            this.uchars[offset + 5] = bytes64[2];
            this.uchars[offset + 6] = bytes64[1];
            this.uchars[offset + 7] = bytes64[0];
            return this;
          };
          writeDoubleBE = function writeDoubleBE (val, offset) {
            if (offset >= this.buffer.byteLength - 7) this._realloc();
            double[0] = val;
            this.uchars[offset] = bytes64[0];
            this.uchars[offset + 1] = bytes64[1];
            this.uchars[offset + 2] = bytes64[2];
            this.uchars[offset + 3] = bytes64[3];
            this.uchars[offset + 4] = bytes64[4];
            this.uchars[offset + 5] = bytes64[5];
            this.uchars[offset + 6] = bytes64[6];
            this.uchars[offset + 7] = bytes64[7];
            return this;
          };
          readFloatLE = function readFloatLE (offset) {
            bytes32[0] = this.uchars[offset + 3];
            bytes32[1] = this.uchars[offset + 2];
            bytes32[2] = this.uchars[offset + 1];
            bytes32[3] = this.uchars[offset];
            return float[0];
          };
          readFloatBE = function readFloatBE (offset) {
            bytes32[0] = this.uchars[offset];
            bytes32[1] = this.uchars[offset + 1];
            bytes32[2] = this.uchars[offset + 2];
            bytes32[3] = this.uchars[offset + 3];
            return float[0];
          };
          readDoubleLE = function readDoubleLE (offset) {
            bytes64[0] = this.uchars[offset + 7];
            bytes64[1] = this.uchars[offset + 6];
            bytes64[2] = this.uchars[offset + 5];
            bytes64[3] = this.uchars[offset + 4];
            bytes64[4] = this.uchars[offset + 3];
            bytes64[5] = this.uchars[offset + 2];
            bytes64[6] = this.uchars[offset + 1];
            bytes64[7] = this.uchars[offset];
            return double[0];
          };
          readDoubleBE = function readDoubleBE (offset) {
            bytes64[0] = this.uchars[offset];
            bytes64[1] = this.uchars[offset + 1];
            bytes64[2] = this.uchars[offset + 2];
            bytes64[3] = this.uchars[offset + 3];
            bytes64[4] = this.uchars[offset + 4];
            bytes64[5] = this.uchars[offset + 5];
            bytes64[6] = this.uchars[offset + 6];
            bytes64[7] = this.uchars[offset + 7];
            return double[0];
          };
        }
      } else {
        writeUInt8 = function writeUInt8 (val, offset) {
          if (offset >= this.uchars.length) this._realloc();
          this.uchars[offset] = val;
          return this; 
        };
        writeInt8 = function writeInt8 (val, offset) {
          if (val < 0) val = complement(-val, 8);
          this.writeUInt8(val, offset);
        };
        writeUInt16LE = function writeUInt16LE (val, offset) {
          if (offset >= this.uchars.length - 1) this._realloc();
          this.uchars[offset] = val & 0xFF;
          this.uchars[offset + 1] = val >>> 8;
          return this;
        };
        writeUInt16BE = function writeUInt16LE (val, offset) {
          if (offset >= this.uchars.length - 1) this._realloc();
          this.uchars[offset + 1] = val & 0xFF;
          this.uchars[offset] = val >>> 8;
          return this;
        };
        writeUInt32LE = function writeUInt32LE (val, offset) {
          if (offset >= this.uchars.length - 3) this._realloc();
          this.uchars[offset] = val & 0xFF;
          this.uchars[offset + 1] = (val >>> 8) & 0xFF;
          this.uchars[offset + 2] = (val >>> 16) & 0xFF;
          this.uchars[offset + 3] = val >>> 24;
          return this;
        };
        writeUInt32BE = function writeUInt32LE (val, offset) {
          if (offset >= this.uchars.length - 3) this._realloc();
          this.uchars[offset + 3] = val & 0xFF;
          this.uchars[offset + 2] = (val >>> 8) & 0xFF;
          this.uchars[offset + 1] = (val >>> 16) & 0xFF;
          this.uchars[offset] = val >>> 24;
          return this;
        };
        writeFloatLE = function writeFloatLE (val, offset) {
          var exp = 127, sign, log;
          if (val < 0) sign = 1;
          else sign = 0;
          val = Math.abs(val);
          log = Math.log(val)/Math.LN2;
          if (log < 0) log = Math.ceil(log);
          else log = Math.floor(log);
          val *= Math.pow(2, -log + 23);
          exp += log;
          val = Math.round(val);
          val &= 0x7FFFFF;
          this.writeUInt8(val & 0xFF, offset);
          this.writeUInt8((val >> 8) & 0xFF, offset + 1);
          this.writeUInt8(((exp & 0x01) << 7) | ((val >> 16) & 0x7F), offset + 2);
          this.writeUInt8((sign << 7) | ((exp & 0xFE) >> 1), offset + 3);
          return offset + 4;
        };
        writeFloatBE = function writeFloatLE (val, offset) {
          var exp = 127, sign, log;
          if (val < 0) sign = 1;
          else sign = 0;
          val = Math.abs(val);
          log = Math.log(val)/Math.LN2;
          if (log < 0) log = Math.ceil(log);
          else log = Math.floor(log);
          val *= Math.pow(2, -log + 23);
          exp += log;
          val = Math.round(val);
          val &= 0x7FFFFF;
          this.writeUInt8(val & 0xFF, offset + 3);
          this.writeUInt8((val >> 8) & 0xFF, offset + 2);
          this.writeUInt8(((exp & 0x01) << 7) | ((val >> 16) & 0x7F), offset + 1);
          this.writeUInt8((sign << 7) | ((exp & 0xFE) >> 1), offset);
          return offset + 4;
        }
        writeDoubleLE = function writeDoubleLE (val, offset) {
          var exp = 1023, sign, log;
          if (val < 0) sign = 1;
          else sign = 0;
          val = Math.abs(val);
          log = Math.log(val)/Math.LN2;
          if (log < 0) log = Math.ceil(log);
          else log = Math.floor(log);
          val *= Math.pow(2, -log + 52);
          exp += log;
          val = Math.round(val);
          val = parseInt(val.toString(2).substr(1), 2);
          var ret = [];
          ret.push(sign << 7);
          ret[0] |= (exp >> 4);
          ret.push((exp & 0x0F) << 4);
          ret[1] |= (Math.floor(val*Math.pow(2, -48)) & 0x0F);
          var sh = 40;
          for (var i = 0; i < 6; ++i) {
            ret.push(Math.floor(val*Math.pow(2, -sh)) & 0xFF);
            sh -= 8;
          }
          for (i = 7; i >= 0; --i) {
            this.writeUInt8(ret[i], offset + (7 - i));
          }
          return offset + 8; 
        };
        writeDoubleBE = function writeDoubleLE (val, offset) {
          var exp = 1023, sign, log;
          if (val < 0) sign = 1;
          else sign = 0;
          val = Math.abs(val);
          log = Math.log(val)/Math.LN2;
          if (log < 0) log = Math.ceil(log);
          else log = Math.floor(log);
          val *= Math.pow(2, -log + 52);
          exp += log;
          val = Math.round(val);
          val = parseInt(val.toString(2).substr(1), 2);
          var ret = [];
          ret.push(sign << 7);
          ret[0] |= (exp >> 4);
          ret.push((exp & 0x0F) << 4);
          ret[1] |= (Math.floor(val*Math.pow(2, -48)) & 0x0F);
          var sh = 40;
          for (var i = 0; i < 6; ++i) {
            ret.push(Math.floor(val*Math.pow(2, -sh)) & 0xFF);
            sh -= 8;
          }
          for (i = 0; i < 8; ++i) {
            this.writeUInt8(ret[i], offset + (7 - i));
          }
          return offset + 8; 
        };
        readInt8 = function readInt8 (offset) {
          var val = this.uchars[offset];
          if (val & 0x80) return -complement(val, 8);
          return val;
        };
        readFloatLE = function readFloatLE (offset) {
          var bytes = [];
          for (var i = 3; i >= 0; --i) {
            bytes.push(this.readUInt8(offset + i));
          }
          var sign = ((0x80 & bytes[0]) >> 7);
          var exp = ((bytes[0] & 0x7F) << 1) | ((bytes[1] & 0x80) >> 7);
          var sig = 0;
          bytes[1] &= 0x7F;
          for (var i = 0; i <= 2; ++i) {
            sig |= bytes[i + 1]*Math.pow(2, (2 - i)*8);
          }
          sig |= 0x800000;
          return (sign === 1 ? -sig : sig)*Math.pow(2, exp - (127 + 23));
        };
        readFloatBE = function readFloatBE (offset) {
          var bytes = [];
          for (var i = 0; i < 4; ++i) {
            bytes.push(this.readUInt8(offset + i));
          }
          var sign = ((0x80 & bytes[0]) >> 7);
          var exp = ((bytes[0] & 0x7F) << 1) | ((bytes[1] & 0x80) >> 7);
          var sig = 0;
          bytes[1] &= 0x7F;
          for (var i = 0; i <= 2; ++i) {
            sig |= bytes[i + 1]*Math.pow(2, (2 - i)*8);
          }
          sig |= 0x800000;
          return (sign === 1 ? -sig : sig)*Math.pow(2, exp - (127 + 23));
        };
        readDoubleLE = function readDoubleLE (offset) {
          var bytes = [];
          for (var i = 7; i >= 0; --i) {
            bytes.push(this.readUInt8(offset + i));
          }
          var sign = (0x80 & bytes[0]) >> 7;
          var exp = ((bytes[0] & 0x7F) << 4) | ((bytes[1] & 0xF0) >> 4);
          var sig = 0;
          bytes[1] &= 0x0F;
          for (var i = 0; i <= 6; ++i) {
            sig += bytes[i + 1]*Math.pow(2, (6 - i)*8);
          }
          sig += 0x10000000000000;
          return (sign === 1 ? -sig : sig)*Math.pow(2, exp - (1023 + 52));
        };
        readDoubleBE = function readDoubleBE (offset) {
          var bytes = [];
          for (var i = 0; i < 8; ++i) {
            bytes.push(this.readUInt8(offset + i));
          }
          var sign = (0x80 & bytes[0]) >> 7;
          var exp = ((bytes[0] & 0x7F) << 4) | ((bytes[1] & 0xF0) >> 4);
          var sig = 0;
          bytes[1] &= 0x0F;
          for (var i = 0; i <= 6; ++i) {
            sig += bytes[i + 1]*Math.pow(2, (6 - i)*8);
          }
          sig += 0x10000000000000;
          return (sign === 1 ? -sig : sig)*Math.pow(2, exp - (1023 + 52));
        };
      }
      function writeInt16LE (val, offset) {
        if (val < 0) val = complement(-val, 16);
        return this.writeUInt16LE(val, offset);
      }
      function writeInt16BE (val, offset) {
        if (val < 0) val = complement(-val, 16);
        return this.writeUInt16BE(val, offset);
      }
      function writeInt32LE (val, offset) {
        if (val < 0) val = complement(-val, 32);
        return this.writeUInt32LE(val, offset);
      }
      function writeInt32BE (val, offset) {
        if (val < 0) val = complement(-val, 32);
        return this.writeUInt32BE(val, offset);
      }
      function readUInt8 (offset) {
        return this.uchars[offset];
      }
      function readUInt16LE (offset) {
        return (this.uchars[offset + 1] << 8) | this.uchars[offset];
      }
      function readUInt16BE (offset) {
        return (this.uchars[offset] << 8) | this.uchars[offset + 1];
      }
      function readInt16LE (offset) {
        var ret = this.readUInt16LE(offset);
        if (ret & 0x8000) return -complement(ret, 16);
        return ret;
      }
      function readInt16BE (offset) {
        var ret = this.readUInt16BE(offset);
        if (ret & 0x8000) return -complement(ret, 16);
        return ret;
      }
      function readUInt32LE (offset) {
        return (this.uchars[offset + 3] << 24) | (this.uchars[offset + 2] << 16) | (this.uchars[offset + 1] << 8) | this.uchars[offset];
      }
      function readUInt32BE (offset) {
        return (this.uchars[offset] << 24) | (this.uchars[offset + 1] << 16) | (this.uchars[offset + 2] << 8) | this.uchars[offset + 3];
      }
      function readInt32LE (offset) {
        var ret = this.readUInt32LE(offset);
        if (ret < 0) return ret;
        if (ret & 0x80000000) return -complement(ret, 32);
        return ret;
      }
      function readInt32BE (offset) {
        var ret = this.readUInt32BE(offset);
        if (ret < 0) return ret;
        if (ret & 0x80000000) return -complement(ret, 32);
        return ret;
      }
      return function () {
        this.writeUInt8 = writeUInt8;
        this.writeInt8 = writeInt8;
        this.writeUInt16LE = writeUInt16LE;
        this.writeUInt16BE = writeUInt16BE;
        this.writeInt16LE = writeInt16LE;
        this.writeInt16BE = writeInt16BE;
        this.writeUInt32LE = writeUInt32LE;
        this.writeUInt32BE = writeUInt32BE;
        this.writeInt32LE = writeInt32LE;
        this.writeInt32BE = writeInt32BE;
        this.writeFloatLE = writeFloatLE;
        this.writeFloatBE = writeFloatBE;
        this.writeDoubleLE = writeDoubleLE;
        this.writeDoubleBE = writeDoubleBE;
        this.readUInt8 = readUInt8;
        this.readInt8 = readInt8;
        this.readUInt16LE = readUInt16LE;
        this.readUInt16BE = readUInt16BE;
        this.readInt16LE = readInt16LE;
        this.readInt16BE = readInt16BE;
        this.readUInt32LE = readUInt32LE;
        this.readUInt32BE = readUInt32BE;
        this.readInt32LE = readInt32LE;
        this.readInt32BE = readInt32BE;
        this.readFloatLE = readFloatLE;
        this.readFloatBE = readFloatBE;
        this.readDoubleLE = readDoubleLE;
        this.readDoubleBE = readDoubleBE;
      }
    })();
    // we only handle strings with values between 0 and 0xFF
    var strToBytes = (function (withTypedArrays, withoutTypedArrays) {
      if (HAS_TYPED_ARRAYS) return withTypedArrays;
      else return withoutTypedArrays;
    })((function strToBytes (str) {
      var ret = new $ArrayBuffer(str.length);
      var bytes = new $Uint8Array(ret);
      for (var i = 0; i < str.length; ++i) {
        bytes[i] = str.charCodeAt(i);
      }
      return ret;
    }), (function strToBytes (str) {
      var ret = new Array(str.length);
      for (var i = 0; i < str.length; ++i) {
        ret[i] = str.charCodeAt(i);
      }
      return ret;
    }));
    var $SmartArrayBuffer = (function (nodeDefinition, browserDefinition, noTypedArrayDefinition) {
      if (IS_NODE) return nodeDefinition;
      else if (HAS_TYPED_ARRAYS) return browserDefinition;
      else return noTypedArrayDefinition;
    })((function $SmartArrayBuffer(length) {
      // Node.js definition
      if (!(this instanceof $SmartArrayBuffer)) return new $SmartArrayBuffer(length);
      if (typeof length === 'undefined') length = ARRAY_BUFFER_DEFAULT_ALLOC;
      if (length instanceof $ArrayBuffer) this.buffer = length;
      else if (typeof length === 'string') {
        this.buffer = strToBytes(length);
      } else if (Buffer$isBuffer(length)) {
        var tmp = length;
        length = new $ArrayBuffer(tmp.length);
        var bytes = new $Uint8Array(length);
        for (var i = 0; i < tmp.length; ++i) {
          bytes[i] = tmp[i];
        }
        this.buffer = length;
      } else this.buffer = new $ArrayBuffer(length);
      this.uchars = new $Uint8Array(this.buffer);
      this.chars = new Int8Array(this.buffer);
      $$BufferMixin.call(this);
      $$ReallocMixin.call(this);
    }), (function $SmartArrayBuffer(length) {
      // browser definition
      if (!(this instanceof $SmartArrayBuffer)) return new $SmartArrayBuffer(length);
      if (typeof length === 'undefined') length = ARRAY_BUFFER_DEFAULT_ALLOC;
      if (typeof length === 'string') this.buffer = strToBytes(length);
      else if (length instanceof $ArrayBuffer) this.buffer = length;
      else this.buffer = new $ArrayBuffer(length);
      this.uchars = new $Uint8Array(this.buffer);
      this.chars = new Int8Array(this.buffer);
      $$BufferMixin.call(this);
      $$ReallocMixin.call(this);
    }), (function $SmartArrayBuffer(length) {
      // old browser definition
      if (!(this instanceof $SmartArrayBuffer)) return new $SmartArrayBuffer(length);
      if (typeof length === 'undefined') length = ARRAY_BUFFER_DEFAULT_ALLOC;
      if (Array$isArray(length)) this.buffer = length;
      else if (typeof length === 'string') this.buffer = strToBytes(length);
      else this.buffer = new $Array(length);
      this.uchars = this.buffer;
      $$BufferMixin.call(this);
      $$ReallocMixin.call(this);
    }));

    function regexpCheck(val) {
      return toString.call(val) === '[object RegExp]';
    }

    $SmartArrayBuffer.concat = (function (withTypedArrays, withoutTypedArrays) {
      if (HAS_TYPED_ARRAYS) return withTypedArrays;
      return withoutTypedArrays;
    })((function concat (arr) {
        return $SmartArrayBuffer(Array$reduce(arr, function (r, v) {
          var ret = new $Uint8Array(r.buffer.byteLength + v.buffer.byteLength);
          ret.set(new $Uint8Array(r.buffer), 0);
          ret.set(new $Uint8Array(v.buffer), r.buffer.byteLength);
          return ret.buffer;
        }, new $ArrayBuffer(0)));
      }), (function concat (arr) {
        return $SmartArrayBuffer(Array$reduce(arr, function (r, v) {
          return r.concat(v.buffer);
        }, []));
      })
    );
    function assertUnsignedNumeric(type, readType, iterator) {
      switch (readType) {
        case UINT8:
        case UINT16:
        case UINT32:
        case DOUBLE:
          break;
        default:
          throw TypeError('Was expecting a numeric type at ' + $String(iterator.position) + ' to read length of ' + typeToStr(type) + ' but instead got ' + typeToStr(readType) + '.');
      }
    }
    function readValue (spec) {
      var ret, i, length, keys, type;
      if (spec instanceof Channel) spec = spec.sorted;
      if (spec === undefined || spec === DYNAMIC) return $readDynamic.call(this);
      if (spec === STRING) {
        return this.readStringUTF8();
      }
      if (typeof spec === 'object') {
        if (Array$isArray(spec)) {
          if (spec.length === 0) return $readTyped.call(this, ARRAY);
          if (spec.object) {
            ret = {};
            for (i = 0; i < spec.length; ++i) {
              ret[spec[i].key] = this.readValue(spec[i].type);
            }
            return ret;
          }
          if (spec.length > 1) {
            ret = new $Array(length);
            for (i = 0; i < length; ++i) {
              ret[i] =  this.readValue(spec[i]);
            }
            return ret;
          }
          type = this.readUInt8();
          assertUnsignedNumeric(spec, type, this);
          length = this.readValue(type);
          ret = new $Array(length);
          for (i = 0; i < length; ++i) {
            ret[i] = this.readValue(spec[0]);
          }
          return ret;
        }
      } else if (spec === BOOLEAN) {
        return $readDynamic.call(this);
      } else {
        return $readTyped.call(this, spec);
      }
    } 
    function $readDynamic() {
      return $readTyped.call(this, this.readUInt8());
    }
    function $readTyped(type) {
      var length, i, ret, index, stamp, key, lenType;
      if (registry.types[type]) {
        if (!registry.types[type].decode) throw Error('Tried to decode a custom type for which there is no defined decode function.');
        this.offset += this.position;
        this.position = 0;
        return registry.types[type].decode(this);
      }
      switch (type) {
        case UINT8:
          return this.readUInt8();
        case INT8:
          return this.readInt8();
        case UINT16:
          return this.readUInt16LE();
        case INT16:
          return this.readInt16LE();
        case UINT32:
          return this.readUInt32LE();
        case INT32:
          return this.readInt32LE();
        case FLOAT:
          return this.readFloatLE();
        case DOUBLE:
          return this.readDoubleLE();
        case ARRAY:
          lenType = this.readUInt8();
          assertUnsignedNumeric(type, lenType, this);
          length = this.readValue(lenType);
          ret = new $Array(length);
          for (i = 0; i < length; ++i) {
            ret[i] = this.readValue();
          }
          return ret;
        case OBJECT:
          ret = {};
          lenType = this.readUInt8();
          assertUnsignedNumeric(type, lenType, this);
          length = this.readValue(lenType);
          for (i = 0; i < length; ++i) {
            key = this.readStringUTF8();
            ret[key] = this.readValue();
          }
          break;
        case UTF8STRING:
          return this.readStringUTF8();
        case UTF16STRING:
          return this.readStringUTF16();
        case DYNAMIC:
          return this.readValue();
        case UNDEFINED:
          return void 0;
        case TRUE:
          return true;
        case FALSE:
          return false;
        case NULL:
          return null;
        case NAN:
          return NaN;
        case MINUS_INFINITY:
          return Number.NEGATIVE_INFINITY;
        case INFINITY:
          return Number.POSITIVE_INFINITY;
        case DATE:
          return new Date(this.readDoubleLE());
        case BUFFER:
          lenType = this.readUInt8();
          assertUnsignedNumeric(type, lenType, this);
          length = this.readValue(lenType);
          if (IS_NODE) {
            ret = new $Buffer(length);
            for (i = 0; i < length; ++i) {
              ret[i] = this.readUInt8();
            }
          } else {
            ret = new $ArrayBuffer(length);
            var bytes = new $Uint8Array(ret);
            for (i = 0; i < length; ++i) {
              bytes[i] = this.readUInt8();
            }
          }
          return ret;
        case REGEXP:
          return RegExp(this.readStringUTF8(), flagsConv(this.readUInt8()));
        case SYMBOL:
          return $Symbol(this.readStringUTF8());
        case COMPLEX:
          return Complex(this.readDouble(), this.readDouble());
        case RATIONAL:
          return Rational(this.readDouble(), this.readDouble());
        default:
          throw Error('Parsed invalid LEON constant: ' + $String(type));
      }
      return ret;
    }
    function maybeEOF(iterator, bytes) {
      if (iterator.position + iterator.offset + bytes > iterator.buffer.uchars.length) throw RangeError('Tried to read past end of buffer at position ' + (iterator.position + iterator.offset) + '.');
    }
    var $$IteratorMixin = (function () {
      // this mixin just lets us read over the bytes of a buffer wthout keeping track of where we are.
      var $writeBuffer;
      function readUInt8 () {
        maybeEOF(this, 1);
        this.position++;
        return this.buffer.readUInt8(this.offset + this.position - 1);
      }
      function readInt8 () {
        maybeEOF(this, 1);
        this.position++;
        return this.buffer.readInt8(this.offset + this.position - 1);
      }
      function readUInt16LE () {
        maybeEOF(this, 2);
        this.position += 2;
        return this.buffer.readUInt16LE(this.offset + this.position - 2);
      }
      function readUInt16BE () {
        maybeEOF(this, 2);
        this.position += 2;
        return this.buffer.readUInt16BE(this.offset + this.position - 2);
      }
      function readInt16LE () {
        maybeEOF(this, 2);
        this.position += 2;
        return this.buffer.readInt16LE(this.offset + this.position - 2);
      }
      function readInt16BE () {
        maybeEOF(this, 2);
        this.position += 2;
        return this.buffer.readInt16BE(this.offset + this.position - 2);
      }
      function readUInt32LE () {
        maybeEOF(this, 4);
        this.position += 4;
        return this.buffer.readUInt32LE(this.offset + this.position - 4);
      }
      function readUInt32BE () {
        maybeEOF(this, 4);
        this.position += 4;
        return this.buffer.readUInt32BE(this.offset + this.position - 4);
      }
      function readInt32LE () {
        maybeEOF(this, 4);
        this.position += 4;
        return this.buffer.readInt32LE(this.offset + this.position - 4);
      }
      function readInt32BE () {
        maybeEOF(this, 4);
        this.position += 4;
        return this.buffer.readInt32BE(this.offset + this.position - 4);
      }
      function readFloatLE () {
        maybeEOF(this, 4);
        this.position += 4;
        return this.buffer.readFloatLE(this.offset + this.position - 4);
      }
      function readFloatBE () {
        maybeEOF(this, 4);
        this.position += 4;
        return this.buffer.readFloatBE(this.offset + this.position - 4);
      }
      function readDoubleLE () {
        maybeEOF(this, 8);
        this.position += 8;
        return this.buffer.readDoubleLE(this.offset + this.position - 8);
      }
      function readDoubleBE () {
        maybeEOF(this, 8);
        this.position += 8;
        return this.buffer.readDoubleBE(this.offset + this.position - 8);
      }
      function writeStringUTF8 (str) {
        str = unescape(encodeURIComponent(str));
        this.writeValue(str.length);
        for (var i = 0; i < str.length; ++i) {
          this.writeUInt8(str.charCodeAt(i));
        }
        return this;
      }
      function writeStringASCII(str) {
        this.writeValue(str.length);
        for (var i = 0; i < str.length; ++i) {
          this.writeUInt8(str.charCodeAt(i));
        }
        return this;
      }
      function writeStringUTF16(str) {
        this.writeValue(str.length);
        for (var i = 0; i < str.length; ++i) {
          this.writeUInt16LE(str.charCodeAt(i));
        }
        return this;
      }
      function writeUInt8(val) {
        this.buffer.writeUInt8(val, this.offset + this.position);
        ++this.position;
        return this;
      }
      function writeInt8(val) {
        this.buffer.writeInt8(val, this.offset + this.position);
        ++this.position;
        return this;
      }
      function writeUInt16LE(val) {
        this.buffer.writeUInt16LE(val, this.offset + this.position);
        this.position += 2;
        return this;
      }
      function writeUInt16BE(val) {
        this.buffer.writeUInt16BE(val, this.offset + this.position);
        this.position += 2;
        return this;
      }
      function writeInt16LE(val) {
        this.buffer.writeInt16LE(val, this.offset + this.position);
        this.position += 2;
        return this;
      }
      function writeInt16BE(val) {
        this.buffer.writeInt16BE(val, this.offset + this.position);
        this.position += 2;
        return this;
      }
      function writeUInt32LE(val) {
        this.buffer.writeUInt32LE(val, this.offset + this.position);
        this.position += 4;
        return this;
      }
      function writeUInt32BE(val) {
        this.buffer.writeUInt32BE(val, this.offset + this.position);
        this.position += 4;
        return this;
      }
      function writeInt32LE(val) {
        this.buffer.writeInt32LE(val, this.offset + this.position);
        this.position += 4;
        return this;
      }
      function writeInt32BE(val) {
        this.buffer.writeInt32BE(val, this.offset + this.position);
        this.position += 4;
        return this;
      }
      function writeFloatLE(val) {
        this.buffer.writeFloatLE(val, this.offset + this.position);
        this.position += 4;
        return this;
      }
      function writeFloatBE(val) {
        this.buffer.writeFloatBE(val, this.offset + this.position);
        this.position += 4;
        return this;
      }
      function writeDoubleLE(val) {
        this.buffer.writeDoubleLE(val, this.offset + this.position);
        this.position += 8;
        return this;
      }
      function writeDoubleBE(val) {
        this.buffer.writeDoubleBE(val, this.offset + this.position);
        this.position += 8;
        return this;
      }
      if (IS_NODE) {
        $writeBuffer = function (val) {
          var bytes, i;
          if (val instanceof $ArrayBuffer) {
            bytes = new $Uint8Array(val);
            this.writeValue(bytes.length);
            for (i = 0; i < bytes.length; ++i) {
              this.writeUInt8(bytes[i]);
            }
          } else if (Buffer$isBuffer(val)) {
            this.writeValue(val.length);
            for (i = 0; i < val.length; ++i) {
              this.writeUInt8(val[i]);
            }
          } else if (typeof val === 'string') {
            this.writeStringASCII(val);
          }
        };
      } else {
        if (HAS_TYPED_ARRAYS) {
          $writeBuffer = function writeBuffer(val) {
            var bytes;
            if (val instanceof $ArrayBuffer) {
              bytes = new $Uint8Array(val);
              this.writeValue(bytes.length);
              for (i = 0; i < bytes.length; ++i) {
                this.writeUInt8(bytes[i]);
              }
            } else if (typeof val === 'string') {
              this.writeStringASCII(val);
            }
          };
        } else {
          $writeBuffer = function writeBuffer(val) {
            this.writeStringASCII(val);
          }
        }
      }
      function $writeDynamic(val) {
        var type = typeCheck(val);
        this.writeUInt8(type);
        return $writeTyped.call(this, val, type, true);
      }
      function $writeTyped(val, type, quiet) {
        var i, tmp, index, parts;
        if (registry.types[type]) {
          if (!registry.types[type].encode) throw TypeError('Tried to encode a custom type without first defining an encode function.');
          this.offset += this.position;
          this.position = 0;
          registry.types[type].encode(this, val);
          return this;
        }
        switch (type) {
          case UNDEFINED:
          case TRUE:
          case FALSE:
          case NULL:
          case NAN:
          case MINUS_INFINITY:
          case INFINITY:
            return this;
          case UTF8STRING:
            if (!quiet && typeof val !== 'string') throw TypeError('Was expecting a STRING but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeStringUTF8(val);
            return this;
          case UTF16STRING:
            if (!quiet && typeof val !== 'string') throw TypeError('Was expecting a STRING but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeStringUTF16(val);
            return this;
          case INT8:
            if (!quiet && typeof val !== 'number') throw TypeError('Was expecting a numeric type but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeInt8(val);
            return this;
          case UINT8:
            if (!quiet && typeof val !== 'number') throw TypeError('Was expecting a numeric type but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeUInt8(val);
            return this;
          case INT16:
            if (!quiet && typeof val !== 'number') throw TypeError('Was expecting a numeric type but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeInt16LE(val);
            return this;
          case UINT16:
            if (!quiet && typeof val !== 'number') throw TypeError('Was expecting a numeric type but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeUInt16LE(val);
            return this;
          case INT32:
            if (!quiet && typeof val !== 'number') throw TypeError('Was expecting a numeric type but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeInt32LE(val);
            return this;
          case UINT32:
            if (!quiet && typeof val !== 'number') throw TypeError('Was expecting a numeric type but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeUInt32LE(val);
            return this;
          case FLOAT:
            if (!quiet && typeof val !== 'number') throw TypeError('Was expecting a numeric type but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeFloatLE(val);
            return this;
          case DOUBLE:
            if (!quiet && typeof val !== 'number') throw TypeError('Was expecting a numeric type but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeDoubleLE(val);
            return this;
          case ARRAY:
            if (!quiet && !Array$isArray(val)) throw TypeError('Was expecting an ARRAY but received a ' + typeToStr(typeCheck(val)) + '.');
            $writeDynamic.call(this, val.length);
            for (i = 0; i < val.length; ++i) {
              $writeDynamic.call(this, val[i]);
            }
            return this;
          case OBJECT:
            if (!quiet && typeof obj !== 'object') throw TypeError('Was expecting an OBJECT but received a ' + typeToStr(typeCheck(val)) + '.');
            index = Object$keys(val);
            $writeDynamic.call(this, index.length);
            for (i = 0; i < index.length; ++i) {
              this.writeStringUTF8(index[i]);
              $writeDynamic.call(this, val[index[i]]);
            }
            return this;
          case DATE:
            if (!quiet && toString.call(val) !== '[object Date]') throw TypeError('Was expecting a DATE but received a ' + typeToStr(typeCheck(val)) + '.');
            return this.writeDoubleLE(val.valueOf());
          case BUFFER:
            if (!quiet && !bufferCheck(val)) throw TypeError('Was expecting a BUFFER but received a ' + typeToStr(typeCheck(val)) + '.');
            return $writeBuffer.call(this, val);
          case REGEXP:
            if (!quiet && !regexpCheck(val)) throw TypeError('Was expecting a REGEXP but received a ' + typeToStr(typeCheck(val)) + '.');
            parts = regexpToParts(val);
            this.writeStringUTF8(parts[0]);
            return this.writeUInt8(flagsConv(parts[1]));
          case SYMBOL:
            if (!quiet && typeof val !== 'symbol') throw TypeError('Was expecting a SYMBOL but received a ' + typeToStr(typeCheck(val)) + '.');
            return this.writeStringUTF8(val.toString());
          case COMPLEX:
            if (!quiet && !(val instanceof Complex)) throw TypeError('Was expecting a COMPLEX but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeDoubleLE(val.r);
            return this.writeDoubleLE(val.i);
          case RATIONAL:
            if (!quiet && !(val instanceof Rational)) throw TypeError('Was expecting a RATIONAL but received a ' + typeToStr(typeCheck(val)) + '.');
            this.writeDoubleLE(val.p);
            return this.writeDoubleLE(val.q);
        }
      }
      function writeValue(val, spec) {
        var i;
        if (spec instanceof Channel) spec = spec.sorted;
        if (spec === undefined || spec === DYNAMIC) return $writeDynamic.call(this, val);
        if (Array$isArray(spec)) {
          if (spec.object) {
            if (typeof val !== 'object') throw TypeError('Was expecting an OBJECT but received a ' + typeToStr(typeCheck(val)) + '.')
            for (i = 0; i < spec.length; ++i) {
              this.writeValue(val[spec[i].key], spec[i].type);
            }
            return this;
          }
          if (spec.length === 1) {
            if (!Array$isArray(val)) throw TypeError('Was expecting an ARRAY but received a ' + typeToStr(typeCheck(val)) + '.');
            $writeDynamic.call(this, val.length);
            for (i = 0; i < val.length; ++i) {
              this.writeValue(val[i], spec[0]);
            }
            return this;
          }
          else {
            if (!Array$isArray(val)) throw TypeError('Was expecting an ARRAY but received a ' + typeToStr(typeCheck(val)) + '.');
            if (val.length < spec.length) throw RangeError('Was expecting an ARRAY with length of at least ' + $String(spec.length) + ' but was provided one of length ' + $String(val.length) + '.');
            for (i = 0; i < spec.length; ++i) {
              this.writeValue(val[i], spec[i]);
            }
            return this;
          }
        }
        if (spec === BOOLEAN) return $writeDynamic.call(this, val);
        return $writeTyped.call(this, val, spec);
      }
      return function () {
        this.readUInt8 = readUInt8;
        this.readInt8 = readInt8;
        this.readUInt16LE = readUInt16LE;
        this.readUInt16BE = readUInt16BE;
        this.readInt16LE = readInt16LE;
        this.readInt16BE = readInt16BE;
        this.readUInt32LE = readUInt32LE;
        this.readUInt32BE = readUInt32BE;
        this.readInt32LE = readInt32LE;
        this.readInt32BE = readInt32BE;
        this.readFloatLE = readFloatLE;
        this.readFloatBE = readFloatBE;
        this.readDoubleLE = readDoubleLE;
        this.readDoubleBE = readDoubleBE;
        this.readStringUTF16 = function (length) {
          var ret = '', lenType, len, i = 0;
          if (typeof length === 'number') len = length;
          else {
            lenType = this.readUInt8();
            assertUnsignedNumeric(UTF16STRING, lenType, this);
            len = this.readValue(lenType);
          }
          maybeEOF(this, len*2);
          i = 0;
          while (i < len) {
            ret += String$fromCharCode(this.readUInt16LE());
            ++i;
          }
          return ret;
        };
        this.readStringUTF8 = function (length) {
          var ret = '', lenType, len, i = 0;
          if (typeof length === 'number') len = length;
          else {
            lenType = this.readUInt8();
            assertUnsignedNumeric(UTF8STRING, lenType, this);
            len = this.readValue(lenType);
          }
          maybeEOF(this, len);
          while (i < len) {
            ret += String$fromCharCode(this.readUInt8());
            ++i;
          }
          return decodeURIComponent(escape(ret));
        };
        this.readStringASCII = function (length) {
          var ret = '', lenType, len, i = 0;
          if (typeof length === 'number') len = length;
          else {
            lenType = this.readUInt8();
            assertUnsignedNumeric(STRING, lenType, this);
            len = this.readValue(lenType);
          }
          maybeEOF(this, len);
          while (i < len) {
            ret += String$fromCharCode(this.readUInt8());
            ++i;
          }
          return ret;
        };
        this.readValue = readValue;
        this.writeStringUTF8 = writeStringUTF8;
        this.writeStringUTF16 = writeStringUTF16;
        this.writeUInt8 = writeUInt8;
        this.writeInt8 = writeInt8;
        this.writeUInt16LE = writeUInt16LE;
        this.writeUInt16BE = writeUInt16BE;
        this.writeInt16LE = writeInt16LE;
        this.writeInt16BE = writeInt16BE;
        this.writeUInt32LE = writeUInt32LE;
        this.writeUInt32BE = writeUInt32BE;
        this.writeInt32LE = writeInt32LE;
        this.writeInt32BE = writeInt32BE;
        this.writeFloatLE = writeFloatLE;
        this.writeFloatBE = writeFloatBE;
        this.writeDoubleLE = writeDoubleLE;
        this.writeDoubleBE = writeDoubleBE;
        this.writeValue = writeValue;
      }
    })();
    $$IteratorMixin.call(BufferIterator.prototype);
    function BufferIterator(buffer, offset, position) {
      if (!(this instanceof BufferIterator)) return new BufferIterator(buffer, offset, position);
      this.buffer = $SmartArrayBuffer(buffer);
      if (typeof offset === 'number' && offset > 0) this.offset = offset;
      else this.offset = 0;
      if (typeof position === 'number' && position > 0) this.position = position;
      else this.position = 0;
    }
    // we need a different definition of bufferCheck if we don't have typed arrays and also if we don't have buffers.
    var bufferCheck = (function (nodeDefinition, newBrowserDefinition, oldBrowserDefinition) {
      if (IS_NODE) return nodeDefinition;
      if (HAS_TYPED_ARRAYS) return newBrowserDefinition;
      return oldBrowserDefinition;
    })((function (val) {
      if (Buffer$isBuffer(val) || val instanceof $ArrayBuffer) return true;
      return false;
    }), (function (val) {
      if (val instanceof $ArrayBuffer) return true;
      return false;
    }), (function () { return false; }));

    var fpCheck = (function (withTypedArrays, withoutTypedArrays) {
      if (HAS_TYPED_ARRAYS) return withTypedArrays;
      return withoutTypedArrays;
    })((function (val) {
      float[0] = val;
      if (float[0] === val) return FLOAT;
      return DOUBLE;
    }), (function (val) {
      // formula to test if a value fits in an IEEE754 32-bit float, free to use
      val = Math.abs(val);
      var log = Math.log(val)/Math.LN2;
      log = (log < 0 ? Math.ceil(log) : Math.floor(log));
      var exp = 103 + log;
      if (exp < 0 || exp > 255) return DOUBLE;
      val *= Math.pow(2, -log + 24);
      if (Math.floor(val) !== val) return DOUBLE;
      return FLOAT;
    }));

    function typeCheck(val, isFloat) {
      var i, type = typeof val, asStr;
      for (i = 0; i < registry.checkers.length; ++i) {
        if (registry.checkers[i].detect(val)) return registry.checkers[i].constant;
      }
      switch (type) {
        case 'object':
          if (val === null) return NULL;
          if (Array$isArray(val)) return ARRAY;
          asStr = toString.call(val);
          switch (asStr) {
            case '[object Date]':
              return DATE;
            case '[object RegExp]':
              return REGEXP;
            default:
              if (bufferCheck(val)) return BUFFER;
              if (val instanceof Complex) return COMPLEX;
              if (val instanceof Rational) return RATIONAL;
              if (val instanceof Symbol) return SYMBOL;
              return OBJECT;
          }
        case 'boolean':
          return val ? TRUE : FALSE;
        case 'string':
          return STRING;
        case 'number':
          if (val !== val) return NAN;
          if (val === Number.NEGATIVE_INFINITY) return MINUS_INFINITY;
          if (val === Number.POSITIVE_INFINITY) return INFINITY;
          if (val % 1 || isFloat) {
            return fpCheck(val);
          }
          if (val < 0) {
            if (Math.abs(val) <= 1 << 7) return INT8;
            if (Math.abs(val) <= 1 << 15) return INT16;
            if (Math.abs(val) <= Math.pow(2, 31)) return INT32;
            return DOUBLE;
          }
          if (val < 1 << 8) return UINT8;
          if (val < 1 << 16) return UINT16;
          if (val < Math.pow(2, 32)) return UINT32;
          return DOUBLE;
        case 'undefined':
        case 'function':
          return UNDEFINED;
        case 'symbol':
          return SYMBOL;
      }
    }
    // we need a faster way to convert a sequence of bytes to a string without performing a string concatenation for each character. if we read bytes in chunks of 8192 this function always works. we don't bother if typed arrays are not supported.
    var fastBytesToStr = (function (withTypedArrays, withoutTypedArrays) {
      if (HAS_TYPED_ARRAYS) return withTypedArrays;
      return withoutTypedArrays;
    })((function fastBytesToStr(buf) {
      var ret = '', i = 0, view;
      buf = buf.buffer;
      while (i < buf.byteLength) {
        view = new $Uint8Array(buf, i, Math.min(8192, buf.byteLength - i));
        ret += String$fromCharCode.apply(void 0, view);
        i += 8192;
      }
      return ret;
    }), (function fastBytesToStr(arr) {
      var ret = '';
      for (var i = 0; i < arr.length; ++i) {
        ret += String$fromCharCode(arr[i]);
      }
      return ret;
    }));

    var $$EncoderMixin = (function () {
      var toBuffer, writeBuffer;
      if (IS_NODE) {
        toBuffer = function toBuffer () {
          var sum = this.iterator.position + this.iterator.offset;
          var ret = new $Buffer(sum);
          for (var i = 0; i < sum; ++i) {
            ret[i] = this.iterator.buffer.uchars[i];
          }
          return ret;
        };
        writeBuffer = function (val) {
          var bytes, i;
          if (val instanceof $ArrayBuffer) {
            bytes = new $Uint8Array(val);
            this.iterator.writeValue(bytes.length, typeCheck(bytes.length));
            for (i = 0; i < bytes.length; ++i) {
              this.iterator.writeValue(bytes[i], UINT8, true);
            }
          } else if (Buffer$isBuffer(val)) {
            this.iterator.writeValue(val.length, typeCheck(val.length));
            for (i = 0; i < val.length; ++i) {
              this.iterator.writeValue(val[i], UINT8, false);
            }
          } else if (typeof val === 'string') {
            this.writeString(val);
          }
        };
      } else {
        if (HAS_TYPED_ARRAYS) {
          toBuffer = function toBuffer() {
            return this.iterator.buffer.buffer;
          };
          writeBuffer = function writeBuffer(val) {
            var bytes;
            if (val instanceof $ArrayBuffer) {
              bytes = new $Uint8Array(val);
              this.iterator.writeValue(bytes.length, typeCheck(bytes.length), true);
              for (i = 0; i < bytes.length; ++i) {
                this.iterator.writeUInt8(bytes[i]);
              }
            } else if (typeof val === 'string') {
              this.iterator.writeStringASCII(val);
            }
          };
        } else {
          toBuffer = function toBuffer() {
            return fastBytesToStr(this.buffer.uchars);
          };
          writeBuffer = function writeBuffer(val) {
            this.iterator.writeStringASCII(val);
          }
        }
      }
      function writeData () {
        this.iterator.writeValue(this.payload, this.spec);
        return this;
      }
      return function () {
        this.writeData = writeData;
        this.writeBuffer = writeBuffer;
        this.toBuffer = toBuffer;
      }
    })();
    function $Encoder(obj, spec) {
      if (!(this instanceof $Encoder)) return new $Encoder(obj, spec);
      this.payload = obj;
      this.iterator = BufferIterator();
      this.spec = spec;
      this.state = 0;
      $$EncoderMixin.call(this);
    }
    function flagsConv(flags) {
      switch (typeof flags) {
        case 'string':
        case 'undefined':
          var ret = 0;
          if (~flags.indexOf('i')) ret |= 0x01;
          if (~flags.indexOf('g')) ret |= 0x02;
          if (~flags.indexOf('m')) ret |= 0x04;
          return ret;
        case 'number':
          var ret = '';
          if (flags & 0x01) ret += 'i';
          if (flags & 0x02) ret += 'g';
          if (flags & 0x04) ret += 'm';
          return ret;
      }
    }
    function regexpToParts (regex) {
      regex = regex.toString();
      return [regex.substr(1, regex.lastIndexOf('/') - 1), regex.substr(regex.lastIndexOf('/') + 1)];
    }
    function typeGcd(arr) {
      var type = typeCheck(arr[0]);
      switch (type) {
        case UINT8:
        case INT8:
        case UINT16:
        case INT16:
        case UINT32:
        case INT32:
        case FLOAT:
        case DOUBLE:
          var highestMagnitude = Math.abs(arr[0]),
              fp = (arr[0] % 1 !== 0),
              sign = (arr[0] < 0 ? 1 : 0);
          for (var i = 1; i < arr.length; ++i) {
            if (typeof arr[i] !== 'number') return DYNAMIC;
            if (Math.abs(arr[i]) > highestMagnitude) {
              highestMagnitude = Math.abs(arr[i]);
            }
            if (arr[i] % 1 !== 0) {
              fp = true;
            }
            if (arr[i] < 0) {
              sign = 1;
            }
          }
          return typeCheck((sign ? -1: 1)*highestMagnitude, fp);
        case ARRAY:
          return [ typeGcd(Array$reduce(arr, function (r, v) {
            return r.concat(v);
          }, [])) ];
        case OBJECT:
          var ret = {};
          Array$forEach(Object$getOwnPropertyNames(arr[0]), function (v) {
            ret[v] = typeGcd(pluck(arr, v));
          });
          return ret;
        default:
          if (type === FALSE) type = TRUE;
          var thisType;
          for (var i = 1; i < arr.length; ++i) {
            thisType = typeCheck(arr[i]);
            if (thisType === FALSE) thisType = TRUE;
            if (thisType !== type) {
              return DYNAMIC;
            }
          }
          return type;
      }
    }
    function pluck(arr, prop) {
      var ret = [];
      for (var i = 0; i < arr.length; ++i) {
        if (typeof arr[i] !== 'object') throw Error('Received a non-object value when an object was expected.');
        if (typeof arr[i][prop] === 'undefined') throw Error('Object ' + JSON.stringify(arr[i]) + ' has no property ' + $String(prop) + '.');
        ret.push(arr[i][prop]);
      }
      return ret;
    }
    function toTemplate(val) {
      var type = typeCheck(val);
      switch (type) {
        case ARRAY:
          return [typeGcd(val)];
        case OBJECT:
          var ret = {};
          Array$forEach(Object$getOwnPropertyNames(val), function (v) {
            ret[v] = toTemplate(val[v]);
          });
          return ret;
        case FALSE:
          return TRUE;
        default:
          return type;
      }
    }
    function decode(buf, flags) {
      return BufferIterator(buf).readValue();
    }
    function encode(val, flags) {
      return $Encoder(val).writeData().toBuffer();
    }
    function isQuotedKey(str) {
      if (/^[0-9]/.test(str) || /[^\w_]/.test(str)) return true;
      return false;
    }
    function inObject(obj, val) {
      for (var i = 0, keys = Object$getOwnPropertyNames(obj); i < keys.length; ++i) {
        if (obj[keys[i]] === val) return true;
      }
      return false;
    }
    function validateSpec(spec, path) {
      var specialCharacters;
      if (typeof path === 'undefined') path = '{Template}';
      switch (typeof spec) {
        case 'number':
          if (!inObject(types, spec)) throw Error(path + ' is not a valid type constant.');
          break;
        case 'function': 
          throw Error(path + ' is a function.');
          break;
        case 'boolean':
          throw Error(path + ' is a boolean.');
          break;
        case 'undefined':
          throw Error(path + ' is undefined. Did you misspell a type constant?');
          break;
        case 'string':
          throw Error(path + ' is a string.');
          break;
        case 'object':
          if (spec instanceof Channel) break;
          if (toString.call(spec) === '[object Date]') throw Error(path + ' is a Date object. Did you mean to supply LEON.DATE?');
          if (toString.call(spec) === '[object RegExp]') throw Error(path + ' is a RegExp. Did you mean to supply LEON.REGEXP?');
          if (Array$isArray(spec)) {
            if (spec.length === 0) throw Error(path + ' is an array with no elements, must contain at least one.');
            for (var i = 0; i < spec.length; ++i) {
              validateSpec(spec[i], path + '[' + String(i) + ']');
            }
          } else {
            for (var i = 0, keys = Object$getOwnPropertyNames(spec); i < keys.length; ++i) {
              specialCharacters = isQuotedKey(spec);
              validateSpec(spec[keys[i]], path + (specialCharacters ? '[\'' + keys[i] + '\']' : '.' + keys[i]));
            }
          }
          break;
      }
    }      
    function Channel(spec) {
      if (!(this instanceof Channel)) return new Channel(spec);
      validateSpec(spec);
      this.spec = spec;
      this.sorted = (function sort (spec) {
        if (typeof spec === 'object') {
          if (spec instanceof Channel) return spec.sorted;
          if (Array$isArray(spec)) return spec.map(sort);
          var ret = [];
          var keys = Object$getOwnPropertyNames(spec);
          keys.sort(function (a, b) { return a > b; });
          for (var i = 0; i < keys.length; ++i) {
            ret.push({
              key: keys[i],
              type: sort(spec[keys[i]])
            });
          }
          ret.object = true;
          return ret;
        }
        return spec;
      })(spec);
    }
    function strmul(str, n) {
      var ret = '';
      for (var i = 0; i < n; ++i) {
        ret += str;
      }
      return ret;
    }
    function quoteIfNeeded (str, colors) {
      if (isQuotedKey(str)) return (colors ? '\u001b[32m' : '') + '\'' + str + '\'' + (colors ? '\u001b[m' : '');
      return str;
    }
    Channel.prototype = {
      inspect: function (j, data, branch, depth, init, multiline) {
        var ret = '', first = false;
        if (typeof data === 'undefined') data = { colors: false };
        if (typeof multiline === 'undefined') multiline = {};
        if (typeof init === 'undefined') {
          ret += '{[Channel] ';
          init = false;
          first = true;
        }
        var keys, i;
        if (typeof branch === 'undefined') {
          depth = 0;
          branch = this.spec;
        }
        if (typeof branch === 'object') {
          if (Array$isArray(branch)) {
            ret += '[' + this.inspect(j, data, branch[0], depth, init, multiline) + ']';
          } else {
            multiline.flag = true;
            ret += '{\n';
            for (keys = Object$getOwnPropertyNames(branch), i = 0; i < keys.length; ++i) {
              ret += strmul('  ', depth + 1) + quoteIfNeeded(keys[i], data.colors) + ': ' + this.inspect(j, data, branch[keys[i]], depth + 1, init, multiline) + (keys.length - 1 === i ? '' : ',') + '\n';
            }
            ret += strmul('  ', depth) + '}';
          }
        } else {
          ret += typeToStr(branch);
        }
        if (first) ret += '}';
        return ret;
      },
      encode: function encode (val) {
        return $Encoder(val, this.sorted).writeData().toBuffer();
      },
      decode: function (buf) {
        return BufferIterator(buf).readValue(this);
      }
    }
    var LEON = {};
    assignTo(LEON)(types);
    LEON.decode = decode;
    LEON.encode = encode;
    LEON.toTemplate = toTemplate;
    LEON.BufferIterator = BufferIterator;
    LEON.Channel = Channel;
    LEON.Rational = Rational;
    LEON.Complex = Complex;
    LEON.Symbol = $Symbol;
    LEON.defineType = defineType;
    LEON.noConflict = function noConflict () {
      return previousLEON;
    };
    return LEON;
  })();
})
