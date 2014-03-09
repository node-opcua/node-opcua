var assert = require('better-assert');
var Enum = require("enum");

var ec = exports;
var _ = require("underscore");

var isValidGUID = require("./guid").isValidGUID;
var is_guid = require("./guid").is_guid;

var NodeIdType= exports.NodeIdType = require("./nodeid").NodeIdType;

var makeNodeId = exports.makeNodeId = require("./nodeid").makeNodeId;
exports.makeExpandedNodeId = require("./nodeid").makeExpandedNodeId;

var set_flag = require("./utils").set_flag;
var check_flag =  require("./utils").check_flag;



exports.decodeUAString = function (stream) {
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

exports.encodeUAString = function (value, stream) {

    if (value === undefined || value === null) {
        stream.writeInteger(-1);
        return;
    }
    stream.writeInteger(value.length);
    stream.writeRaw(value, value.length);
};


exports.encodeUInt16 = function (value, stream) {
    stream.writeUInt16(value);
};

exports.decodeUInt16 = function (stream) {
    return stream.readUInt16();
};


exports.encodeInt16 = function (value, stream) {
    assert(_.isFinite(value));
    stream.writeInt16(value);
};

exports.decodeInt16 = function (stream) {
    return stream.readInt16();
};

exports.encodeInt32 = function (value, stream) {
    assert(_.isFinite(value));
    stream.writeInteger(value);
};

exports.decodeInt32 = function (stream) {
    return stream.readInteger();
};


exports.encodeUInt32 = function (value, stream) {
    stream.writeUInt32(value);
};

exports.decodeUInt32 = function (stream) {
    return stream.readUInt32();
};

exports.encodeBoolean = function (value, stream) {
    assert(typeof value === "boolean");
    stream.writeByte(value ? 1 : 0);
};

exports.decodeBoolean = function (stream) {
    return stream.readByte() ? true : false;
};

exports.encodeByte = function (value, stream) {
    stream.writeByte(value);
};

exports.decodeByte = function (stream) {
    return stream.readByte();
};

exports.encodeUInt8 = function (value, stream) {
    stream.writeUInt8(value);
};

exports.decodeUInt8 = function (stream) {
    return stream.readUInt8();
};

exports.encodeFloat = function (value, stream) {
    stream.writeFloat(value);
};

exports.decodeFloat = function (stream) {
    return stream.readFloat();
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



exports.encodeGUID = function (guid, stream) {

    assert(isValidGUID(guid));
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

exports.decodeGUID = function (stream) {

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



function nodeID_encodingByte(nodeId)
{

    assert(nodeId.hasOwnProperty("identifierType"));

    var encodingByte = 0;

    if (nodeId.identifierType.is(NodeIdType.NUMERIC)) {

        if (nodeId.value < 255 && (!nodeId.namespace) && !nodeId.namespaceUri  && !nodeId.serverIndex) {
            encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.TwoBytes);
        } else if (nodeId.value <= 65535 && nodeId.namespace >= 0 && nodeId.namespace <= 255 && !nodeId.namespaceUri  && !nodeId.serverIndex) {
            encodingByte = set_flag(encodingByte,EnumNodeIdEncoding.FourBytes);
            return encodingByte;
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


exports.encodeNodeId = function(nodeId,stream)
{
    var encoding_byte = nodeID_encodingByte(nodeId);

    stream.writeUInt8(encoding_byte);// encoding byte

    encoding_byte =  encoding_byte & 0x3F;

    switch(encoding_byte) {
        case EnumNodeIdEncoding.TwoBytes.value:
            stream.writeByte(nodeId.value);
            break;
        case EnumNodeIdEncoding.FourBytes.value:
            assert(_.isNumber(nodeId.namespace));
            stream.writeByte(nodeId.namespace);
            stream.writeInt16(nodeId.value);
            break;
        case EnumNodeIdEncoding.Numeric.value:
            assert(_.isNumber(nodeId.namespace));
            stream.writeInt16(nodeId.namespace);
            stream.writeUInt32(nodeId.value);
            break;
        case EnumNodeIdEncoding.String.value:
            assert(_.isNumber(nodeId.namespace));
            stream.writeInt16(nodeId.namespace);
            ec.encodeUAString(nodeId.value,stream);
            break;
        case EnumNodeIdEncoding.ByteString.value:
            assert(_.isNumber(nodeId.namespace));
            assert(nodeId.value instanceof Buffer);
            stream.writeInt16(nodeId.namespace);
            ec.encodeByteString(nodeId.value,stream);
            break;
        default:
            assert( encoding_byte === EnumNodeIdEncoding.Guid.value , " encoding_byte = " + encoding_byte);
            stream.writeInt16(nodeId.namespace);
            ec.encodeGUID(nodeId.value,stream);
            break;
    }

};

var _decodeNodeId = function(encoding_byte,stream) {

    var nodeId = { value: 0, namespace: null};
    var value,namespace;
    switch(encoding_byte & 0x3F) {
        case EnumNodeIdEncoding.TwoBytes.value:
            value = stream.readByte();
            break;
        case EnumNodeIdEncoding.FourBytes.value:
            namespace = stream.readByte();
            value = stream.readInt16();
            break;
        case EnumNodeIdEncoding.Numeric.value:
            namespace = stream.readInt16();
            value = stream.readUInt32(stream);
            break;
        case EnumNodeIdEncoding.String.value:
            namespace = stream.readInt16();
            value = ec.decodeUAString(stream);
            break;
        case EnumNodeIdEncoding.ByteString.value:
            namespace = stream.readInt16();
            value = ec.decodeByteString(stream);
            break;
        default:
            assert( encoding_byte === EnumNodeIdEncoding.Guid.value ," encoding_byte = " + encoding_byte.toString(16));
            namespace = stream.readInt16();
            value=ec.decodeGUID(stream);
            assert(is_guid(value));
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
        exports.encodeUAString(expandedNodeId.namespaceUri,stream);
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
        expandedNodeId.namespaceUri = ec.decodeUAString(stream);
    }
    if(check_flag(encoding_byte,EnumNodeIdEncoding.ServerIndexFlag)) {
        expandedNodeId.serverIndex = ec.decodeUInt32(stream);
    }
    return expandedNodeId;
};



exports.encodeLocaleId = ec.encodeUAString;
exports.decodeLocaleId = ec.decodeUAString;

exports.validateLocaleId = function( /*value*/) {
    // TODO : check that localeID is well-formed
    // see part 3 $8.4 page 63

    return true;
};

exports.encodeByteString = function(byteString,stream) {
    stream.writeByteStream(byteString);
};

exports.decodeByteString = function(stream) {
    return stream.readByteStream();
};

exports.decodeStatusCode = require("./opcua_status_code").decodeStatusCode;
exports.encodeStatusCode = require("./opcua_status_code").encodeStatusCode;