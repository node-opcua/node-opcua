var factories = require("./../misc/factories");

var ExtensionObject = function()  {

};
ExtensionObject.prototype._schema = { name:"ExtensionObject" };



var ec = require("./encode_decode");
// OPC-UA Part 6 - $5.2.2.15 ExtensionObject
// An ExtensionObject is encoded as sequence of bytes prefixed by the  NodeId of its
// DataTypeEncoding and the number of bytes encoded.
function encodeExtensionObject(object, stream) {

    if (!object) {
        ec.encodeNodeId(ec.makeNodeId(0), stream);
        stream.writeByte(0x00); // no body is encoded
        stream.writeUInt32(0);
    } else {
        ec.encodeNodeId(object.encodingDefaultBinary, stream);
        stream.writeByte(0x01); // 0x01 The body is encoded as a ByteString.
        stream.writeUInt32(object.binaryStoreSize());
        object.encode(stream);
    }
}

function decodeExtensionObject(stream) {

    var nodeId = ec.decodeNodeId(stream);
    var encodingType = stream.readByte();
    var length = stream.readUInt32();
    if (nodeId.value === 0 || encodingType === 0) {
        return null;
    }
    var object = factories.constructObject(nodeId);
    if (object === null) {
        // this object is unknown to us ..
        stream.length += length;
        return null;
    }
    object.decode(stream);
    return object;
}

exports.ExtensionObject =  ExtensionObject;

factories.registerBuiltInType("ExtensionObject",encodeExtensionObject,decodeExtensionObject,function () {return null;});
