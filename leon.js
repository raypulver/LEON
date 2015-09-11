;(function () {
  "use strict";

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
      previous_LEON = root.LEON,
  // define the constants here so we know where to find them
      ARRAY_BUFFER_DEFAULT_ALLOC = 0x10000,
      SIGNED = 0x01,
      CHAR = 0x00,
      SHORT = 0x02,
      INT = 0x04,
      FLOAT = 0x06,
      DOUBLE = 0x07,
      SIGNED_SHORT = 0x03,
      SIGNED_INT = 0x05,
      VARARRAY = 0x80,
      OBJECT = 0x09,
      STRING = 0x10,
      UTF16STRING = 0x11,
      TRUE = 0x20,
      FALSE = 0x21,
      NULL = 0x40,
      UNDEFINED = 0x14,
      DATE = 0x15,
      BUFFER = 0x16,
      REGEXP = 0x17,
      NAN = 0x18,
      INFINITY = 0x19,
      MINUS_INFINITY = 0x1A,
      DYNAMIC = 0xDD,
      EMPTY = 0xFF,
  // need a few shims before we do anything
      Object$prototype = $Object.prototype,
      $String = String,
      String$fromCharCode = String.fromCharCode,
      toString = root.toString || Object$prototype.toString,
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
        CHAR: (SIGNED | CHAR),
        UNSIGNED_CHAR: CHAR,
        SHORT: (SIGNED | SHORT),
        UNSIGNED_SHORT: SHORT,
        INT: (SIGNED | INT),
        UNSIGNED_INT: INT,
        FLOAT: FLOAT,
        DOUBLE: DOUBLE,
        STRING: STRING,
        UTF16STRING: UTF16STRING,
        BOOLEAN: (TRUE & FALSE),
        NULL: NULL,
        UNDEFINED: UNDEFINED,
        DATE: DATE,
        NAN: NAN,
        BUFFER: BUFFER,
        REGEXP: REGEXP,
        MINUS_INFINITY: MINUS_INFINITY,
        INFINITY: INFINITY,
        DYNAMIC: DYNAMIC
      }),
      IS_NODE, NATIVE_LITTLE_ENDIAN, HAS_TYPED_ARRAYS;

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
      // we just need to know there's a $Buffer
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
  // error message helper
  function typeToStr(type) {
    for (var keys = Object$keys(types), i = 0; i < keys.length; ++i) {
      if (types[keys[i]] === type) return keys[i];
    }
    throw TypeError($String(type) + ' is not a valid type.');
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
  var LEON = (function () {
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
          writeDoubleLE,
          writeUInt8,
          writeUInt16LE,
          writeUInt32LE,
          readInt8,
          readFloatLE,
          readDoubleLE,
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
        writeUInt32LE = function writeUInt32LE (val, offset) {
          if (offset >= this.buffer.byteLength - 3) this._realloc();
          this.uchars[offset] = val & 0xFF;
          this.uchars[offset + 1] = (val >>> 8) & 0xFF;
          this.uchars[offset + 2] = (val >>> 16) & 0xFF;
          this.uchars[offset + 3] = val >>> 24;
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
          writeDoubleLE = function writeDoubleLE (val, offset) {
            if (offset >= this.buffer.byteLength - 7) this._realloc();
            double[0] = val;
            this.uchars.set(bytes64, offset);
            return this;
          };
          readFloatLE = function readFloatLE (offset) {
            bytes32[0] = this.uchars[offset];
            bytes32[1] = this.uchars[offset + 1];
            bytes32[2] = this.uchars[offset + 2];
            bytes32[3] = this.uchars[offset + 3];
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
          readFloatLE = function readFloatLE (offset) {
            bytes32[0] = this.uchars[offset + 3];
            bytes32[1] = this.uchars[offset + 2];
            bytes32[2] = this.uchars[offset + 1];
            bytes32[3] = this.uchars[offset];
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
        writeUInt32LE = function writeUInt32LE (val, offset) {
          if (offset >= this.uchars.length - 3) this._realloc();
          this.uchars[offset] = val & 0xFF;
          this.uchars[offset + 1] = (val >>> 8) & 0xFF;
          this.uchars[offset + 2] = (val >>> 16) & 0xFF;
          this.uchars[offset + 3] = val >>> 24;
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
      }
      function writeInt16LE (val, offset) {
        if (val < 0) val = complement(-val, 16);
        return this.writeUInt16LE(val, offset);
      }
      function writeInt32LE (val, offset) {
        if (val < 0) val = complement(-val, 32);
        return this.writeUInt32LE(val, offset);
      }
      function readUInt8 (offset) {
        return this.uchars[offset];
      }
      function readUInt16LE (offset) {
        return (this.uchars[offset + 1] << 8) | this.uchars[offset];
      }
      function readInt16LE (offset) {
        var ret = this.readUInt16LE(offset);
        if (ret & 0x8000) return -complement(ret, 16);
        return ret;
      }
      function readUInt32LE (offset) {
        return (this.uchars[offset + 3] << 24) | (this.uchars[offset + 2] << 16) | (this.uchars[offset + 1] << 8) | this.uchars[offset];
      }
      function readInt32LE (offset) {
        var ret = this.readUInt32LE(offset);
        if (ret < 0) return ret;
        if (ret & 0x80000000) return -complement(ret, 32);
        return ret;
      }
      return function () {
        this.writeUInt8 = writeUInt8;
        this.writeInt8 = writeInt8;
        this.writeUInt16LE = writeUInt16LE;
        this.writeInt16LE = writeInt16LE;
        this.writeUInt32LE = writeUInt32LE;
        this.writeInt32LE = writeInt32LE;
        this.writeFloatLE = writeFloatLE;
        this.writeDoubleLE = writeDoubleLE;
        this.readUInt8 = readUInt8;
        this.readInt8 = readInt8;
        this.readUInt16LE = readUInt16LE;
        this.readInt16LE = readInt16LE;
        this.readUInt32LE = readUInt32LE;
        this.readInt32LE = readInt32LE;
        this.readFloatLE = readFloatLE;
        this.readDoubleLE = readDoubleLE;
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
    var $$IteratorMixin = (function () {
      // this mixin just lets us read over the bytes of a buffer wthout keeping track of where we are.
      function readUInt8 () {
        this.i++;
        return this.buffer.readUInt8(this.i - 1);
      }
      function readInt8 () {
        this.i++;
        return this.buffer.readInt8(this.i - 1);
      }
      function readUInt16 () {
        this.i += 2;
        return this.buffer.readUInt16LE(this.i - 2);
      }
      function readInt16 () {
        this.i += 2;
        return this.buffer.readInt16LE(this.i - 2);
      }
      function readUInt32 () {
        this.i += 4;
        return this.buffer.readUInt32LE(this.i - 4);
      }
      function readInt32 () {
        this.i += 4;
        return this.buffer.readInt32LE(this.i - 4);
      }
      function readFloat () {
        this.i += 4;
        return this.buffer.readFloatLE(this.i - 4);
      }
      function readDouble () {
        this.i += 8;
        return this.buffer.readDoubleLE(this.i - 8);
      }
      function readValue (type) {
        if (type === CHAR) {
          return this.readUInt8();
        } else if (type === (CHAR | SIGNED)) {
          return this.readInt8();
        } else if (type === SHORT) {
          return this.readUInt16();
        } else if (type === (SHORT | SIGNED)) {
          return this.readInt16();
        } else if (type === INT) {
          return this.readUInt32();
        } else if (type === (INT | SIGNED)) {
          return this.readInt32();
        } else if (type === FLOAT) {
          return this.readFloat();
        } else if (type === DOUBLE) {
          return this.readDouble();
        }
      }
      return function () {
        this.readUInt8 = readUInt8;
        this.readInt8 = readInt8;
        this.readUInt16 = readUInt16;
        this.readInt16 = readInt16;
        this.readUInt32 = readUInt32;
        this.readInt32 = readInt32;
        this.readFloat = readFloat;
        this.readDouble = readDouble;
        this.readValue = readValue;
      }
    })();
    function $$BufferIterator(buffer) {
      if (!(this instanceof $$BufferIterator)) return new $$BufferIterator(buffer);
      this.buffer = buffer;
      this.i = 0;
      $$IteratorMixin.call(this);
    }
    var $$ParserMixin = (function () {
      function readString (utf16) {
        var ret = '', lenType = this.buffer.readUInt8(), length = this.buffer.readValue(lenType), i = 0;
        if (utf16) {
          while (i < length) {
            ret += String$fromCharCode(this.buffer.readUInt16());
            ++i;
          }
          return ret;
        }
        while (i < length) {
          ret += String$fromCharCode(this.buffer.readUInt8());
          ++i;
        }
        return ret;
      }
      function parseValueWithSpec (spec) {
        var ret, i, length, keys, type;
        if (typeof spec === 'undefined') spec = this.spec;
        if (spec === STRING) {
          ret = this.readString();
          return ret;
        } else if (spec === UTF16STRING) {
          ret = this.readString(true);
          return ret;
        } else if (spec === DYNAMIC) {
          return this.parseValue();
        } else if (typeof spec === 'object') {
          if (Array$isArray(spec)) {
            if (spec.length === 0) return this.parseValue(VARARRAY);
            if (spec.object) {
              ret = {};
              for (i = 0; i < spec.length; i += 2) {
                ret[spec[i]] = this.parseValueWithSpec(spec[i + 1]);
              }
              return ret;
            } else {
              spec = spec[0];
              type = this.buffer.readUInt8();
              length = this.buffer.readValue(type);
              ret = new $Array(length);
              for (i = 0; i < length; ++i) {
                ret[i] = this.parseValueWithSpec(spec);
              }
              return ret;
            }
          }
        } else if (spec === (TRUE & FALSE)) {
          return this.parseValue();
        } else {
          return this.parseValue(spec);
        }
      }
      function parseValue (type) {
        if (typeof type === 'undefined') type = this.buffer.readUInt8();
        var length, i, ret, index, stamp, key;
        if (type < OBJECT) {
          return this.buffer.readValue(type);
        } else {
          switch (type) {
            case VARARRAY:
              type = this.buffer.readUInt8();
              length = this.buffer.readValue(type);
              ret = new $Array(length);
              for (i = 0; i < length; ++i) {
                ret[i] = this.parseValue();
              }
              return ret;
            case OBJECT:
              ret = {};
              length = this.buffer.readValue(this.buffer.readUInt8());
              for (i = 0; i < length; ++i) {
                key = this.readString();
                ret[key] = this.parseValue();
              }
              break;
            case STRING:
              return this.readString();
            case UTF16STRING:
              return this.readString(true);
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
              return new Date(this.buffer.readValue(DOUBLE));
            case BUFFER:
              length = this.buffer.readValue(this.buffer.readUInt8());
              if (IS_NODE) {
                ret = new $Buffer(length);
                for (i = 0; i < length; ++i) {
                  ret[i] = this.buffer.readUInt8();
                }
              } else {
                ret = new $ArrayBuffer(length);
                var bytes = new $Uint8Array(ret);
                for (i = 0; i < length; ++i) {
                  bytes[i] = this.buffer.readUInt8();
                }
              }
              return ret;
            case REGEXP:
              return RegExp(this.readString(), this.readString());
            default:
              throw Error('Invalid LEON.');
          }
        }
        return ret;
      }
      return function () {
        this.parseValue = parseValue;
        this.parseValueWithSpec = parseValueWithSpec;
        this.readString = readString;
      }
    })();
    function $Parser(buffer, spec) {
      if (!(this instanceof $Parser)) return new $Parser(buffer, spec);
      this.buffer = $$BufferIterator(buffer);
      this.state = 0;
      this.spec = spec;
      $$ParserMixin.call(this);
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
      var type = typeof val, asStr;
      switch (type) {
        case 'object':
          if (val === null) return NULL;
          if (Array$isArray(val)) return VARARRAY;
          asStr = toString.call(val);
          switch (asStr) {
            case '[object Date]':
              return DATE;
            case '[object RegExp]':
              return REGEXP;
            default:
              if (bufferCheck(val)) return BUFFER;
              return OBJECT;
          }
        case 'boolean':
          return val ? TRUE : FALSE;
        case 'string':
          for (var i = 0; i < val.length; ++i) {
            if (val.charCodeAt(i) > 255) return UTF16STRING;
          }
          return STRING;
        case 'number':
          if (val !== val) return NAN;
          if (val === Number.NEGATIVE_INFINITY) return MINUS_INFINITY;
          if (val === Number.POSITIVE_INFINITY) return INFINITY;
          if (val % 1 || isFloat) {
            return fpCheck(val);
          }
          if (val < 0) {
            if (Math.abs(val) <= 1 << 7) return SIGNED | CHAR;
            if (Math.abs(val) <= 1 << 15) return SIGNED | SHORT;
            if (Math.abs(val) <= Math.pow(2, 31)) return SIGNED | INT;
            return DOUBLE;
          }
          if (val < 1 << 8) return CHAR;
          if (val < 1 << 16) return SHORT;
          if (val < Math.pow(2, 32)) return INT;
          return DOUBLE;
        case 'undefined':
        case 'function':
          return UNDEFINED;
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
          var ret = new $Buffer(this.i);
          for (var i = 0; i < this.i; ++i) {
            ret[i] = this.buffer.uchars[i];
          }
          return ret;
        };
        writeBuffer = function (val) {
          var bytes, i;
          if (val instanceof $ArrayBuffer) {
            bytes = new $Uint8Array(val);
            this.writeValue(bytes.length, typeCheck(bytes.length));
            for (i = 0; i < bytes.length; ++i) {
              this.writeValue(bytes[i], CHAR, true);
            }
          } else if (Buffer$isBuffer(val)) {
            this.writeValue(val.length, typeCheck(val.length));
            for (i = 0; i < val.length; ++i) {
              this.writeValue(val[i], CHAR, true);
            }
          } else if (typeof val === 'string') {
            this.writeString(val);
          }
        };
      } else {
        if (HAS_TYPED_ARRAYS) {
          toBuffer = function toBuffer() {
            return this.buffer.buffer;
          };
          writeBuffer = function writeBuffer(val) {
            var bytes;
            if (val instanceof $ArrayBuffer) {
              bytes = new $Uint8Array(val);
              this.writeValue(bytes.length, typeCheck(bytes.length));
              for (i = 0; i < bytes.length; ++i) {
                this.writeValue(bytes[i], CHAR, true);
              }
            } else if (typeof val === 'string') {
              this.writeString(val);
            }
          };
        } else {
          toBuffer = function toBuffer() {
            return fastBytesToStr(this.buffer.uchars);
          };
          writeBuffer = function writeBuffer(val) {
            this.writeString(val);
          }
        }
      }
      function writeData () {
        if (typeof this.spec !== 'undefined') this.writeValueWithSpec(this.payload);
        else this.writeValue(this.payload, typeCheck(this.payload));
        return this;
      }
      function writeValueWithSpec (val, spec) {
        var keys, i, type = typeof val;
        if (spec === void 0) spec = this.spec;
        if (typeof spec === 'object') {
          if (!spec.object) {
            if (!Array$isArray(val)) throw TypeError('Was expecting an array but instead got a ' + type + '.');
            this.writeValue(val.length, typeCheck(val.length));
            for (i = 0; i < val.length; ++i) {
              this.writeValueWithSpec(val[i], spec[0]);
            }
          } else {
            if (type !== 'object') throw TypeError('Was expecting an object but instead got a ' + type + '.');
            for (i = 0; i < spec.length; i += 2) {
              this.writeValueWithSpec(val[spec[i]], spec[i + 1]);
            }
          }
          return;
        } else if (spec === DYNAMIC) {
          this.writeValue(val, typeCheck(val));
        } else if (spec === (TRUE & FALSE)) {
          this.writeValue(val, typeCheck(val), true);
        } else {
          this.writeValue(val, spec, true);
        }
      }
      function appendUInt8 (val) {
        this.buffer.writeUInt8(val, this.i);
        this.i++;
        return this;
      }
      function writeValue (val, type, implicit) {
        var i, tmp, index, parts;
        switch (type) {
          case UNDEFINED:
          case TRUE:
          case FALSE:
          case NULL:
          case NAN:
          case MINUS_INFINITY:
          case INFINITY:
            this.appendUInt8(type);
            return 1;
          case UTF16STRING:
            if (!implicit) this.appendUInt8(type);
            this.writeString(val, true);
            return;
          case STRING:
            if (!implicit) this.appendUInt8(type);
            this.writeString(val);
            return;
          case SIGNED:
            if (!implicit) this.appendUInt8(type);
            this.buffer.writeInt8(val, this.i);
            this.i++;
            return 2;
          case CHAR:
            if (!implicit) this.appendUInt8(type);
            this.buffer.writeUInt8(val, this.i);
            this.i++;
            return 2;
          case SIGNED_SHORT:
            if (!implicit) this.appendUInt8(type);
            this.buffer.writeInt16LE(val, this.i);
            this.i += 2;
            return 3;
          case SHORT:
            if (!implicit) this.appendUInt8(type);
            this.buffer.writeUInt16LE(val, this.i);
            this.i += 2;
            return 3;
          case SIGNED_INT:
            if (!implicit) this.appendUInt8(type);
            this.buffer.writeInt32LE(val, this.i);
            this.i += 4;
            return 5;
          case INT:
            if (!implicit) this.appendUInt8(type);
            this.buffer.writeUInt32LE(val, this.i);
            this.i += 4;
            return 5;
          case FLOAT:
            if (!implicit) this.appendUInt8(type);
            this.buffer.writeFloatLE(val, this.i);
            this.i += 4;
            return 5;
          case DOUBLE:
            if (!implicit) this.appendUInt8(type);
            this.buffer.writeDoubleLE(val, this.i);
            this.i += 8;
            return 9;
          case VARARRAY:
            if (!implicit) this.appendUInt8(type);
            this.writeValue(val.length, typeCheck(val.length));
            for (i = 0; i < val.length; ++i) {
              this.writeValue(val[i], typeCheck(val[i]));
            }
            break;
          case OBJECT:
            if (!implicit) this.appendUInt8(type);
            index = Object$keys(val);
            this.writeValue(index.length, typeCheck(index.length));
            for (i = 0; i < index.length; ++i) {
              this.writeString(index[i]);
              this.writeValue(val[index[i]], typeCheck(val[index[i]]));
            }
            break;
          case DATE:
            if (!implicit) this.appendUInt8(type);
            this.writeValue(val.valueOf(), DOUBLE, true);
            break;
          case BUFFER:
            if (!implicit) this.appendUInt8(type);
            this.writeBuffer(val);
            break;
          case REGEXP:
            if (!implicit) this.appendUInt8(type);
            parts = regexpToParts(val);
            this.writeString(parts[0]);
            this.writeString(parts[1]);
            return Array$reduce(parts, function (r, v) {
              return r + v.length + 1;
            }, 0);
        }
      }
      function writeString (str, utf16) {
        this.writeValue(str.length, typeCheck(str.length));
        if (utf16) {
          for (var i = 0; i < str.length; ++i) {
            this.writeValue(str.charCodeAt(i), SHORT, true);
          }
          return;
        }
        for (var i = 0; i < str.length; ++i) {
          this.appendUInt8(str.charCodeAt(i));
        }
        return;
      }
      return function () {
        this.writeData = writeData;
        this.writeBuffer = writeBuffer;
        this.toBuffer = toBuffer;
        this.writeValueWithSpec = writeValueWithSpec; 
        this.writeValue = writeValue;
        this.appendUInt8 = appendUInt8;
        this.writeString = writeString;
      }
    })();
    function $Encoder(obj, spec) {
      if (!(this instanceof $Encoder)) return new $Encoder(obj, spec);
      this.payload = obj;
      this.buffer = $SmartArrayBuffer();
      this.spec = spec;
      this.state = 0;
      this.i = 0;
      $$EncoderMixin.call(this);
    }
    function regexpToParts (regex) {
      regex = regex.toString();
      return [regex.substr(1, regex.lastIndexOf('/') - 1), regex.substr(regex.lastIndexOf('/') + 1)];
    }
    function typeGcd(arr) {
      var type = typeCheck(arr[0]);
      switch (type) {
        case CHAR:
        case SIGNED:
        case SHORT:
        case SIGNED_SHORT:
        case INT:
        case SIGNED_INT:
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
        case VARARRAY:
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
        case VARARRAY:
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
      return $Parser($SmartArrayBuffer(buf)).parseValue();
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
          if (toString.call(spec) === '[object Date]') throw Error(path + ' is a Date object. Did you mean to supply LEON.DATE?');
          if (toString.call(spec) === '[object RegExp]') throw Error(path + ' is a RegExp. Did you mean to supply LEON.REGEXP?');
          if (Array$isArray(spec)) {
            if (spec.length === 0) throw Error(path + ' is an array with no elements, must have one.');
            if (spec.length > 1) throw Error(path + ' is an array with more than one element. If you want to serialize an array of various types you must use LEON.DYNAMIC.');
            validateSpec(spec[0], path + '[0]');
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
          if (Array$isArray(spec)) {
            var ret = [];
            ret.push(sort(spec[0]));
            return ret;
          }
          var ret = [];
          var keys = Object$getOwnPropertyNames(spec);
          keys.sort(function (a, b) { return a > b; });
          for (var i = 0; i < keys.length; ++i) {
            ret.push(keys[i]);
            ret.push(sort(spec[keys[i]]));
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
        if (typeof branch === 'undefined') depth = 0;
        if (typeof branch === 'undefined') branch = this.spec;
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
        return $Parser($SmartArrayBuffer(buf), this.sorted).parseValueWithSpec();
      }
    }
    var LEON = {};
    assignTo(LEON)(types);
    LEON.decode = decode;
    LEON.encode = encode;
    LEON.toTemplate = toTemplate;
    LEON.Channel = Channel;
    LEON.noConflict = function noConflict () {
      return previous_LEON;
    };
    return LEON;
  })();
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = LEON;
    }
  } else {
    root.LEON = LEON;
  }
}).call(this);
