var PARSED_SI = 0x01, PARSED_OLI = 0x02;
var SIGNED = 0x01,
    CHAR = 0x00,
    SHORT = 0x02,
    INT = 0x04,
    FLOAT = 0x06,
    DOUBLE = 0x07
    VARARRAY = 0x08,
    OBJECT = 0x09,
    STRING = 0x10,
    TRUE = 0x11,
    FALSE = 0x12,
    NULL = 0x13,
    UNDEFINED = 0x14,
    DATE = 0x15,
    BUFFER = 0x16,
    EMPTY = 0xFF;
    
var LEON = (function () {
  function $BufferIterator(buffer) {
    if (!(this instanceof $BufferIterator)) return new $BufferIterator(buffer);
    this.buffer = buffer;
    this.i = 0;
  }
  $BufferIterator.prototype = {
    exhausted: function () {
      return i >= buffer.length;
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
      return this.buffer.readDoubleLE(this.i - 4);
    },
    readValue: function (type) {
      if (type === CHAR) {
        return this.readUInt8();
      } else if (type === CHAR | SIGNED) {
        return this.readInt8();
      } else if (type === SHORT) {
        return this.readUInt16();
      } else if (type === SHORT | SIGNED) {
        return this.readInt16();
      } else if (type === INT) {
        return this.readUInt32();
      } else if (type === INT | SIGNED) {
        return this.readInt32();
      } else if (type === FLOAT) {
        return this.readFloat();
      } else if (type === DOUBLE) {
        return this.readDouble();
      }
    }
  } 
  function $Parser(buffer) {
    if (!(this instanceof $Parser)) return new $Parser(buffer);
    this.buffer = $BufferIterator(buffer);
    this.state = 0;
    this.stringIndex = [];
    this.objectLayoutIndex = [];
  }
  $Parser.prototype = {
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
        this.stringIndex.push('');
        while (true) {
          char = this.buffer.readUInt8();
          if (!char) break;
          this.stringIndex[this.stringIndex.length - 1] += String.fromCharCode(char);
        }
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
    parseValue: function () {
      var type = this.buffer.readUInt8(), length, i, ret, index;
      if (type < VARARRAY) {
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
      } else if (type === DATE) {
        ret = new Date();
        ret.setUTCFullYear(this.buffer.readValue(SHORT));
        ret.setUTCMonth(this.buffer.readValue(CHAR));
        ret.setUTCDate(this.buffer.readValue(CHAR));
        ret.setUTCHours(this.buffer.readValue(CHAR));
        ret.setUTCMinutes(this.buffer.readValue(CHAR));
        ret.setUTCSeconds(this.buffer.readValue(CHAR));
        return ret;
      } else if (type === BUFFER) {
        length = this.buffer.readValue(this.buffer.readUInt8());
        ret = new Buffer(length);
        for (i = 0; i < length; ++i) {
          ret.writeUInt8(this.buffer.readValue(CHAR), i);
        }
        return ret;
      } else {
        throw Error('Invalid LEON.');
      }
      return ret;
    }
  }
  function typeCheck(val) {
    if (typeof val === 'object') {
      if (val === null) return NULL;
      if (Array.isArray(val)) return VARARRAY;
      if (toString.call(val) === '[object Date]') return DATE;
      if (Buffer.isBuffer(val)) return BUFFER;
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
      var exp = 0, figures = 0, sig = val;
      if (sig % 1) {
        if (Math.abs(sig) < 1) {
          for (; sig > 1; --exp, sig = Math.pow(sig, 2)) {}
        } else {
          for (; Math.abs(sig) < 2; ++exp, sig /= 2) {}
        }
        for (; sig !== 0; figures++, sig = Math.pow(sig, 2) % 1) {}
        if (exp < -128 || exp > 127) return DOUBLE;
        if (figures > 22) return DOUBLE;
        return FLOAT;
      }
      if (sig < 0) {
        if (sig > 1 << 7) return SIGNED | CHAR;
        if (sig > 1 << 15) return SIGNED | SHORT;
        return SIGNED | INT;
      }
      if (sig < 1 << 8) return CHAR;
      if (sig < 1 << 16) return SHORT;
      return INT;
    }
  }
  function $Encoder(obj) {
    if (!(this instanceof $Encoder)) return new $Encoder(obj);
    this.payload = obj;
    this.buffer = new Buffer(0);
  }
  $Encoder.prototype = {
    append: function (buf) {
      this.buffer = Buffer.concat([this.buffer, buf]);
    },
    writeData: function () {
      this.writeValue(this.payload, typeCheck(this.payload));
      return this;
    },
    export: function () {
      return this.buffer;
    },
    writeValue: function (val, type, implicit) {
      var typeByte = new Buffer(1), bytes, i, tmp, index;
      typeByte[0] = type;
      if (type === UNDEFINED || type === TRUE || type === FALSE || type === NULL) {
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
        bytes = new Buffer(1);
        bytes.writeInt8(val, 0);
        this.append(bytes);
        return 2;
      }
      if (type === CHAR) {
        if (!implicit) this.append(typeByte);
        bytes = new Buffer(1);
        bytes.writeUInt8(val, 0);
        this.append(bytes);
        return 2;
      }
      if (type === (SIGNED | SHORT)) {
        if (!implicit) this.append(typeByte);
        bytes = new Buffer(2);
        bytes.writeInt16LE(val, 0);
        this.append(bytes);
        return 3;
      }
      if (type === SHORT) {
        if (!implicit) this.append(typeByte);
        bytes = new Buffer(2);
        bytes.writeUInt16LE(val, 0);
        this.append(bytes);
        return 3;
      }
      if (type === (SIGNED | INT)) {
        if (!implicit) this.append(typeByte);
        bytes = new Buffer(4);
        bytes.writeInt32LE(val, 0);
        this.append(bytes);
        return 5;
      }
      if (type === INT) {
        if (!implicit) this.append(typeByte);
        bytes = new Buffer(4);
        bytes.writeUInt32LE(val, 0);
        this.append(bytes);
        return 5;
      }
      if (type === FLOAT) {
        if (!implicit) this.append(typeByte);
        bytes = new Buffer(4);
        bytes.writeFloatLE(val, 0);
        this.append(bytes);
        return 5;
      }
      if (type === DOUBLE) {
        if (!implicit) this.append(typeByte);
        bytes = new Buffer(8);
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
        this.writeValue(index, this.OLItype, true);
        for (i = 0; i < this.OLI[index].length; ++i) {
          tmp = val[this.stringIndex[this.OLI[index][i]]];
          this.writeValue(tmp, typeCheck(tmp));
        }
      }
      if (type === DATE) {
        if (!implicit) this.append(typeByte);
        this.writeValue(val.getUTCFullYear(), SHORT, true);
        this.writeValue(val.getUTCMonth(), CHAR, true);
        this.writeValue(val.getUTCDate(), CHAR, true);
        this.writeValue(val.getUTCHours(), CHAR, true);
        this.writeValue(val.getUTCMinutes(), CHAR, true);
        this.writeValue(val.getUTCSeconds(), CHAR, true);
      }
      if (type === BUFFER) {
        if (!implicit) this.append(typeByte);
        for (i = 0; i < val.length; ++i) {
          this.writeValue(val[i], CHAR, true);
        }
      }
    },
    writeString: function (str) {
      var term = new Buffer(1);
      term[0] = 0;
      this.append(Buffer.concat([new Buffer(String(str)), term]));
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
        tmp = OLI[i].slice().sort(function (a, b) { return a - b });
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
  function gatherLayouts(val, stringIndex, ret, branch) {
    var keys, i;
    if (!ret) ret = [];
    if (branch === void 0) branch = val;
    if (typeof branch === 'object' && branch !== null) {
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
    if (typeof branch === 'object') {
      keys = Object.keys(branch);
      if (!Array.isArray(branch)) keys.forEach(function (v) { setPush(ret, v); });
      for (i = 0; i < keys.length; ++i) {
        gatherStrings(val, ret, branch[keys[i]]);
      }
    } else if (typeof branch === 'string') {
      setPush(ret, branch);
    }
    return ret;
  }
  function setPush(arr, val) {
    if (arr.indexOf(val) === -1) arr.push(val);
  }
  function parse(buf) {
    return $Parser(buf).parseSI().parseOLI().parseValue();
  }
  function bufferify(val) {
    return $Encoder(val).writeSI().writeOLI().writeData().export();
  }
  var LEON = {};

  LEON.parse = parse;
  LEON.bufferify = bufferify;
  return LEON;
})();