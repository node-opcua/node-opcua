var BinaryStream = require("./binaryStream").BinaryStream;
var assert = require("assert");

var ec = exports;
var util = require("util");

exports.decodeUAString = function (stream) {
    var value;
    var length = stream.readInteger();
    if (length == -1) {
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
    stream.writeInt16(value);
};

exports.decodeInt16 = function (stream) {
    return stream.readInt16();
};

exports.encodeInt32 = function (value, stream) {
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


var offset_factor_1601 = function () {

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


}();



function dateToHundredNanoSecondFrom1601(date) {

    assert( date instanceof Date);
    var t = date.getTime(); // number of milliseconds since 1/1/70
    assert(new Date(t).getTime() === t);

    var offset = offset_factor_1601[0];
    var factor = offset_factor_1601[1];

    return (t + offset)*factor;
}

exports.dateToHundredNanoSecondFrom1601 =  dateToHundredNanoSecondFrom1601;

function hundredNanoSecondFrom1601ToDate(value) {
    var offset = offset_factor_1601[0];
    var factor = offset_factor_1601[1];
    // console.log("value = ",value, offset,factor ,  value/factor - offset);
    value =  value/factor - offset;
    return new Date(value);
}

exports.hundredNanoSecondFrom1601ToDate = hundredNanoSecondFrom1601ToDate;


//                0123456789012345
var MAX_INT64 = 0x8FFFFFFFFFFFFFFF;

exports.encodeDateTime = function(date, stream) {

    assert(date instanceof Date);
    var longValue = dateToHundredNanoSecondFrom1601(date);
    assert(longValue>=0 && longValue <= MAX_INT64);
    var lo = longValue % 0xFFFFFFFF;
    var hi = Math.floor(longValue / 0xFFFFFFFF);
    stream.writeUInt32(lo);
    stream.writeUInt32(hi);
};

exports.decodeDateTime = function(stream) {
    var lo= stream.readUInt32();
    var hi= stream.readUInt32();
    var value = hi * 0xFFFFFFFF + lo;
    return hundredNanoSecondFrom1601ToDate(value);
};

exports.isValidGUID = function (guid) {
    assert(guid.length == 36)
};


exports.encodeGUID = function (guid, stream) {

    exports.isValidGUID(guid);
    //            1         2         3
    //  0123456789012345678901234567890123456
    //           |    |    | |  |
    // “72962B91-FA75-4AE6-8D28-B404DC7DAF63”
    stream.writeUInt32(parseInt("0x" + guid.substr(0, 8)));

    stream.writeUInt16(parseInt("0x" + guid.substr(9, 4)));

    stream.writeUInt16(parseInt("0x" + guid.substr(14, 4)));

    stream.writeUInt8(parseInt("0x" + guid.substr(19, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(21, 2)));

    stream.writeUInt8(parseInt("0x" + guid.substr(24, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(26, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(28, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(30, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(32, 2)));
    stream.writeUInt8(parseInt("0x" + guid.substr(34, 2)));

};

function toHex(i, nb) {
    return ("000000000000000" + i.toString(16)).substr(-nb)
}

exports.decodeGUID = function (stream) {

    var data1 = toHex(stream.readUInt32(), 8);

    var data2 = toHex(stream.readUInt16(), 4);

    var data3 = toHex(stream.readUInt16(), 4);

    var data4 = toHex(stream.readUInt8(), 2);
    var data5 = toHex(stream.readUInt8(), 2);

    var data6 = toHex(stream.readUInt8(), 2);
    var data7 = toHex(stream.readUInt8(), 2);

    var data8 = toHex(stream.readUInt8(), 2);
    var data9 = toHex(stream.readUInt8(), 2);
    var dataA = toHex(stream.readUInt8(), 2);
    var dataB = toHex(stream.readUInt8(), 2);

    var guid = data1 + "-" + data2 + "-" + data3 + "-" + data4 + data5 + "-" +
        data6 + data7 + data8 + data9 + dataA + dataB;
    return guid.toUpperCase();
};

var Enum = require("enum");
var NodeIdType = new Enum({
    NUMERIC:          0x01,
    STRING:           0x02,
    GUID:             0x03,
    BYTESTRING:       0x04
});
exports.NodeIdType = NodeIdType;


var re = new RegExp("\"", 'g');
function nodeId_toString() {
    return JSON.stringify(this).replace(re,"");
}

var makeNodeId = function makeNodeId(value,namespace) {

    value = value || 0;
    namespace = namespace || 0;

    var identifierType = NodeIdType.NUMERIC;
    if (typeof value == "string" ) {
        identifierType=  NodeIdType.STRING;
    }

    var nodeId = { identifierType: identifierType , value: value, namespace: namespace};

    nodeId.toString = nodeId_toString;
    return nodeId;
};
exports.makeNodeId = makeNodeId;


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

    if (nodeId.identifierType === NodeIdType.NUMERIC) {

        if (nodeId.value < 255 && (!nodeId.namespace) && !nodeId.namespaceUri  && !nodeId.serverIndex) {
            return EnumNodeIdEncoding.TwoBytes;
        } else if (nodeId.value <= 65535 && nodeId.namespace >= 0 && nodeId.namespace <= 255 && !nodeId.namespaceUri  && !nodeId.serverIndex) {
            return EnumNodeIdEncoding.FourBytes;
        } else {
            encodingByte =  EnumNodeIdEncoding.Numeric;
        }

    } else if (nodeId.identifierType === NodeIdType.STRING) {
        encodingByte =  EnumNodeIdEncoding.String;

    } else if (nodeId.identifierType === NodeIdType.BYTESTRING ) {
        encodingByte =  EnumNodeIdEncoding.ByteString;

    } else if (nodeId.identifierType === NodeIdType.GUID ) {
        encodingByte =  EnumNodeIdEncoding.Guid;
    }

    if (nodeId.hasOwnProperty("namespaceUri") ) {
        encodingByte |= EnumNodeIdEncoding.NamespaceUriFlag;
    }
    if (nodeId.hasOwnProperty("serverIndexFlag") ) {
        encodingByte |= EnumNodeIdEncoding.ServerIndexFlag;
    }
    return encodingByte;
}


exports.encodeNodeId = function(nodeId,stream)
{
    var encoding_byte = nodeID_encodingByte(nodeId);

    stream.writeByte(encoding_byte.value);// encoding byte

    switch(encoding_byte) {
        case EnumNodeIdEncoding.TwoBytes:
            stream.writeByte(nodeId.value);
            break;
        case EnumNodeIdEncoding.FourBytes:
            stream.writeByte(nodeId.namespace);
            stream.writeInt16(nodeId.value);
            break;
        case EnumNodeIdEncoding.Numeric:
            stream.writeInt16(nodeId.namespace);
            stream.writeUInt32(nodeId.value);
            break;
        case EnumNodeIdEncoding.String:
            stream.writeInt16(nodeId.namespace);
            ec.encodeUAString(nodeId.value,stream);
            break;
        default:
            throw new Error("encodeNodeId: invalid nodeId { or Not Implemented yet} " + encoding_byte);
            break;
    }

};

var _decodeNodeId = function(encoding_byte,stream) {

    var nodeId = { value: 0, namespace: null};
    var value,namespace;
    switch(encoding_byte) {
        case EnumNodeIdEncoding.TwoBytes:
            value = stream.readByte();
            break;
        case EnumNodeIdEncoding.FourBytes:
            namespace = stream.readByte();
            value = stream.readInt16();
            break;
        case EnumNodeIdEncoding.Numeric:
            namespace = stream.readInt16();
            value = stream.readUInt32(stream);
            break;
        case EnumNodeIdEncoding.String:
            namespace = stream.readInt16();
            value = ec.decodeUAString(stream);
            break;
        default:
            throw new Error("_decodeNodeId : invalid nodeId { or Not Implemented yet} "+encoding_byte );
            break;
    }
    return makeNodeId(value,namespace);
};

exports.decodeNodeId = function(stream)
{
    var encoding_byte = EnumNodeIdEncoding.get(stream.readByte());
    return _decodeNodeId(encoding_byte,stream);
}

//------
// An ExpandedNodeId extends the NodeId structure by allowing the NamespaceUri to be
// explicitly specified instead of using the NamespaceIndex. The NamespaceUri is optional. If it
// is specified then the NamespaceIndex inside the NodeId shall be ignored.
//
// The ExpandedNodeId is encoded by first encoding a NodeId as described in Clause 5 .2.2.9
// and then encoding NamespaceUri as a String.
//
// An instance of an ExpandedNodeId may still use the NamespaceIndex instead of the
// NamespaceUri. In this case, the NamespaceUri is not encoded in the stream. The presence of
// the NamespaceUri in the stream is indicated by setting the NamespaceUri flag in the encoding
// format byte for the NodeId.
//
// If the NamespaceUri is present then the encoder shall encode the NamespaceIndex as 0 in
// the stream when the NodeId portion is encoded. The unused NamespaceIndex is included in
// the stream for consistency,
//
// An ExpandedNodeId may also have a ServerIndex which is encoded as a UInt32 after the
// NamespaceUri. The ServerIndex flag in the NodeId encoding byte indicates whether the
// ServerIndex is present in the stream. The ServerIndex is omitted if it is equal to zero.
//
exports.makeExpandedNodeId = function makeExpandedNodeId(value,namespace) {

    value = parseInt(value) || 0;
    namespace = namespace || 0;
    serverIndex = 0;
    namespaceUri = null;

    var nodeId= {
        identifierType: NodeIdType.NUMERIC,
        value: value,
        namespace: namespace,
        namespaceUri: namespaceUri,
        serverIndex: serverIndex
    };

    nodeId.toString = nodeId_toString;
    return nodeId;
};

exports.encodeExpandedNodeId = function(expandedNodeId, stream) {

    var encodingByte = nodeID_encodingByte(expandedNodeId);
    exports.encodeNodeId(expandedNodeId,stream);
    if (encodingByte.has(EnumNodeIdEncoding.NamespaceUriFlag)) {
        ec.encodeString(expandedNodeId.namespaceUri,stream);
    }
    if(encodingByte.has(EnumNodeIdEncoding.ServerIndexFlag)) {
        ec.encodeUInt32(expandedNodeId.serverIndex,stream);
    }
};

exports.decodeExpandedNodeId = function(stream) {

    var encoding_byte = EnumNodeIdEncoding.get(stream.readByte());
    var expandedNodeId = _decodeNodeId(encoding_byte,stream);
    expandedNodeId.namespaceUri = null;
    expandedNodeId.serverIndex = 0;

    if (encoding_byte.has(EnumNodeIdEncoding.NamespaceUriFlag)) {
        expandedNodeId.namespaceUri = ec.encodeString(stream);
    }
    if(encoding_byte.has(EnumNodeIdEncoding.ServerIndexFlag)) {
        expandedNodeId.serverIndex = ec.encodeUInt32(stream);
    }
    return expandedNodeId;
};



exports.encodeLocaleId = ec.encodeUAString;
exports.decodeLocaleId = ec.decodeUAString;

exports.validateLocaleId = function( value) {
    // TODO : check that localeID is wellformed
    // see part 3 $8.4 page 63
    return true;
};

exports.encodeByteString = function(byteString,stream) {
    stream.writeByteStream(byteString);
};

exports.decodeByteString = function(stream) {
    return stream.readByteStream();
};

