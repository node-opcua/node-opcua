"use strict";

var Enum = require("node-opcua-enum");
var assert = require("node-opcua-assert");

var makeNodeId = exports.makeNodeId = require("node-opcua-nodeid").makeNodeId;
var NodeIdType = exports.NodeIdType = require("node-opcua-nodeid").NodeIdType;
var NodeId = require("node-opcua-nodeid").NodeId;

var ExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").ExpandedNodeId;
var set_flag = require("node-opcua-utils").set_flag;
var check_flag = require("node-opcua-utils").check_flag;

var isValidGuid= require("./guid").isValidGuid;

var decodeGuid= require("./guid").decodeGuid;
var decodeString = require("./string").decodeString;
var decodeByteString = require("./byte_string").decodeByteString;
var decodeUInt32 = require("./integers").decodeUInt32;

var encodeGuid= require("./guid").encodeGuid;
var encodeString = require("./string").encodeString;
var encodeByteString = require("./byte_string").encodeByteString;
var encodeUInt32 = require("./integers").encodeUInt32;

var getRandomInt = require("./utils").getRandomInt;

var EnumNodeIdEncoding = new Enum({
    TwoBytes: 0x00, // A numeric value that fits into the two byte representation.
    FourBytes: 0x01, // A numeric value that fits into the four byte representation.
    Numeric: 0x02, // A numeric value that does not fit into the two or four byte representations.
    String: 0x03, // A String value.
    Guid: 0x04, // A Guid value.
    ByteString: 0x05, // An opaque (ByteString) value.
    NamespaceUriFlag: 0x80, //  NamespaceUriFlag on  ExpandedNodeId is present
    ServerIndexFlag: 0x40  //  NamespaceUriFlag on  ExpandedNodeId is present
});


function is_uint8(value) {

    return value >= 0 && value <= 0xFF;
}
function is_uint16(value) {

    return value >= 0 && value <= 0xFFFF;
}

function nodeID_encodingByte(nodeId) {

    if (!nodeId) {
        return 0;
    }
    assert(nodeId.hasOwnProperty("identifierType"));

    var encodingByte = 0;

    if (nodeId.identifierType.is(NodeIdType.NUMERIC)) {

        if (is_uint8(nodeId.value) && (!nodeId.namespace) && !nodeId.namespaceUri && !nodeId.serverIndex) {

            encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.TwoBytes);

        } else if (is_uint16(nodeId.value) && is_uint8(nodeId.namespace) && !nodeId.namespaceUri && !nodeId.serverIndex) {

            encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.FourBytes);

        } else {
            encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.Numeric);
        }

    } else if (nodeId.identifierType.is(NodeIdType.STRING)) {

        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.String);

    } else if (nodeId.identifierType.is(NodeIdType.BYTESTRING)) {
        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.ByteString);

    } else if (nodeId.identifierType.is(NodeIdType.GUID)) {
        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.Guid);
    }

    if (nodeId.hasOwnProperty("namespaceUri") && nodeId.namespaceUri) {
        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.NamespaceUriFlag);
    }
    if (nodeId.hasOwnProperty("serverIndex") && nodeId.serverIndex) {
        encodingByte = set_flag(encodingByte, EnumNodeIdEncoding.ServerIndexFlag);
    }
    return encodingByte;
}


exports.isValidNodeId = function (nodeId) {
    if (nodeId === null || nodeId === void 0) {
        return false;
    }
    return nodeId.hasOwnProperty("identifierType")
      ;
};
exports.randomNodeId = function () {

    var value = getRandomInt(0, 0xFFFFF);
    var namespace = getRandomInt(0, 3);
    return makeNodeId(value, namespace);
};


function _encodeNodeId(encoding_byte, nodeId, stream) {

    stream.writeUInt8(encoding_byte);// encoding byte

    /*jslint bitwise: true */
    encoding_byte &= 0x3F;

    switch (encoding_byte) {
        case EnumNodeIdEncoding.TwoBytes.value:
            stream.writeUInt8(nodeId ? nodeId.value : 0);
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
            encodeString(nodeId.value, stream);
            break;
        case EnumNodeIdEncoding.ByteString.value:
            stream.writeUInt16(nodeId.namespace);
            encodeByteString(nodeId.value, stream);
            break;
        default:
            assert(encoding_byte === EnumNodeIdEncoding.Guid.value);
            stream.writeUInt16(nodeId.namespace);
            encodeGuid(nodeId.value, stream);
            break;
    }

}

exports.encodeNodeId = function (nodeId, stream) {

    var encoding_byte = nodeID_encodingByte(nodeId);
    /*jslint bitwise: true */
    encoding_byte &= 0x3F;
    _encodeNodeId(encoding_byte, nodeId, stream);

};

exports.encodeExpandedNodeId = function (expandedNodeId, stream) {
    assert(expandedNodeId,"encodeExpandedNodeId: must provide a valid expandedNodeId");
    var encodingByte = nodeID_encodingByte(expandedNodeId);
    _encodeNodeId(encodingByte, expandedNodeId, stream);
    if (check_flag(encodingByte, EnumNodeIdEncoding.NamespaceUriFlag)) {
        encodeString(expandedNodeId.namespaceUri, stream);
    }
    if (check_flag(encodingByte, EnumNodeIdEncoding.ServerIndexFlag)) {
        encodeUInt32(expandedNodeId.serverIndex, stream);
    }
};

var _decodeNodeId = function (encoding_byte, stream) {

    var value, namespace, nodeIdType;
    /*jslint bitwise: true */
    encoding_byte &= 0x3F;

    switch (encoding_byte) {
        case EnumNodeIdEncoding.TwoBytes.value:
            value = stream.readUInt8();
            nodeIdType = NodeIdType.NUMERIC;
            break;
        case EnumNodeIdEncoding.FourBytes.value:
            namespace = stream.readUInt8();
            value = stream.readUInt16();
            nodeIdType = NodeIdType.NUMERIC;
            break;
        case EnumNodeIdEncoding.Numeric.value:
            namespace = stream.readUInt16();
            value = stream.readUInt32(stream);
            nodeIdType = NodeIdType.NUMERIC;
            break;
        case EnumNodeIdEncoding.String.value:
            namespace = stream.readUInt16();
            value = decodeString(stream);
            nodeIdType = NodeIdType.STRING;
            break;
        case EnumNodeIdEncoding.ByteString.value:
            namespace = stream.readUInt16();
            value = decodeByteString(stream);
            nodeIdType = NodeIdType.BYTESTRING;
            break;
        default:
            if (encoding_byte !== EnumNodeIdEncoding.Guid.value) {
                /*jslint bitwise: true */
                console.log(" encoding_byte = " + encoding_byte.toString(16), encoding_byte, encoding_byte & 0x3F);
                throw new Error(" encoding_byte = " + encoding_byte.toString(16));
            }
            namespace = stream.readUInt16();
            value = decodeGuid(stream);
            nodeIdType = NodeIdType.GUID;
            assert(isValidGuid(value));
            break;
    }
    return new NodeId(nodeIdType, value, namespace);
};

exports.decodeNodeId = function (stream) {
    var encoding_byte = stream.readUInt8();
    return _decodeNodeId(encoding_byte, stream);
};


exports.decodeExpandedNodeId = function (stream) {

    var encoding_byte = stream.readUInt8();
    var expandedNodeId = _decodeNodeId(encoding_byte, stream);
    expandedNodeId.namespaceUri = null;
    expandedNodeId.serverIndex = 0;

    if (check_flag(encoding_byte, EnumNodeIdEncoding.NamespaceUriFlag)) {
        expandedNodeId.namespaceUri = decodeString(stream);
    }
    if (check_flag(encoding_byte, EnumNodeIdEncoding.ServerIndexFlag)) {
        expandedNodeId.serverIndex = decodeUInt32(stream);
    }
    var e = expandedNodeId;
    return new ExpandedNodeId( e.identifierType, e.value,e.namespace, e.namespaceUri, e.serverIndex);
};

exports.coerceNodeId = require("node-opcua-nodeid").coerceNodeId;
exports.coerceExpandedNodeId = require("node-opcua-nodeid/src/expanded_nodeid").coerceExpandedNodeId;