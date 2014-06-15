var assert = require('better-assert');
var Enum = require("enum");

var ec = exports;
var _ = require("underscore");

var isValidGuid = require("./../datamodel/guid").isValidGuid;
var emptyGuid = require("./../datamodel/guid").emptyGuid;

var NodeIdType= exports.NodeIdType = require("./../datamodel/nodeid").NodeIdType;

var makeNodeId = exports.makeNodeId = require("./../datamodel/nodeid").makeNodeId;
exports.makeExpandedNodeId = require("./../datamodel/nodeid").makeExpandedNodeId;

var set_flag = require("./utils").set_flag;
var check_flag =  require("./utils").check_flag;

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomDouble(min, max) {
    return Math.random() * (max - min + 1) + min;
}

exports.isValidString = function(value) {
    return typeof value === "string";
};
exports.randomString = function() {
    var nbCar =getRandomInt(1,20);
    var cars = [];
    for (var i =0;i<nbCar; i++) {
        cars.push( String.fromCharCode(65 + getRandomInt(0,26)));
    }
    return cars.join("");
};
exports.decodeString = function (stream) {
    var value;
    var length = stream.readInteger();
    if (length === -1) {
        value = undefined;
    } else {
        value = stream._buffer.toString('binary', stream.length, stream.length + length);
        stream.length += length;
    }
    return value;
};
exports.encodeString = function (value, stream) {

    if (value === undefined || value === null) {
        stream.writeInteger(-1);
        return;
    }
    stream.writeInteger(value.length);
    stream.writeRaw(value, value.length);
};


exports.isValidUInt16 = function(value) {
    if (!_.isFinite(value)) return false;
    return value >=0 && value <= 0xFFFF;
};
exports.randomUInt16 = function() {
    return getRandomInt(0,0xFFFF);
};
exports.encodeUInt16 = function (value, stream) {
    stream.writeUInt16(value);
};
exports.decodeUInt16 = function (stream) {
    return stream.readUInt16();
};


exports.isValidInt16 = function(value) {
    if (!_.isFinite(value)) return false;
    return value >= -0x8000 && value <= 0x7FFF;
};
exports.randomInt16 = function() {
    return getRandomInt(-0x8000,0x7FFF);
};
exports.encodeInt16 = function (value, stream) {
    assert(_.isFinite(value));
    stream.writeInt16(value);
};
exports.decodeInt16 = function (stream) {
    return stream.readInt16();
};


exports.isValidInt32 = function(value) {
    if (!_.isFinite(value)) return false;
    return value >=-0x80000000 && value <= 0x7fffffff;
};
exports.randomInt32 = function() {
    return getRandomInt(-0x80000000,0x7fffffff);
};
exports.encodeInt32 = function (value, stream) {
    assert(_.isFinite(value));
    stream.writeInteger(value);
};
exports.decodeInt32 = function (stream) {
    return stream.readInteger();
};


exports.isValidUInt32 = function(value) {
    if (!_.isFinite(value)) return false;
    return value >=0 && value <= 0xFFFFFFFF;
};
exports.randomUInt32 = function() {
    return getRandomInt(0,0xFFFFFFFF);
};
exports.encodeUInt32 = function (value, stream) {
    stream.writeUInt32(value);
};
exports.decodeUInt32 = function (stream) {
    return stream.readUInt32();
};

isValidBoolean = exports.isValidBoolean = function(value) {
    return typeof value === "boolean";
};
exports.randomBoolean = function() {
    return getRandomInt(0,1) ? true : false;
};
exports.encodeBoolean = function (value, stream) {
    assert(isValidBoolean(value));
    stream.writeUInt8(value ? 1 : 0);
};
exports.decodeBoolean = function (stream) {
    return stream.readUInt8() ? true : false;
};

isValidInt8 = exports.isValidInt8 = function(value) {
    if (!_.isFinite(value)) return false;
    return value >=-0x80 && value <= 0x7F;
};
exports.randomInt8 = function() {
    return getRandomInt(-0x80,0x7F) ;
};
exports.encodeInt8 = function (value, stream) {
    assert(isValidInt8(value));
    stream.writeInt8(value);
};
exports.decodeInt8 = function (stream) {
    return stream.readInt8();
};


exports.isValidSByte = exports.isValidInt8;
exports.randomSByte = exports.randomInt8;
exports.encodeSByte = exports.encodeInt8;
exports.decodeSByte = exports.decodeInt8;


isValidUInt8 = exports.isValidUInt8 = function(value) {
    if (!_.isFinite(value)) return false;
    return value >=-0x00 && value <= 0xFF;
};
exports.randomUInt8 = function() {
    return getRandomInt(0x00,0xFF) ;
};
exports.encodeUInt8 = function (value, stream) {
    stream.writeUInt8(value);
};
exports.decodeUInt8 = function (stream) {
    return stream.readUInt8();
};

exports.isValidByte = exports.isValidUInt8;
exports.randomByte = exports.randomUInt8;
exports.encodeByte = exports.encodeUInt8;
exports.decodeByte = exports.decodeUInt8;

var minFloat = -3.40 * Math.pow(10,38);
var maxFloat =  3.40 * Math.pow(10,38);

exports.isValidFloat = function(value) {
    if (!_.isFinite(value)) return false;
    return value > minFloat && value < maxFloat;
};
exports.randomFloat = function() {
    return getRandomDouble(-1000, 1000);
};
exports.encodeFloat = function (value, stream) {
    stream.writeFloat(value);
};
exports.decodeFloat = function (stream) {
    return stream.readFloat();
};


exports.isValidDouble = function(value) {
    if (!_.isFinite(value)) return false;
    return true;
};
exports.randomDouble = function() {
    return getRandomDouble(-1000000, 1000000);
};
exports.encodeDouble = function (value, stream) {
    stream.writeDouble(value);
};
exports.decodeDouble = function (stream) {
    return stream.readDouble();
};


var offset_factor_1601 =(function () {

    // utc = Date.UTC(this.value.getYear(),this.value.getMonth()); // Number of second since January 1970
    var utc_offset = (new Date().getTimezoneOffset() * 60000);

    var utc1600 = new Date(1601, 0, 1);
    var t1600   = utc1600.getTime() + utc_offset;


    var utc1600_plus_one_day = new Date(1601, 0, 1+1);
    var t1600_1d = utc1600_plus_one_day.getTime() + utc_offset;

    var factor = (24*60*60*1000)*10000/(t1600_1d-t1600);

    var utc1970 = new Date(1970, 0, 1, 0, 0);
    var t1970   = utc1970.getTime() + utc_offset;


    var offset =  -t1600 + t1970;

    assert( factor === 10000);
    assert( offset === 11644473600000);
    return [offset,factor];


})();


var BigNumber = require('bignumber.js');

function dateToHundredNanoSecondFrom1601(date) {

    assert( date instanceof Date);
    var t = date.getTime(); // number of milliseconds since 1/1/70
    assert(new Date(t).getTime() === t);

    var offset = offset_factor_1601[0];
    var factor = offset_factor_1601[1];

    return (t + offset)*factor;
}
exports.dateToHundredNanoSecondFrom1601 =  dateToHundredNanoSecondFrom1601;

function bn_dateToHundredNanoSecondFrom1601(date) {
    assert( date instanceof Date);
    var t = date.getTime(); // number of milliseconds since 1/1/70
    assert(new Date(t).getTime() === t);

    var offset = offset_factor_1601[0];
    var factor = offset_factor_1601[1];

    var bn_value = new BigNumber(t).plus(offset).times(factor);

    var high = bn_value.div(0xFFFFFFFF).floor();
    var low  = bn_value.mod(0xFFFFFFFF);
//xx    console.log(" high =",high,"low = ",low);
    return [ parseInt(high.toS(),10),parseInt(low.toS(),10)];
}
exports.bn_dateToHundredNanoSecondFrom1601 = bn_dateToHundredNanoSecondFrom1601;

function bn_hundredNanoSecondFrom1601ToDate(high,low) {
    var offset = offset_factor_1601[0];
    var factor = offset_factor_1601[1];

    var value = new BigNumber(high).times(0xFFFFFFFF).plus(low).div(factor).minus(offset);
    value = parseInt(value,10);
    return new Date(value);
}

function hundredNanoSecondFrom1601ToDate(value) {
    var offset = offset_factor_1601[0];
    var factor = offset_factor_1601[1];
    value =  value/factor - offset;
    return new Date(value);
}

exports.hundredNanoSecondFrom1601ToDate = hundredNanoSecondFrom1601ToDate;

//  Date(year, month [, day, hours, minutes, seconds, ms])
exports.isValidDateTime = function(value) {
    return value instanceof Date;
};
exports.randomDateTime = function() {
    var r = getRandomInt;
    return new Date(
            1900+ r(0,200) , r(0,11) ,  r(0,28),
             r(0,24), r(0,59),r(0,59),r(0,1000));

};
exports.encodeDateTime = function(date, stream) {

    assert(date instanceof Date);
    var hl = bn_dateToHundredNanoSecondFrom1601(date);
    var hi = hl[0];
    var lo = hl[1];
    stream.writeUInt32(lo);
    stream.writeUInt32(hi);

    assert( date.toString() === bn_hundredNanoSecondFrom1601ToDate(hi,lo).toString());
};

exports.decodeDateTime = function(stream) {
    var lo= stream.readUInt32();
    var hi= stream.readUInt32();
    return bn_hundredNanoSecondFrom1601ToDate(hi,lo);
};


exports.emptyGuid = emptyGuid;
exports.isValidGuid = isValidGuid;
exports.randomGuid = function() {
    var BinaryStream = require("./binaryStream").BinaryStream;

    var b = new BinaryStream(20);
    for (var i=0;i<20;i++) {
        b.writeUInt8(getRandomInt(0,255));
    }
    b.rewind();
    var value =  exports.decodeGuid(b);
    return value;
};
exports.encodeGuid = function (guid, stream) {

    assert(isValidGuid(guid));
    //           1         2         3
    // 012345678901234567890123456789012345
    // |        |    |    | |  | | | | | |
    // 12345678-1234-1234-ABCD-0123456789AB

    function write_UInt32(starts) {
        starts.forEach(function(start){
            stream.writeUInt32(parseInt(guid.substr(start,8),16));
        });
    }
    function write_UInt16(starts) {
        starts.forEach(function(start){
            stream.writeUInt16(parseInt(guid.substr(start,4),16));
        });
    }
    function write_UInt8(starts) {
        starts.forEach(function(start){
            stream.writeUInt8(parseInt(guid.substr(start,2),16));
        });
    }

    write_UInt32([0]);
    write_UInt16([9,14]);
    write_UInt8([19,21,24,26,28,30,32,34]);
};

var toHex = require("./utils").toHex;

exports.decodeGuid = function (stream) {

    function read_UInt32() {
        return toHex(stream.readUInt32(), 8);
    }
    function read_UInt16() {
        return toHex(stream.readUInt16(), 4);
    }
    function read_UInt8() {
        return toHex(stream.readUInt8(), 2);
    }
    function read_many(func,nb) {
        var result = "";
        for (var i =0;i<nb;i++) { result += func(); }
        return result;
    }

    var data1 = read_UInt32();

    var data2 = read_UInt16();

    var data3 = read_UInt16();

    var data4_5 = read_many(read_UInt8,2);

    var data6_B = read_many(read_UInt8,6);

    var guid = data1 + "-" + data2 + "-" + data3 + "-" + data4_5 + "-" + data6_B;

    return guid.toUpperCase();
};







var EnumNodeIdEncoding = new Enum({
    TwoBytes:         0x00, // A numeric value that fits into the two byte representation.
    FourBytes:        0x01, // A numeric value that fits into the four byte representation.
    Numeric:          0x02, // A numeric value that does not fit into the two or four byte representations.
    String:           0x03, // A String value.
    Guid:             0x04, // A Guid value.
    ByteString:       0x05, // An opaque (ByteString) value.
    NamespaceUriFlag: 0x80, //  NamespaceUriFlag on  ExpandedNodeId is present
    ServerIndexFlag:  0x40  //  NamespaceUriFlag on  ExpandedNodeId is present
});




function is_uint8(value) {

    return value >= 0 && value <= 0xFF ;
}
function is_uint16(value) {

    return value >= 0 && value <= 0xFFFF ;
}

function nodeID_encodingByte(nodeId)
{

    assert(nodeId.hasOwnProperty("identifierType"));

    var encodingByte = 0;

    if (nodeId.identifierType.is(NodeIdType.NUMERIC)) {

        if ( is_uint8(nodeId.value)  && (!nodeId.namespace) && !nodeId.namespaceUri  && !nodeId.serverIndex) {

            encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.TwoBytes);

        } else if ( is_uint16(nodeId.value) && is_uint8(nodeId.namespace) && !nodeId.namespaceUri  && !nodeId.serverIndex) {

            encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.FourBytes);

        } else {
            encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.Numeric);
        }

    } else if (nodeId.identifierType.is(NodeIdType.STRING)) {

        encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.String);

    } else if (nodeId.identifierType.is(NodeIdType.BYTESTRING)) {
        encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.ByteString);

    } else if (nodeId.identifierType.is(NodeIdType.GUID)) {
        encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.Guid);
    }

    if (nodeId.hasOwnProperty("namespaceUri") && nodeId.namespaceUri ) {
        encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.NamespaceUriFlag);
    }
    if (nodeId.hasOwnProperty("serverIndex") && nodeId.serverIndex ) {
        encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.ServerIndexFlag);
    }
    return encodingByte;
}


exports.isValidNodeId = function(nodeId) {
    return  nodeId.hasOwnProperty("identifierType")
        ;
};
exports.randomNodeId = function() {

  var value = getRandomInt(0,0xFFFFF);
  var namespace = getRandomInt(0,3);
  return  makeNodeId(value,namespace);
};

exports.encodeNodeId = function(nodeId,stream) {

    var encoding_byte = nodeID_encodingByte(nodeId);

    stream.writeUInt8(encoding_byte);// encoding byte

    encoding_byte =  encoding_byte & 0x3F;

    switch(encoding_byte) {
        case EnumNodeIdEncoding.TwoBytes.value:
            stream.writeUInt8(nodeId.value);
            break;
        case EnumNodeIdEncoding.FourBytes.value:
            stream.writeUInt8(nodeId.namespace);
            stream.writeUInt16(nodeId.value);
            break;
        case EnumNodeIdEncoding.Numeric.value:
            stream.writeUInt16(nodeId.namespace);
            stream.writeUInt32(nodeId.value);
            break;
        case EnumNodeIdEncoding.String.value:
            stream.writeUInt16(nodeId.namespace);
            ec.encodeString(nodeId.value,stream);
            break;
        case EnumNodeIdEncoding.ByteString.value:
            stream.writeUInt16(nodeId.namespace);
            ec.encodeByteString(nodeId.value,stream);
            break;
        default:
            assert( encoding_byte === EnumNodeIdEncoding.Guid.value);
            stream.writeUInt16(nodeId.namespace);
            ec.encodeGuid(nodeId.value,stream);
            break;
    }

};

var _decodeNodeId = function(encoding_byte,stream) {

    var value,namespace;
    switch(encoding_byte & 0x3F) {
        case EnumNodeIdEncoding.TwoBytes.value:
            value = stream.readUInt8();
            break;
        case EnumNodeIdEncoding.FourBytes.value:
            namespace = stream.readUInt8();
            value = stream.readUInt16();
            break;
        case EnumNodeIdEncoding.Numeric.value:
            namespace = stream.readUInt16();
            value = stream.readUInt32(stream);
            break;
        case EnumNodeIdEncoding.String.value:
            namespace = stream.readUInt16();
            value = ec.decodeString(stream);
            break;
        case EnumNodeIdEncoding.ByteString.value:
            namespace = stream.readUInt16();
            value = ec.decodeByteString(stream);
            break;
        default:
            assert( encoding_byte === EnumNodeIdEncoding.Guid.value ," encoding_byte = " + encoding_byte.toString(16));
            namespace = stream.readUInt16();
            value=ec.decodeGuid(stream);
            assert(isValidGuid(value));
            break;
    }
    return makeNodeId(value,namespace);
};

exports.decodeNodeId = function(stream) {
    var encoding_byte = stream.readUInt8();
    return _decodeNodeId(encoding_byte,stream);
};





exports.encodeExpandedNodeId = function(expandedNodeId, stream) {

    var encodingByte = nodeID_encodingByte(expandedNodeId);
    exports.encodeNodeId(expandedNodeId,stream);
    if (check_flag(encodingByte,EnumNodeIdEncoding.NamespaceUriFlag)) {
        exports.encodeString(expandedNodeId.namespaceUri,stream);
    }
    if(check_flag(encodingByte,EnumNodeIdEncoding.ServerIndexFlag)) {
        exports.encodeUInt32(expandedNodeId.serverIndex,stream);
    }
};

exports.decodeExpandedNodeId = function(stream) {

    var encoding_byte = stream.readUInt8();
    var expandedNodeId = _decodeNodeId(encoding_byte,stream);
    expandedNodeId.namespaceUri = null;
    expandedNodeId.serverIndex = 0;

    if (check_flag(encoding_byte,EnumNodeIdEncoding.NamespaceUriFlag)) {
        expandedNodeId.namespaceUri = ec.decodeString(stream);
    }
    if(check_flag(encoding_byte,EnumNodeIdEncoding.ServerIndexFlag)) {
        expandedNodeId.serverIndex = ec.decodeUInt32(stream);
    }
    return expandedNodeId;
};



exports.encodeLocaleId = ec.encodeString;
exports.decodeLocaleId = ec.decodeString;

exports.validateLocaleId = function( /*value*/) {
    // TODO : check that localeID is well-formed
    // see part 3 $8.4 page 63

    return true;
};

exports.isValidByteString = function(value) {
    return value === null ||  value instanceof Buffer;
};
exports.randomByteString = function(value, len) {
    len = len || getRandomInt(1,200);
    var b = new Buffer(len);
    for(var i=0;i< len;i++) {
        b.writeUInt8(getRandomInt(0,255),i);
    }
    return b;
};
exports.encodeByteString = function(byteString,stream) {
    stream.writeByteStream(byteString);
};

exports.decodeByteString = function(stream) {
    return stream.readByteStream();
};

exports.decodeStatusCode = require("./../datamodel/opcua_status_code").decodeStatusCode;
exports.encodeStatusCode = require("./../datamodel/opcua_status_code").encodeStatusCode;