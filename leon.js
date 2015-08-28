"use strict";
;;(function () {
  var root = this,
      previous_LEON = root.LEON;
  var ARRAY_BUFFER_DEFAULT_ALLOC = 0x10000;
  var PARSED_SI = 0x01, PARSED_OLI = 0x02;
  var SIGNED = 0x01,
      CHAR = 0x00,
      SHORT = 0x02,
      INT = 0x04,
      FLOAT = 0x06,
      DOUBLE = 0x07;
  var SIGNED_SHORT = 0x03,
      SIGNED_INT = 0x05;
  var VARARRAY = 0x80,
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
      EMPTY = 0xFF;

  var USE_INDEXING = 0x1;

  function $Hash(obj) {
    var ret = Object.create(null);
    Object.keys(obj).forEach(function (v) {
      ret[v] = obj[v];
    });
    return ret;
  }
  var flags = $Hash({
    USE_INDEXING: USE_INDEXING
  });

  var types = $Hash({
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
  });

  var IS_NODE = (function () {
    try {
      new Buffer(4);
      return true;
    } catch (e) {
      return false;
    }
  }).call(root);

  var NATIVE_LITTLE_ENDIAN = (function () {
    var tmp = new ArrayBuffer(2);
    var ubytes = new Uint8Array(tmp);
    var ushort = new Uint16Array(tmp);
    ushort[0] = 1;
    return !!ubytes[0];
  })();

  // returns true for little endian

  var DEFAULT_DATAVIEW_ENDIANNESS = (function () {
    var tmp = new ArrayBuffer(2);
    var view = new DataView(tmp);
    view.setUint16(0, 0x102);
    return view.getUint8(0) === 2;
  })();

  var NATIVE_ENDIANNESS_CONVERSION = (function () {
    var tmp = new ArrayBuffer(2);
    var view = new DataView(tmp);
    view.setUint8(0, 1);
    view.setUint8(1, 2);
    if (view.getUint16(0, true) !== 0x201) return false;
    if (view.getUint16(0, false) !== 0x102) return false;
    view.setUint16(0, 0x102, true);
    if (view.getUint8(0) !== 2) return false;
    if (view.getUint8(1) !== 1) return false;
    return true;
  })();

  // make a couple "unions"
  var buf32 = new ArrayBuffer(4),
      bytes32 = new Uint8Array(buf32),
      float = new Float32Array(buf32),
      buf64 = new ArrayBuffer(8),
      bytes64 = new Uint8Array(buf64),
      double = new Float64Array(buf64);

  function typeToStr(type) {
    for (var keys = Object.getOwnPropertyNames(types), i = 0; i < keys.length; ++i) {
      if (types[keys[i]] === type) return keys[i];
    }
    throw TypeError(String(type) + ' is not a valid type.');
  }
  function assignTo (obj, props) {
    if (typeof props === 'undefined') {
      if (typeof obj !== 'object') throw TypeError('Argument must be an object');
      return assignTo.bind(this, obj);
    }
    if (typeof props !== 'object') throw TypeError('Argument must be an object');
    Object.keys(props).forEach(function (v) {
      this[v] = props[v];
    }, obj);
    return assignTo.bind(this, obj);
  }
  function complement(v, bits) {
    if (bits >= 32) return -v;
    return (((1 << bits) - 1) ^ v) + 1;
  }
  var LEON = (function () {
    var $$ReallocMixin = (function () {
      function realloc (size) {
        if (typeof size === 'undefined') size = this.buffer.byteLength << 1;
        var tmp = this.buffer;
        this.buffer = new ArrayBuffer(size);
        var bytes = new Uint8Array(tmp);
        var newBytes = new Uint8Array(this.buffer);
        newBytes.set(bytes, 0);
        this.uchars = new Uint8Array(this.buffer);
        this.chars = new Int8Array(this.buffer);
        return this;
      }
      return function () {
        this._realloc = realloc;
      }
    })();
    var $$BufferMixin = (function () {
      function writeUInt8 (val, offset) {
        if (offset >= this.buffer.byteLength) this._realloc();
        this.uchars[offset] = val;
        return this; 
      }
      function writeInt8 (val, offset) {
        if (offset >= this.buffer.byteLength) this._realloc();
        this.chars[offset] = val;
        return this;
      }
      function writeUInt16LE (val, offset) {
        if (offset >= this.buffer.byteLength - 1) this._realloc();
        this.uchars[offset] = val & 0xFF;
        this.uchars[offset + 1] = val >>> 8;
        return this;
      }
      function writeInt16LE (val, offset) {
        if (val < 0) val = complement(-val, 16);
        return this.writeUInt16LE(val, offset);
      }
      function writeUInt32LE (val, offset) {
        if (offset >= this.buffer.byteLength - 3) this._realloc();
        this.uchars[offset] = val & 0xFF;
        this.uchars[offset + 1] = (val >>> 8) & 0xFF;
        this.uchars[offset + 2] = (val >>> 16) & 0xFF;
        this.uchars[offset + 3] = val >>> 24;
        return this;
      }
      function writeInt32LE (val, offset) {
        if (val < 0) val = complement(-val, 32);
        return this.writeUInt32LE(val, offset);
      }
      function writeFloatLE (val, offset) {
        if (offset >= this.buffer.byteLength - 3) this._realloc();
        float[0] = val;
        if (NATIVE_LITTLE_ENDIAN) {
          this.uchars.set(bytes32, offset);
          return this;
        }
        for (var i = bytes32.length - 1; i >= 0; --i) {
          this.uchars[offset + (bytes32.length - 1 - i)] = bytes32[i];
        }
        return this;
      }
      function writeDoubleLE (val, offset) {
        if (offset >= this.buffer.byteLength - 7) this._realloc();
        double[0] = val;
        if (NATIVE_LITTLE_ENDIAN) {
          this.uchars.set(bytes64, offset);
          return this;
        }
        for (var i = bytes64.length - 1; i >= 0; --i) {
          this.uchars[offset + (bytes64.length - 1 - i)] = bytes64[i];
        }
        return this;
      }
      function readUInt8 (offset) {
        return this.uchars[offset];
      }
      function readInt8 (offset) {
        return this.chars[offset];
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
      function readFloatLE (offset) {
        if (NATIVE_LITTLE_ENDIAN) {
          for (var i = 0; i < bytes32.length; ++i) {
            bytes32[i] = this.uchars[offset + i];
          }
          return float[0];
        }
        for (var i = bytes32.length - 1; i >= 0; --i) {
          bytes32[bytes32.length - 1 - i] = this.uchars[offset + i];
        }
        return float[0];
      }
      function readDoubleLE (offset) {
        if (NATIVE_LITTLE_ENDIAN) {
          for (var i = 0; i < bytes64.length; ++i) {
            bytes64[i] = this.uchars[offset + i];
          }
          return double[0];
        }
        for (var i = bytes64.length - 1; i >= 0; --i) {
          bytes64[bytes64.length - 1 - i] = this.uchars[offset + i];
        }
        return double[0];
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
    function $SmartArrayBuffer(length) {
      if (!(this instanceof $SmartArrayBuffer)) return new $SmartArrayBuffer(length);
      if (typeof length === 'undefined') length = ARRAY_BUFFER_DEFAULT_ALLOC;
      if (length instanceof ArrayBuffer) this.buffer = length;
      else if (IS_NODE && Buffer.isBuffer(length)) {
        var tmp = length;
        length = new ArrayBuffer(tmp.length);
        var bytes = new Uint8Array(length);
        for (var i = 0; i < tmp.length; ++i) {
          bytes[i] = tmp[i];
        }
        this.buffer = length;
      } else this.buffer = new ArrayBuffer(length);
      this.uchars = new Uint8Array(this.buffer);
      this.chars = new Int8Array(this.buffer);
      $$BufferMixin.call(this);
      $$ReallocMixin.call(this);
    }
    $SmartArrayBuffer.concat = function (arr) {
      return $StringBuffer(arr.reduce(function (r, v) {
        var ret = new Uint8Array(r.buffer.byteLength + v.buffer.byteLength);
        ret.set(new Uint8Array(r.buffer), 0);
        ret.set(new Uint8Array(v.buffer), r.buffer.byteLength);
        return ret.buffer;
      }, new $SmartArrayBuffer(new ArrayBuffer(0))));
    };
    var $$IteratorMixin = (function () {
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
    function $BufferIterator(buffer) {
      if (!(this instanceof $BufferIterator)) return new $BufferIterator(buffer);
      this.buffer = buffer;
      this.i = 0;
      $$IteratorMixin.call(this);
    }
    var $$ParserMixin = (function () {
      function readString (utf16) {
        var ret = '', lenType = this.buffer.readUInt8(), length = this.buffer.readValue(lenType), i = 0;
        if (utf16) {
          while (i < length) {
            ret += String.fromCharCode(this.buffer.readUInt16());
            ++i;
          }
          return ret;
        }
        while (i < length) {
          ret += String.fromCharCode(this.buffer.readUInt8());
          ++i;
        }
        return ret;
      }
      function parseSI () {
        if (this.state & PARSED_SI) throw Error('Already parsed string index.');
        var stringCount, char;
        this.stringIndexType = this.buffer.readUInt8();
        switch (this.stringIndexType) {
          case CHAR:
          case SHORT:
          case INT:
            stringCount = this.buffer.readValue(this.stringIndexType);
            break;
          case EMPTY:
            stringCount = 0;
            break;
          default:
            throw Error('Invalid LEON.');
        }
        for (var i = 0; i < stringCount; ++i) {
          this.stringIndex.push(this.readString());
        }
        this.state |= PARSED_SI;
        return this;
      }
      function parseOLI () {
        if (!(this.state & PARSED_SI)) this.parseSI();
        if (!this.stringIndex.length) return this;
        var count, numFields, char, i, j;
        this.OLItype = this.buffer.readUInt8();
        switch (this.OLItype) {
          case CHAR:
          case SHORT:
          case INT:
            count = this.buffer.readValue(this.OLItype);
            break;
          case EMPTY:
            return this;
          default:
            throw Error('Invalid LEON.');
            break;
        }
        for (i = 0; i < count; ++i) {
          this.objectLayoutIndex.push([]);
          numFields = this.buffer.readValue(this.buffer.readUInt8());
          for (j = 0; j < numFields; ++j) {
            this.objectLayoutIndex[i].push(this.buffer.readValue(this.stringIndexType));
          }
        }
        return this;
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
          if (Array.isArray(spec)) {
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
              ret = new Array(length);
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
              ret = new Array(length);
              for (i = 0; i < length; ++i) {
                ret[i] = this.parseValue();
              }
              return ret;
            case OBJECT:
              ret = {};
              if (this.state & PARSED_SI) {
                index = this.objectLayoutIndex[this.buffer.readValue(this.OLItype)];
                for (i = 0; i < index.length; ++i) {
                  ret[this.stringIndex[index[i]]] = this.parseValue();
                }
              } else {
                length = this.buffer.readValue(this.buffer.readUInt8());
                for (i = 0; i < length; ++i) {
                  key = this.readString();
                  ret[key] = this.parseValue();
                }
              }
              break;
            case STRING:
              if (this.state & PARSED_SI) return this.stringIndex[this.buffer.readValue(this.stringIndexType)];
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
                ret = new Buffer(length);
                for (i = 0; i < length; ++i) {
                  ret[i] = this.buffer.readUInt8();
                }
              } else {
                ret = new ArrayBuffer(length);
                var bytes = new Uint8Array(ret);
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
        this.parseOLI = parseOLI;
        this.parseSI = parseSI;
      }
    })();
    function $Parser(buffer, spec) {
      if (!(this instanceof $Parser)) return new $Parser(buffer, spec);
      this.buffer = $BufferIterator(buffer);
      this.state = 0;
      this.stringIndex = [];
      this.objectLayoutIndex = [];
      this.spec = spec;
      $$ParserMixin.call(this);
    }
    function typeCheck(val, isFloat) {
      var asStr;
      if (typeof val === 'object') {
        if (val === null) return NULL;
        if (Array.isArray(val)) return VARARRAY;
        asStr = toString.call(val);
        if (asStr === '[object Date]') return DATE;
        if (asStr === '[object RegExp]') return REGEXP;
        try {
          if (Buffer.isBuffer(val)) return BUFFER;
          if (val instanceof ArrayBuffer) return BUFFER;
        } catch (e) {
          if (val instanceof ArrayBuffer) return BUFFER;
        }
        return OBJECT;
      }
      if (typeof val === 'function' || typeof val === 'undefined') {
        return UNDEFINED;
      }
      if (typeof val === 'boolean') {
        return val ? TRUE : FALSE;
      }
      if (typeof val === 'string') {
        if ([].map.call(val, function (v) { return v.charCodeAt(0); }).some(function (v) { return v > 255; })) return UTF16STRING;
        return STRING;
      }
      if (typeof val === 'number') {
        if (val !== val) return NAN;
        if (val === Number.NEGATIVE_INFINITY) return MINUS_INFINITY;
        if (val === Number.POSITIVE_INFINITY) return INFINITY;
        if (val % 1 || isFloat) {
          float[0] = val;
          if (float[0] === val) return FLOAT;
          return DOUBLE;
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
      }
    }
    var $$EncoderMixin = (function () {
      function writeData () {
        if (typeof this.spec !== 'undefined') this.writeValueWithSpec(this.payload);
        else this.writeValue(this.payload, typeCheck(this.payload));
        return this;
      }
      function toBuffer () {
        if (IS_NODE) {
          var ret = new Buffer(this.i);
          for (var i = 0; i < this.i; ++i) {
            ret[i] = this.buffer.uchars[i];
          }
          return ret;
        }
        return this.buffer.buffer.slice(0, this.i);
      }
      function writeValueWithSpec (val, spec) {
        var keys, i, type = typeof val;
        if (typeof spec === 'undefined') spec = this.spec;
        if (typeof spec === 'object') {
          if (Array.isArray(spec)) {
            if (!spec.object) {
              if (!Array.isArray(val)) throw TypeError('Was expecting an array but instead got a ' + type + '.');
              this.writeValue(val.length, typeCheck(val.length));
              for (i = 0; i < val.length; ++i) {
                this.writeValueWithSpec(val[i], spec[0]);
              }
            } else {
              if (typeof val !== 'object') throw TypeError('Was expecting an object but instead got a ' + type + '.');
              for (i = 0; i < spec.length; i += 2) {
                this.writeValueWithSpec(val[spec[i]], spec[i + 1]);
              }
            }
          } else if (toString.call(val) === '[object Date]') {
            this.writeValue(val, DATE, true);
          }
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
        var bytes, i, tmp, index, parts;
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
            if (!(this.state & PARSED_SI) || !this.stringIndex) {
              this.writeString(val);
              return 2 + val.length;
            }
            this.writeValue(this.stringIndex.indexOf(val), this.stringIndexType, true)
            return 2;
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
            if (this.state & PARSED_SI) {
              index = matchLayout(val, this.stringIndex, this.OLI);
              if (!implicit) this.writeValue(index, this.OLItype, true);
              for (i = 0; i < this.OLI[index].length; ++i) {
                tmp = val[this.stringIndex[this.OLI[index][i]]];
                this.writeValue(tmp, typeCheck(tmp));
              }
            } else {
              index = Object.getOwnPropertyNames(val);
              this.writeValue(index.length, typeCheck(index.length));
              for (i = 0; i < index.length; ++i) {
                this.writeString(index[i]);
                this.writeValue(val[index[i]], typeCheck(val[index[i]]));
              }
            }
            break;
          case DATE:
            if (!implicit) this.appendUInt8(type);
            this.writeValue(val.valueOf(), DOUBLE, true);
            break;
          case BUFFER:
            if (!implicit) this.appendUInt8(type);
            if (val instanceof ArrayBuffer) {
              bytes = new Uint8Array(val);
              this.writeValue(bytes.length, typeCheck(bytes.length));
              for (i = 0; i < bytes.length; ++i) {
                this.writeValue(bytes[i], CHAR, true);
              }
            } else if (IS_NODE && Buffer.isBuffer(val)) {
              this.writeValue(val.length, typeCheck(val.length));
              for (i = 0; i < val.length; ++i) {
                this.writeValue(val[i], CHAR, true);
              }
            }
            break;
          case REGEXP:
            if (!implicit) this.appendUInt8(type);
            parts = regexpToParts(val);
            this.writeString(parts[0]);
            this.writeString(parts[1]);
            return parts.reduce(function (r, v) {
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
      function writeOLI (num) {
        if (!this.stringIndex.length) return this;
        this.OLI = gatherLayouts(this.payload, this.stringIndex);
        if (!this.OLI.length) {
          this.writeValue(EMPTY, CHAR, true)
          return this;
        }
        this.OLItype = typeCheck(this.OLI.length);
        this.writeValue(this.OLI.length, this.OLItype);
        this.OLI.forEach(function (v) {
          var type = typeCheck(v.length);
          this.writeValue(v.length, type);
          v.forEach(function (v) {
            this.writeValue(v, this.stringIndexType, true);
          }, this);
        }, this);
        return this;
      }
      function writeSI () {
        this.stringIndex = gatherStrings(this.payload);
        if (!this.stringIndex.length) {
          this.state |= PARSED_SI;
          this.writeValue(EMPTY, CHAR, true)
          return this;
        }
        this.stringIndexType = typeCheck(this.stringIndex.length);
        this.writeValue(this.stringIndex.length, this.stringIndexType);
        this.stringIndex.forEach(function (v) {
          this.writeString(v);
        }, this);
        this.state |= PARSED_SI;
        return this;
      }
      return function () {
        this.writeData = writeData;
        this.export = toBuffer;
        this.writeValueWithSpec = writeValueWithSpec; 
        this.writeValue = writeValue;
        this.appendUInt8 = appendUInt8;
        this.writeString = writeString;
        this.writeSI = writeSI;
        this.writeOLI = writeOLI;
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
    function matchLayout(val, stringIndex, OLI) {
      var i = 0, j, tmp, broken, layout = Object.getOwnPropertyNames(val).map(function (v) {
        return stringIndex.indexOf(v);
      }).sort(function (a, b) {
        return a - b;
      });
      while (i < OLI.length) {
        broken = false;
        if (layout.length !== OLI[i].length) {
          ++i;
          continue;
        }
        tmp = OLI[i].slice().sort(function (a, b) { return a - b });
        for (j = 0; j < layout.length; ++j) {
          if (layout[j] !== tmp[j]) {
            broken = true;
            break;
          }
        }
        if (broken) {
          ++i;
          continue;
        }
        return i;
      }
    }
    function regexpToParts (regex) {
      regex = regex.toString();
      return [regex.substr(1, regex.lastIndexOf('/') - 1), regex.substr(regex.lastIndexOf('/') + 1)];
    }
    function gatherLayouts(val, stringIndex, ret, branch) {
      var keys, i, j, el;
      if (!ret) ret = [];
      if (branch === void 0) branch = val;
      if (typeof branch === 'object' && !Buffer.isBuffer(branch) && toString.call(branch) !== '[object RegExp]' && toString.call(branch) !== '[object Date]' && branch !== null) {
        keys = Object.getOwnPropertyNames(branch);
        if (!Array.isArray(branch) && toString.call(branch) !== '[object Date]') {
          el = [];
          keys.forEach(function (v) {
            el.push(stringIndex.indexOf(v));
          });
          el.sort(function (a, b) {
            return a - b;
          })
          if ((function isNotInArray (arr, el) {
            var cont;
            for (i = 0; i < arr.length; ++i) {
              cont = false;
              if (arr[i].length !== el.length) continue;
              for (j = 0; j < el.length; ++j) {
                if (el[j] !== arr[i][j]) {
                  cont = true;
                  break;
                }
              }
              if (cont) continue;
              return false;
            }
            return true;
          })(ret, el)) ret.push(el);
        }
        for (i = 0; i < keys.length; ++i) {
          gatherLayouts(val, stringIndex, ret, branch[keys[i]]);
        }
      }
      return ret;
    }
    function gatherStrings(val, ret, branch) {
      if (!ret) ret = [];
      if (branch === void 0) branch = val;
      var keys, i;
      if (typeof branch === 'object' && toString.call(branch) !== '[object RegExp]' && toString.call(branch) !== '[object Date]' && !Buffer.isBuffer(branch)) {
        keys = Object.getOwnPropertyNames(branch);
        if (!Array.isArray(branch)) keys.forEach(function (v) { setPush(ret, v); });
        for (i = 0; i < keys.length; ++i) {
          gatherStrings(val, ret, branch[keys[i]]);
        }
      } else if (typeof branch === 'string') {
        setPush(ret, branch);
      }
      return ret;
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
          return [ typeGcd(arr.reduce(function (r, v) {
            return r.concat(v);
          }, [])) ];
        case OBJECT:
          var ret = {}
          Object.getOwnPropertyNames(arr[0]).forEach(function (v) {
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
        if (typeof arr[i][prop] === 'undefined') throw Error('Object ' + JSON.stringify(arr[i]) + ' has no property ' + String(prop) + '.');
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
          Object.getOwnPropertyNames(val).forEach(function (v) {
            ret[v] = toTemplate(val[v]);
          });
          return ret;
        case FALSE:
          return TRUE;
        default:
          return type;
      }
    }
    function setPush(arr, val) {
      if (arr.indexOf(val) === -1) arr.push(val);
    }
    function parse(buf, flags) {
      var parser = $Parser($SmartArrayBuffer(buf));
      if (flags & USE_INDEXING) parser.parseSI().parseOLI();
      return parser.parseValue(); 
    }
    function bufferify(val, flags) {
      var encoder = $Encoder(val);
      if (flags & USE_INDEXING) encoder.writeSI().writeOLI();
      return encoder.writeData().export();
    }
    function isQuotedKey(str) {
      if (/^[0-9]/.test(str) || /[^\w_]/.test(str)) return true;
      return false;
    }
    function inObject(obj, val) {
      for (var i = 0, keys = Object.getOwnPropertyNames(obj); i < keys.length; ++i) {
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
          if (Array.isArray(spec)) {
            if (spec.length === 0) throw Error(path + ' is an array with no elements, must have one.');
            if (spec.length > 1) throw Error(path + ' is an array with more than one element. If you want to serialize an array of various types you must use LEON.DYNAMIC.');
            validateSpec(spec[0], path + '[0]');
          } else {
            for (var i = 0, keys = Object.getOwnPropertyNames(spec); i < keys.length; ++i) {
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
          if (Array.isArray(spec)) {
            var ret = [];
            ret.push(sort(spec[0]));
            return ret;
          }
          var ret = [];
          var keys = Object.getOwnPropertyNames(spec);
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
          if (Array.isArray(branch)) {
            ret += '[' + this.inspect(j, data, branch[0], depth, init, multiline) + ']';
          } else {
            multiline.flag = true;
            ret += '{\n';
            for (keys = Object.getOwnPropertyNames(branch), i = 0; i < keys.length; ++i) {
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
      bufferify: function (val) {
        return $Encoder(val, this.sorted).writeData().export();
      },
      parse: function (buf) {
        return $Parser($SmartArrayBuffer(buf), this.sorted).parseValueWithSpec();
      }
    }
    var LEON = {};
    assignTo(LEON)(types)(flags);
    LEON.parse = parse;
    LEON.bufferify = bufferify;
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
