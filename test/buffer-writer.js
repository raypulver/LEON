function BufferWriter (buf) {
  if (!(this instanceof BufferWriter)) return new BufferWriter(buf);
  if (Buffer.isBuffer(buf)) {
    this.buffer = buf;
  } else {
    this.buffer = new Buffer(0);
  }
}
BufferWriter.prototype.append = function (bytes) {
  var tmp = new Buffer(1);
  if (Array.isArray(bytes)) {
    bytes.forEach(function (v, i) {
      tmp.writeUInt8(v, 0);
      this.buffer = bConcat(this.buffer, tmp);
    }, this);
  } else {
    tmp.writeUInt8(bytes, 0);
    this.buffer = bConcat(this.buffer, bytes);
  }
}

function bConcat(a, b) {
  return Buffer.concat([a, b]);
}
module.exports = BufferWriter;
