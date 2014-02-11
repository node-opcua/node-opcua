var assert = require("assert");
var util   = require("util");

var Writable = require("stream").Writable;
var Readable = require("stream").Readable;

function BinaryReader(buffer) {
    this._buffer = buffer;
    Readable.call(this, {});
}
util.inherits(BinaryReader, Readable);

exports.BinaryReader = BinaryReader;

BinaryReader.prototype._read = function() {
    this.push(this._buffer);
    this.push(null);
};

function BinaryStream(data) {
    if (data === undefined) {
        this._buffer = new Buffer(1024);
    } else {
        if (data instanceof Buffer) {
            this._buffer = data;
        } else {
            this._buffer = new Buffer(data, "binary");
        }
    }
    this.length = 0;
}

BinaryStream.prototype.rewind = function () {
    this.length = 0;
};

BinaryStream.prototype.writeUByte = function (value) {
    assert(value >= 0 && value < 256);
    this._buffer.writeInt8(value, this.length);
    this.length += 1;
};

BinaryStream.prototype.writeByte = function (value) {
    assert(value >= 0 && value < 256);
    this._buffer.writeInt8(value, this.length);
    this.length += 1;
};

BinaryStream.prototype.writeUInt8 = function (value) {
    assert(value >= 0 && value < 256);
    this._buffer.writeUInt8(value, this.length);
    this.length += 1;
};

BinaryStream.prototype.writeInt16 = function (value) {
    this._buffer.writeInt16LE(value, this.length);
    this.length += 2;
};

BinaryStream.prototype.writeInteger = function (value) {
    this._buffer.writeInt32LE(value, this.length);
    this.length += 4;
};

BinaryStream.prototype.writeUInt32 = function (value) {
    this._buffer.writeUInt32LE(value, this.length);
    this.length += 4;
};

BinaryStream.prototype.writeUInt16 = function (value) {
    this._buffer.writeUInt16LE(value, this.length);
    this.length += 2;
};

BinaryStream.prototype.writeFloat = function (value) {
    this._buffer.writeFloatLE(value, this.length);
    this.length += 4;
};

BinaryStream.prototype.writeDouble = function (value) {
    this._buffer.writeDoubleLE(value, this.length);
    this.length += 8;
};

BinaryStream.prototype.readByte = function () {
    var retVal = this._buffer.readInt8(this.length);
    this.length += 1;
    return retVal;
};

BinaryStream.prototype.readUInt8 = function () {
    var retVal = this._buffer.readUInt8(this.length);
    this.length += 1;
    return retVal;
};

BinaryStream.prototype.readInt16 = function () {
    var retVal = this._buffer.readInt16LE(this.length);
    this.length += 2;
    return retVal;
};

BinaryStream.prototype.readInteger = function () {
    var retVal = this._buffer.readInt32LE(this.length);
    this.length += 4;
    return retVal;
};

BinaryStream.prototype.readUInt16 = function () {
    var retVal = this._buffer.readUInt16LE(this.length);
    this.length += 2;
    return retVal;
};

BinaryStream.prototype.readUInt32 = function () {
    var retVal = this._buffer.readUInt32LE(this.length);
    this.length += 4;
    return retVal;
};

BinaryStream.prototype.readFloat = function () {
    var retVal = this._buffer.readFloatLE(this.length);
    this.length += 4;
    return retVal;
};

BinaryStream.prototype.readDouble = function () {
    var retVal = this._buffer.readDoubleLE(this.length);
    this.length += 8;
    return retVal;
};

BinaryStream.prototype.writeRaw = function (buf,length) {

    this._buffer.write(buf,this.length,length);
    this.length += length;
};

BinaryStream.prototype.writeByteStream = function (buf) {

    if (!buf) {
        this.writeUInt32(0xFFFFFFFF);
        return;
    }
    var bufLen = buf.length;
    this.writeUInt32(buf.length);
    buf.copy(this._buffer, this.length,0,buf.length);
    this.length += bufLen;
};


BinaryStream.prototype.readByteStream = function () {
    var bufLen = this.readUInt32();
    if (bufLen === 0xFFFFFFFF) {
        return null;
    }
    if (bufLen === 0) {
        return new Buffer(0);
    }
    var buf = new Buffer(bufLen);
    this._buffer.copy(buf,0,this.length,this.length+ bufLen);
    this.length += bufLen;
    return buf;
};

exports.BinaryStream = BinaryStream;






function BinaryStreamSizeCalculator() {
    this.length = 0;
}

BinaryStreamSizeCalculator.prototype.rewind = function () {
    this.length = 0;
};

BinaryStreamSizeCalculator.prototype.writeByte = function (value) {
    this.length += 1;
};

BinaryStreamSizeCalculator.prototype.writeUInt8 = function (value) {
    this.length += 1;
};

BinaryStreamSizeCalculator.prototype.writeInt16 = function (value) {
    this.length += 2;
};

BinaryStreamSizeCalculator.prototype.writeInteger = function (value) {
    this.length += 4;
};

BinaryStreamSizeCalculator.prototype.writeUInt32 = function (value) {
    this.length += 4;
};

BinaryStreamSizeCalculator.prototype.writeUInt16 = function (value) {
    this.length += 2;
};

BinaryStreamSizeCalculator.prototype.writeFloat = function (value) {
    this.length += 4;
};

BinaryStreamSizeCalculator.prototype.writeDouble = function (value) {
    this.length += 8;
};

BinaryStreamSizeCalculator.prototype.writeByteStream = function (buf) {
    if(!buf) {
        this.writeUInt32(0);
    }else {
        this.writeUInt32(buf.length);
        this.length += buf.length;

    }
};
BinaryStreamSizeCalculator.prototype.writeRaw = function (buf,length) {
    this.length += length;
};


exports.BinaryStreamSizeCalculator = BinaryStreamSizeCalculator;
