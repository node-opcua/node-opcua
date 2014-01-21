var assert = require("assert");


function BinaryStream(data)
{
    if (data === undefined) {
        this.stream = new Buffer(1000);
    } else  {
        this.stream = new Buffer(data,"binary");
    }
    this.length = 0;
}

BinaryStream.prototype.rewind = function()
{
    this.length = 0;
};


BinaryStream.prototype.writeByte = function(value)
{
    assert(value>=0 && value <256);
    this.stream.writeInt8(value,this.length);
    this.length += 1;
};

BinaryStream.prototype.writeInt16 = function(value)
{
    this.stream.writeInt16LE(value,this.length);
    this.length += 2;
};
BinaryStream.prototype.writeInteger = function(value)
{
    this.stream.writeInt32LE(value,this.length);
    this.length += 4;
};
BinaryStream.prototype.writeFloat = function(value)
{
    this.stream.writeFloatLE(value,this.length);
    this.length += 4;
};
BinaryStream.prototype.writeDouble = function(value)
{
    this.stream.writeDoubleLE(value,this.length);
    this.length += 8;
};


BinaryStream.prototype.readByte = function()
{
    var retVal = this.stream.readInt8(this.length);
    this.length += 1;
    return retVal;
};

BinaryStream.prototype.readInt16 = function()
{
    var retVal = this.stream.readInt16LE(this.length);
    this.length += 2;
    return retVal;
};

BinaryStream.prototype.readInteger = function()
{
    var retVal = this.stream.readInt32LE(this.length);
    this.length += 4;
    return retVal;
};

BinaryStream.prototype.readFloat = function()
{
    var retVal = this.stream.readFloatLE(this.length);
    this.length += 4;
    return retVal;
};
BinaryStream.prototype.readDouble = function()
{
    var retVal = this.stream.readDoubleLE(this.length);
    this.length += 8;
    return retVal;
};

exports.BinaryStream = BinaryStream;
