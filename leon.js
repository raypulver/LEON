"use strict";
(function () {
  var root = this,
      previous_LEON = root.LEON;
  var PARSED_SI = 0x01, PARSED_OLI = 0x02;
  var SIGNED = 0x01,
      CHAR = 0x00,
      SHORT = 0x02,
      INT = 0x04,
      FLOAT = 0x06,
      DOUBLE = 0x07;
  var VARARRAY = 0x80,
      OBJECT = 0x09,
      STRING = 0x10,
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
      EMPTY = 0xFF;

  var types = {
    CHAR: (SIGNED | CHAR),
    UNSIGNED_CHAR: CHAR,
    SHORT: (SIGNED | SHORT),
    UNSIGNED_SHORT: SHORT,
    INT: (SIGNED | INT),
    UNSIGNED_INT: INT,
    FLOAT: FLOAT,
    DOUBLE: DOUBLE,
    ARRAY: VARARRAY,
    OBJECT: OBJECT,
    STRING: STRING,
    BOOLEAN: (TRUE & FALSE),
    NULL: NULL,
    UNDEFINED: UNDEFINED,
    DATE: DATE,
    BUFFER: BUFFER,
    REGEXP: REGEXP,
    MINUS_INFINITY: MINUS_INFINITY,
    POSITIVE_INFINITY: INFINITY
  };

  var LEON = (function () {
    function $StringBuffer(str) {
      if (!(this instanceof $StringBuffer)) return new $StringBuffer(str);
      if (str) this.buffer = str;
      else this.buffer = '';
    }
    $StringBuffer.concat = function (arr) {
      return $StringBuffer(arr.reduce(function (r, v) {
        return r + v.buffer;
      }, ''));
    };
    $StringBuffer.fromString = function (str) {
      var ret = $StringBuffer(), i = 0;
      while (str[i]) {
        ret.writeUInt8(str.charCodeAt(i), i);
        i++;
      }
      return ret;
    };
    $StringBuffer.prototype = {
      writeUInt8: function (val, offset) {
        val = +val;
        if (offset === this.buffer.length || offset === -1) {
          this.buffer += String.fromCharCode(val);
        } else {
          this.buffer = this.buffer.substr(0, offset) + String.fromCharCode(val) + this.buffer.substr(offset + 1);
        }
        return offset + 1; 
      },
      writeInt8: function (val, offset) {
        val = +val;
        val = (val < 0 ? complement(-val, 8) : val);
        if (offset === this.buffer.length || offset === -1) {
          this.buffer += String.fromCharCode(val);
        } else {
          this.buffer = this.buffer.substr(0, offset) + String.fromCharCode(val) + this.buffer.substr(offset + 1);
        }
        return offset + 1;
      },
      writeUInt16LE: function (val, offset) {
        val = +val;
        if (offset === this.buffer.length || offset === -1) {
          this.buffer += String.fromCharCode(val & 0xFF);
          this.buffer += String.fromCharCode(val >>> 8);
        } else {
          this.buffer = this.buffer.substr(0, offset) + String.fromCharCode(val & 0xFF) + String.fromCharCode(val >>> 8) + this.buffer.substr(offset + 2);
        }
        return offset + 2;
      },
      writeInt16LE: function (val, offset) {
        val = +val;
        val = (val < 0 ? complement(-val, 16) : val);
        return this.writeUInt16LE(val, offset);
      },
      writeUInt32LE: function (val, offset) {
        val = +val;
        if (offset === this.buffer.length || offset === -1) {
          this.buffer += String.fromCharCode(val & 0xFF) + String.fromCharCode((val >>> 8) & 0xFF) + String.fromCharCode((val >>> 16) & 0xFF) + String.fromCharCode((val >>> 24) & 0xFF);
        } else {
          this.buffer = this.buffer.substr(0, offset) + String.fromCharCode(val & 0xFF) + String.fromCharCode((val >>> 8) & 0xFF) + String.fromCharCode((val >>> 16) & 0xFF) + String.fromCharCode((val >>> 24) & 0xFF) + this.buffer.substr(offset + 4);
        }
      },
      writeInt32LE: function (val, offset) {
        val = +val;
        val = (val < 0 ? complement(-val, 32) : val);
        return this.writeUInt32LE(val, offset);
      },
      writeFloatLE: function (val, offset) {
        val = +val;
        var exp = 127, sig = val, sign, log;
        if (sig < 0) sign = 1;
        else sign = 0;
        sig = Math.abs(sig);
        log = Math.log(sig)/Math.log(2);
        if (log > 0) {
          log = Math.floor(log);
        } else {
          log = Math.ceil(log);
        }
        sig *= Math.pow(2, -log + 23);
        exp += log;
        sig = Math.round(sig);
        var bytes = [];
        bytes.push(sign << 7);
        bytes[0] += ((exp & 0xFE) >>> 1);
        bytes.push((exp & 0x01) << 7);
        bytes[1] += ((sig >>> 16) & 0x7F);
        bytes.push((sig >>> 8) & 0xFF);
        bytes.push(sig & 0xFF);
        for (var i = bytes.length - 1; i >= 0; --i) {
          this.writeUInt8(bytes[i], offset + (bytes.length - 1 - i));
        }
        return offset + 4;
      },
      writeDoubleLE: function (val, offset) {
        val = +val;
        var exp = 1023, sig = val, sign, log;
        if (sig < 0) sign = 1;
        else sign = 0;
        sig = Math.abs(sig);
        log = Math.log(sig)/Math.log(2);
        if (log > 0) {
          log = Math.floor(log);
        } else {
          log = Math.ceil(log);
        }
        sig *= Math.pow(2, -log + 52);
        exp += log;
        sig = Math.round(sig);
        sig = parseInt(sig.toString(2).substr(1), 2);
        var bytes = [];
        bytes.push(sign << 7);
        bytes[0] += exp >>> 4;
        bytes.push((exp & 0x0F) << 4);
        bytes[1] += Math.floor(shift(sig, -48)) & 0x0F;
        var sh = 40;
        for (var i = 0; i < 6; ++i, sh -= 8) {
          bytes.push(Math.floor(shift(sig, -sh)) & 0xFF);
        }
        for (i = bytes.length - 1; i >= 0; --i) {
          this.writeUInt8(bytes[i], offset + (bytes.length - 1 - i));
        }
        return offset + 8;
      },
      readUInt8: function (offset) {
        offset >>>= 0;
        return this.buffer.charCodeAt(offset);
      },
      readInt8: function (offset) {
        offset >>>= 0;
        var val = this.buffer.charCodeAt(offset);
        if (0x80 & val) return -complement(val, 8);
        return val;
      },
      readUInt16LE: function (offset) {
        offset >>>= 0;
        return this.buffer.charCodeAt(offset) | (this.buffer.charCodeAt(offset + 1) << 8);
      },
      readInt16LE: function (offset) {
        var val = this.readUInt16LE(offset);
        if (val & 0x8000) return -complement(val, 16);
        return val;
      },
      readUInt32LE: function (offset) {
        offset >>>= 0;
        return (this.buffer.charCodeAt(offset) | (this.buffer.charCodeAt(offset + 1) << 8) | (this.buffer.charCodeAt(offset + 2) << 16) | (this.buffer.charCodeAt(offset + 3) << 24));
      },
      readInt32LE: function (offset) {
        var val = this.readUInt32LE(offset);
        if (val & 0x80000000) return -complement(val, 32);
        return val;
      },
      readFloatLE: function (offset) {
        var bytes = [], ret;
        for (var i = 0; i < 4; ++i) {
          bytes.push(this.readUInt8(offset + i));
        }
        bytes.reverse();
        var sign = (0x80 & bytes[0]) >>> 7,
            exp = ((bytes[0] & 0x7F) << 1) + ((bytes[1] & 0x80) >>> 7),
            sig = 0;
        bytes[1] &= 0x7F;
        for (i = 0; i <= 2; ++i) {
          sig += (bytes[i + 1] << ((2 - i)*8));
        }
        sig |= 0x800000;
        return shift((sign ? -sig : sig), exp - (127 + 23));
      },
      readDoubleLE: function (offset) {
        var bytes = [];
        for (var i = 0; i < 8; ++i) {
          bytes.push(this.readUInt8(offset + i));
        }
        bytes.reverse();
        var sign = (0x80 & bytes[0]) >>> 7,
            exp = ((bytes[0] & 0x7F) << 4) + ((bytes[1] & 0xF0) >>> 4),
            sig = 0;
        bytes[1] &= 0x0F;
        for (i = 0; i <= 6; ++i) {
          sig += shift(bytes[i + 1], (6 - i)*8);
        }
        sig += 0x10000000000000;
        return shift((sign ? -sig : sig), exp - (1023 + 52));
      }
    };
    function shift (val, n) {
      return val*Math.pow(2, n);
    }
    function complement(num, bits) {
      if (bits > 31 || !bits) return ~num;
      return (num ^ fill(bits)) + 1;
    }
    function fill(bits) {
      return (1 << bits) - 1;
    }
    function $BufferIterator(buffer) {
      if (!(this instanceof $BufferIterator)) return new $BufferIterator(buffer);
      this.buffer = buffer;
      this.i = 0;
    }
    $BufferIterator.prototype = {
      exhausted: function () {
        return i >= this.buffer.length;
      },
      readUInt8: function () {
        this.i++;
        return this.buffer.readUInt8(this.i - 1);
      },
      readInt8: function () {
        this.i++;
        return this.buffer.readInt8(this.i - 1);
      },
      readUInt16: function () {
        this.i += 2;
        return this.buffer.readUInt16LE(this.i - 2);
      },
      readInt16: function () {
        this.i += 2;
        return this.buffer.readInt16LE(this.i - 2);
      },
      readUInt32: function () {
        this.i += 4;
        return this.buffer.readUInt32LE(this.i - 4);
      },
      readInt32: function () {
        this.i += 4;
        return this.buffer.readInt32LE(this.i - 4);
      },
      readFloat: function () {
        this.i += 4;
        return this.buffer.readFloatLE(this.i - 4);
      },
      readDouble: function () {
        this.i += 8;
        return this.buffer.readDoubleLE(this.i - 8);
      },
      readValue: function (type) {
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
    }
    function $Parser(buffer, spec) {
      if (!(this instanceof $Parser)) return new $Parser(buffer, spec);
      this.buffer = $BufferIterator(buffer);
      this.state = 0;
      this.stringIndex = [];
      this.objectLayoutIndex = [];
      this.spec = spec;
    }
    $Parser.prototype = {
      readString: function () {
        var ret = '', lenType = this.buffer.readUInt8(), length = this.buffer.readValue(lenType), i = 0;
        while (i < length) {
          ret += String.fromCharCode(this.buffer.readUInt8());
          ++i;
        }
        return ret;
      },
      parseSI: function () {
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
      },
      parseOLI: function () {
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
      },
      parseValueWithSpec: function (spec) {
        var ret, i, length, keys, type;
        if (typeof spec === 'undefined') spec = this.spec;
        if (spec === STRING) {
          ret = this.readString();
          return ret;
        } else if (typeof spec === 'object') {
          if (spec === DATE) {
            ret = this.parseValue(spec);
            return ret;
          } else if (Array.isArray(spec)) {
            if (spec.length === 0) return this.parseValue(VARARRAY);
            else {
              spec = spec[0];
              type = this.buffer.readUInt8();
              length = this.buffer.readValue(type);
              ret = [];
              for (i = 0; i < length; ++i) {
                ret.push(this.parseValueWithSpec(spec));
              }
              return ret;
            }
          } else {
            ret = {};
            keys = Object.getOwnPropertyNames(spec);
            keys.sort(function (a, b) { return a > b; });
            for (i = 0; i < keys.length; ++i) {
              ret[keys[i]] = this.parseValueWithSpec(spec[keys[i]]);
            }
            return ret;
          }
        } else if (spec === (TRUE & FALSE)) {
          return this.parseValue();
        } else {
          return this.parseValue(spec);
        }
      },
      parseValue: function (type) {
        if (typeof type === 'undefined') type = this.buffer.readUInt8();
        var length, i, ret, index;
        if (type < OBJECT) {
          return this.buffer.readValue(type);
        } else if (type === VARARRAY) {
          type = this.buffer.readUInt8();
          length = this.buffer.readValue(type);
          ret = [];
          for (i = 0; i < length; ++i) {
            ret.push(this.parseValue());
          }
          return ret;
        } else if (type === OBJECT) {
          index = this.objectLayoutIndex[this.buffer.readValue(this.OLItype)];
          ret = {};
          for (i = 0; i < index.length; ++i) {
            ret[this.stringIndex[index[i]]] = this.parseValue();
          }
        } else if (type === STRING) {
          return this.stringIndex[this.buffer.readValue(this.stringIndexType)];
        } else if (type === UNDEFINED) {
          return void 0;
        } else if (type === TRUE) {
          return true;
        } else if (type === FALSE) {
          return false;
        } else if (type === NULL) {
          return null;
        } else if (type === NAN) {
          return NaN;
        } else if (type === MINUS_INFINITY) {
          return Number.NEGATIVE_INFINITY;
        } else if (type === INFINITY) {
          return Number.POSITIVE_INFINITY;
        } else if (type === DATE) {
          return new Date(this.buffer.readValue(INT) * 1000);
        } else if (type === BUFFER) {
          length = this.buffer.readValue(this.buffer.readUInt8());
          try {
            ret = new Buffer(length);
          } catch (e) {
            try {
              ret = StringBuffer();
            } catch (e) {
              throw Error('LEON object contains a Buffer but StringBuffer has not been loaded.');
            }
          }
          for (i = 0; i < length; ++i) {
            ret.writeUInt8(this.buffer.readValue(CHAR), i);
          }
          return ret;
        } else if (type === REGEXP) {
          return RegExp(this.readString(), this.readString());
        } else {
          throw Error('Invalid LEON.');
        }
        return ret;
      }
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
        } catch (e) {
          try {
            if (val instanceof StringBuffer) return BUFFER;
          } catch (e) {}
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
        return STRING;
      }
      if (typeof val === 'number') {
        if (val !== val) return NAN;
        if (val === Number.NEGATIVE_INFINITY) return MINUS_INFINITY;
        if (val === Number.POSITIVE_INFINITY) return INFINITY;
        var exp = 0, figures = 0, sig = val;
        if (sig % 1 || isFloat) {
          sig = Math.abs(sig);
          var log = Math.log(sig)/Math.log(2);
          if (log < 0) {
            log = Math.ceil(log);
          } else {
            log = Math.floor(log);
          }
          var exp = 103 + log;
          if (exp < 0 || exp > 255) return DOUBLE;
          sig *= Math.pow(2, -log + 24);
          debugger;
          if (sig % 1) return DOUBLE;
          return FLOAT;
        }
        if (sig < 0) {
          if (Math.abs(sig) <= 1 << 7) return SIGNED | CHAR;
          if (Math.abs(sig) <= 1 << 15) return SIGNED | SHORT;
          if (Math.abs(sig) <= 1 << 31) return SIGNED | INT;
          return DOUBLE;
        }
        if (sig < 1 << 8) return CHAR;
        if (sig < 1 << 16) return SHORT;
        if (sig < Math.pow(2, 32)) return INT;
        return DOUBLE;
      }
    }
    function $Encoder(obj, spec) {
      if (!(this instanceof $Encoder)) return new $Encoder(obj, spec);
      this.payload = obj;
      this.buffer = $StringBuffer();
      this.spec = spec;
    }
    $Encoder.prototype = {
      append: function (buf) {
        this.buffer = $StringBuffer.concat([this.buffer, buf]);
      },
      writeData: function () {
        if (typeof this.spec !== 'undefined') this.writeValueWithSpec(this.payload);
        else this.writeValue(this.payload, typeCheck(this.payload));
        return this;
      },
      export: function () {
        return this.buffer.buffer;
      },
      writeValueWithSpec: function (val, spec) {
        var keys, i;
        if (typeof spec === 'undefined') spec = this.spec;
        if (typeof spec === 'object') {
          if (Array.isArray(spec)) {
            this.writeValue(val.length, typeCheck(val.length));
            for (i = 0; i < val.length; ++i) {
              this.writeValueWithSpec(val[i], spec[0]);
            }
          } else if (toString.call(val) === '[object Date]') {
            this.writeValue(val, DATE, true);
          } else {
            keys = Object.getOwnPropertyNames(spec);
            var morekeys = Object.getOwnPropertyNames(val);
            keys.sort(function (a, b) { return a > b; });
            for (i = 0; i < keys.length; ++i) {
              this.writeValueWithSpec(val[keys[i]], spec[keys[i]]);
            }
          }
        } else if (spec === (TRUE & FALSE)) {
          this.writeValue(val, typeCheck(val), true);
        } else {
          this.writeValue(val, spec, true);
        }
      },
      writeValue: function (val, type, implicit) {
        var typeByte = $StringBuffer(), bytes, i, tmp, index, parts;
        typeByte.writeUInt8(type, 0);
        if (type === UNDEFINED || type === TRUE || type === FALSE || type === NULL || type === NAN || type === MINUS_INFINITY || type === INFINITY) {
          this.append(typeByte);
          return 1;
        }
        if (type === STRING) {
          if (!implicit) this.append(typeByte);
          if (!this.stringIndex) {
            this.writeString(val);
            return 2 + val.length;
          }
          this.writeValue(this.stringIndex.indexOf(val), this.stringIndexType, true)
          return 2;
        }
        if (type === (SIGNED | CHAR)) {
          if (!implicit) this.append(typeByte);
          bytes = $StringBuffer();
          bytes.writeInt8(val, 0);
          this.append(bytes);
          return 2;
        }
        if (type === CHAR) {
          if (!implicit) this.append(typeByte);
          bytes = $StringBuffer();
          bytes.writeUInt8(val, 0);
          this.append(bytes);
          return 2;
        }
        if (type === (SIGNED | SHORT)) {
          if (!implicit) this.append(typeByte);
          bytes = $StringBuffer();
          bytes.writeInt16LE(val, 0);
          this.append(bytes);
          return 3;
        }
        if (type === SHORT) {
          if (!implicit) this.append(typeByte);
          bytes = $StringBuffer();
          bytes.writeUInt16LE(val, 0);
          this.append(bytes);
          return 3;
        }
        if (type === (SIGNED | INT)) {
          if (!implicit) this.append(typeByte);
          bytes = $StringBuffer();
          bytes.writeInt32LE(val, 0);
          this.append(bytes);
          return 5;
        }
        if (type === INT) {
          if (!implicit) this.append(typeByte);
          bytes = $StringBuffer();
          bytes.writeUInt32LE(val, 0);
          this.append(bytes);
          return 5;
        }
        if (type === FLOAT) {
          if (!implicit) this.append(typeByte);
          bytes = $StringBuffer();
          bytes.writeFloatLE(val, 0);
          this.append(bytes);
          return 5;
        }
        if (type === DOUBLE) {
          if (!implicit) this.append(typeByte);
          bytes = $StringBuffer();
          bytes.writeDoubleLE(val, 0);
          this.append(bytes);
          return 9;
        }
        if (type === VARARRAY) {
          if (!implicit) this.append(typeByte);
          this.writeValue(val.length, typeCheck(val.length));
          for (i = 0; i < val.length; ++i) {
            this.writeValue(val[i], typeCheck(val[i]));
          }
        }
        if (type === OBJECT) {
          if (!implicit) this.append(typeByte);
          index = matchLayout(val, this.stringIndex, this.OLI);
          if (!implicit) this.writeValue(index, this.OLItype, true);
          for (i = 0; i < this.OLI[index].length; ++i) {
            tmp = val[this.stringIndex[this.OLI[index][i]]];
            this.writeValue(tmp, typeCheck(tmp));
          }
        }
        if (type === DATE) {
          if (!implicit) this.append(typeByte);
          this.writeValue(Math.floor(val.valueOf() / 1000), INT, true);
        }
        if (type === BUFFER) {
          if (!implicit) this.append(typeByte);
          this.writeValue(val.length, typeCheck(val.length));
          for (i = 0; i < val.length; ++i) {
            this.writeValue(val[i], CHAR, true);
          }
        }
        if (type === REGEXP) {
          if (!implicit) this.append(typeByte);
          parts = regexpToParts(val);
          this.writeString(parts[0]);
          this.writeString(parts[1]);
          return parts.reduce(function (r, v) {
            return r + v.length + 1;
          }, 0);
        }
      },
      writeString: function (str) {
        this.writeValue(str.length, typeCheck(str.length));
        for (var i = 0; i < str.length; ++i) {
          this.writeValue(str.charCodeAt(i), CHAR, true);
        }
        return;
      },
      writeOLI: function (num) {
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
      },
      writeSI: function () {
        this.stringIndex = gatherStrings(this.payload);
        if (!this.stringIndex.length) {
          this.writeValue(EMPTY, CHAR, true)
          return this;
        }
        this.stringIndexType = typeCheck(this.stringIndex.length);
        this.writeValue(this.stringIndex.length, this.stringIndexType);
        this.stringIndex.forEach(function (v) {
          this.writeString(v);
        }, this);
        return this;
      }
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
      var keys, i;
      if (!ret) ret = [];
      if (branch === void 0) branch = val;
      if (typeof branch === 'object' && !Buffer.isBuffer(branch) && toString.call(branch) !== '[object RegExp]' && toString.call(branch) !== '[object Date]' && branch !== null) {
        keys = Object.getOwnPropertyNames(branch);
        if (!Array.isArray(branch) && toString.call(branch) !== '[object Date]') {
          ret.push([]);
          keys.forEach(function (v) {
            ret[ret.length - 1].push(stringIndex.indexOf(v));
          });
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
      if (typeof arr[0] === 'number') {
        var highestMagnitude = Math.abs(arr[0]),
            fp = (arr[0] % 1 !== 0),
            sign = (arr[0] < 0 ? 1 : 0);
        for (var i = 1; i < arr.length; ++i) {
          if (typeof arr[i] !== 'number') throw Error('Received a non-numerical value in an array of numbers.');
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
      } else if (type === VARARRAY) {
        return [ typeGcd(arr.reduce(function (r, v) {
          return r.concat(v);
        }, [])) ];
      } else if (type === OBJECT) {
        var ret = {}
        Object.getOwnPropertyNames(arr[0]).forEach(function (v) {
          ret[v] = typeGcd(pluck(arr, v));
        });
        return ret;
      } else {
        if (type === FALSE) type = TRUE;
        var thisType;
        for (var i = 1; i < arr.length; ++i) {
          thisType = typeCheck(arr[i]);
          if (thisType === FALSE) thisType = TRUE;
          if (thisType !== type) {
            throw new Error('Type mismatch.');
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
      if (type === VARARRAY) {
        return [typeGcd(val)];
      } else if (type === OBJECT) {
        var ret = {};
        Object.getOwnPropertyNames(val).forEach(function (v) {
          ret[v] = toTemplate(val[v]);
        });
        return ret;
      } else if (type === FALSE) return TRUE;
      else return type;
    }
    function setPush(arr, val) {
      if (arr.indexOf(val) === -1) arr.push(val);
    }
    function parse(buf) {
      return $Parser($StringBuffer(buf)).parseSI().parseOLI().parseValue();
    }
    function stringify(val) {
      return $Encoder(val).writeSI().writeOLI().writeData().export();
    }
    function Channel(spec) {
      if (!(this instanceof Channel)) return new Channel(spec);
      this.spec = spec;
    }
    Channel.prototype = {
      stringify: function (val) {
        return $Encoder(val, this.spec).writeData().export();
      },
      parse: function (buf) {
        return $Parser($StringBuffer(buf), this.spec).parseValueWithSpec();
      }
    }
    var LEON = {};
    LEON.types = types;
    LEON.parse = parse;
    LEON.stringify = stringify;
    LEON.toTemplate = toTemplate;
    LEON.Channel = Channel;
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
