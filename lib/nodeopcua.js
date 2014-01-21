var assert = require("assert");

var BinaryStream = require("./binaryStream").BinaryStream;
var ec = require("./encoding_decoding");

/**
 * flag : boolean
 */
function Boolean(flag) {
    this.value = flag
}

Boolean.prototype.encode = function (binaryStream) {
    // single byte value
    binaryStream.writeByte(this.value ? 1 : 0);
};

Boolean.prototype.decode = function (binaryStream) {
    this.value = binaryStream.readByte() ? true : false;
};

//===========================================================
function Byte(value) {
    this.value = value;
}

Byte.prototype.encode = function (binaryStream) {
    binaryStream.writeByte(this.value);
};
Byte.prototype.decode = function (binaryStream) {
    this.value = binaryStream.readByte();
};

//===========================================================
function Integer(value) {
    this.value = value;
}
Integer.prototype.encode = function(stream) {
    ec.encodeInt32(this.value,stream);
}
Integer.prototype.decode = function (stream) {
    this.value = ec.decodeInt32(stream);
};

//===========================================================
function Float(value) {
    this.value = value;
}

Float.prototype.encode = function (stream) {
    stream.writeFloat(this.value);
};
Float.prototype.decode = function (stream) {
    this.value = stream.readFloat();
};

function Double(value) {
    this.value = value;
}

Double.prototype.encode = function (stream) {
    stream.writeDouble(this.value);
};
Double.prototype.decode = function (stream) {
    this.value = stream.readDouble();
};

//===========================================================
function UAString(value) {
    this.value = value;
}




UAString.prototype.encode = function (stream) {
    ec.encode_string(this.value, stream);
};
UAString.prototype.decode = function (stream) {
    this.value = ec.decode_string(stream);
}
//===========================================================
function DateTime(value) {
    this.value = value;
}
DateTime.prototype.encode = function (stream) {
    // utc = Date.UTC(this.value.getYear(),this.value.getMonth()); // Number of second since January 1970
    // utc1600 = DateTime(1601,1,1);

    value = this.value;
    //xx console.log("value = ", this.value);
    //xx console.log("value = ", value);
    //xx console.log("value = ", parseInt(this.value / 0xffffffff));
    //xx console.log("value = ", parseInt(this.value % 0xffffffff));
    stream.stream.writeUInt32LE(parseInt(value / 0xffffffff), stream.length);
    stream.stream.writeUInt32LE(parseInt(value % 0xffffffff), stream.length + 4);
    stream.length += 8;
};
//===========================================================
function GUID(value) {
    // pattern should be
    // “72962B91-FA75-4AE6-8D28-B404DC7DAF63”
    this.guid = value;
}


GUID.prototype.encode = function (stream) {
    // utc = Date.UTC(this.value.getYear(),this.value.getMonth()); // Number of second since January 1970
    // utc1600 = DateTime(1601,1,1);

    value = this.value;

    //XX console.log("\n GUID  0123456789012345678901234567890123456789012345678901234567890");
    //XX console.log(" GUID ",this.guid);

    stream.stream.writeUInt32LE(parseInt("0x" + this.guid.substr(0, 8)), stream.length);
    stream.length += 4;

    stream.stream.writeUInt16LE(parseInt("0x" + this.guid.substr(9, 4)), stream.length);
    stream.length += 2;

    stream.stream.writeUInt16LE(parseInt("0x" + this.guid.substr(14, 4)), stream.length);
    stream.length += 2;

    stream.stream.writeUInt8(parseInt("0x" + this.guid.substr(19, 2)), stream.length + 0);
    stream.stream.writeUInt8(parseInt("0x" + this.guid.substr(21, 2)), stream.length + 1);
    stream.stream.writeUInt8(parseInt("0x" + this.guid.substr(24, 2)), stream.length + 2);
    stream.stream.writeUInt8(parseInt("0x" + this.guid.substr(26, 2)), stream.length + 3);
    stream.stream.writeUInt8(parseInt("0x" + this.guid.substr(28, 2)), stream.length + 4);
    stream.stream.writeUInt8(parseInt("0x" + this.guid.substr(30, 2)), stream.length + 5);
    stream.stream.writeUInt8(parseInt("0x" + this.guid.substr(32, 2)), stream.length + 6);
    stream.stream.writeUInt8(parseInt("0x" + this.guid.substr(34, 2)), stream.length + 7);
    stream.length += 8;
};


function Enum(possibleValues) {
    this.possibleValues = possibleValues;
    this.value = possibleValues[0];
}
Enum.prototype.encode = function (binaryStream) {

};

function NodeId(name) {
    this.namespace = 0;
    this.value = name;

}

NodeId.prototype.encode = function (binaryStream) {
    if (typeof this.value === 'number') {
        if (this.value < 255 && this.namespace === 0) {
            // 2 byte encoding
            binaryStream.writeByte(0);// encoding byte
            binaryStream.writeByte(this.value);
        } else if (this.value <= 65535 && this.namespace >= 0 && this.namespace <= 255) {
            binaryStream.writeByte(1); // encoding byte
            binaryStream.writeByte(this.namespace); // encoding byte
            binaryStream.writeInt16(this.value);
        }
    } else {
        binaryStream.writeByte(3); // UAString
        binaryStream.writeInt16(this.namespace);
        new UAString(this.value).encode(binaryStream);

    }
};

function LocalizeText() {
    this.encodingMask = new Byte();
    this.locale = "";
    this.text = "";
}

LocalizeText.prototype.encode = function (binaryStream) {

};
LocalizeText.prototype.decode = function (binaryStream) {

};
opcua = exports;


var HelloMessage_Description = {
    name: "HelloMessage",
    fields: [
        { name: "protocolVersion"   , fieldType: "Integer" },
        { name: "receiveBufferSize" , fieldType: "Integer" },
        { name: "sendBufferSize"    , fieldType: "Integer" },
        { name: "maxMessageSize"    , fieldType: "Integer" },
        { name: "maxChunkCount"     , fieldType: "Integer" },
        { name: "endpointUrl"       , fieldType: "UAString"}
    ]
};

var AcknowledgeMessage_Description = {
    name: "AcknowledgeMessage",
    fields: [
        { name: "protocolVersion"   , fieldType: "Integer" },
        { name: "receiveBufferSize" , fieldType: "Integer" },
        { name: "sendBufferSize"    , fieldType: "Integer" },
        { name: "maxMessageSize"    , fieldType: "Integer" },
        { name: "maxChunkCount"     , fieldType: "Integer" }
    ]
};

var factories = require("../lib/factories");
var HelloMessage       = factories.UAObjectFactoryBuild(HelloMessage_Description);
var AcknowledgeMessage = factories.UAObjectFactoryBuild(AcknowledgeMessage_Description);



ErrorMessage_Description = {
    name: ErrorMessage,
    fields: [
        {name: "Error", fieldType: "UInt32", comment: "The numeric code for the error. This shall be one of the values listed in Table 40." },
        {name: "Reason", fieldType: "String", comment: "A more verbose description of the error.This string shall not be more than 4096 characters." }
    ]
};

function ErrorMessage() {

}

/**
 * @name encodeMessage
 * @type {{
 *     msgType: String,
 *     messageContent: Object,
 *     binaryStream: BinaryStream
 * }}
 */
encodeMessage = function (msgType, messageContent, stream) {
    // console.log(msgType)
    // console.log(['HEL','ACK','ERR']);
    assert(['HEL', 'ACK', 'ERR'].indexOf(msgType) >= 0);
    stream.writeByte(msgType.charCodeAt(0));
    stream.writeByte(msgType.charCodeAt(1));
    stream.writeByte(msgType.charCodeAt(2));
    stream.writeByte(0); // reserved
    stream.writeInteger(0); //the length of the message, in bytes. (includes the 8 bytes of the message header)
    messageContent.encode(stream);
    length = stream.length;
    stream.stream.writeUInt32LE(length, 4);
};


function readMessageHeader(stream) {

    assert(stream instanceof opcua.BinaryStream);

    msgType = String.fromCharCode(stream.readByte()) +
        String.fromCharCode(stream.readByte()) +
        String.fromCharCode(stream.readByte());
    padding = stream.readByte();

    length = stream.readInteger(4);

    return  { msgType: msgType, length: length };
}

function decodeMessage(stream, className) {
    assert(stream instanceof opcua.BinaryStream);


    header = readMessageHeader(stream);
    obj = new className();
    obj.decode(stream);
    return obj;
}

exports.Boolean = Boolean;
exports.Byte = Byte;
exports.BinaryStream = BinaryStream;
exports.Integer = Integer;
exports.Float = Float;
exports.Double = Double;
exports.UAString = UAString;
exports.DateTime = DateTime;
exports.GUID = GUID;
exports.NodeId = NodeId;
exports.HelloMessage = HelloMessage;
exports.AcknowledgeMessage = AcknowledgeMessage;


exports.encodeMessage = encodeMessage;
exports.decodeMessage = decodeMessage;


function sendMessage(socket, msgType, msg, callback) {
    assert(['HEL', 'ACK', 'ERR'].indexOf(msgType) >= 0);

    // encode message in a packet
    var stream = new opcua.BinaryStream();
    opcua.encodeMessage(msgType, msg, stream);
    s = stream.stream.slice(0, stream.length);

    // write data to socket
    socket.write(s, callback);

}

exports.sendMessage = sendMessage;

