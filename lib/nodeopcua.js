var assert = require("assert");

//var buffer = require("Buffer");

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



/**
 * flag : boolean
 */
function Boolean(flag)
{
    this.value = flag
}

Boolean.prototype.encode= function(binaryStream)
{
    // single byte value
    binaryStream.writeByte(this.value ? 1 : 0);
};

Boolean.prototype.decode = function(binaryStream)
{
    this.value = binaryStream.readByte() ? true : false;
};

//===========================================================
function Byte(value)
{
    this.value = value;
}

Byte.prototype.encode = function(binaryStream)
{
    binaryStream.writeByte(this.value);
};
Byte.prototype.decode = function(binaryStream)
{
    this.value = binaryStream.readByte();
};
//===========================================================
function Integer(value)
{
    this.value = value;
}

Integer.prototype.encode = function(binaryStream)
{
    binaryStream.writeInteger(this.value);
};
Integer.prototype.decode = function(binaryStream)
{
    this.value = binaryStream.readInteger();
};
//===========================================================
function Float(value)
{
    this.value = value;
}

Float.prototype.encode = function(binaryStream)
{
    binaryStream.writeFloat(this.value);
};
Float.prototype.decode = function(binaryStream)
{
    this.value = binaryStream.readFloat();
};

function Double(value)
{
    this.value = value;
}

Double.prototype.encode = function(binaryStream)
{
    binaryStream.writeDouble(this.value);
};
Double.prototype.decode = function(binaryStream)
{
    this.value = binaryStream.readDouble();
};

//===========================================================
function UAString(value)
{
    this.value = value;
}

UAString.prototype.encode = function(binaryStream)
{
    if (this.value === undefined) {
        binaryStream.writeInteger(-1);
        return;
    }
    binaryStream.writeInteger(this.value.length);
    binaryStream.stream.write(this.value,binaryStream.length);
    binaryStream.length+=this.value.length;
};
UAString.prototype.decode = function(binaryStream)
{
    var length = binaryStream.readInteger();
    if (length == -1) {
        this.value = undefined;
    } else {
        this.value = binaryStream.stream.toString(encoding='binary',binaryStream.length,binaryStream.length+length );
        binaryStream.length+=length;
    }
};
//===========================================================
function DateTime(value) {
    this.value = value;
}
DateTime.prototype.encode = function(binaryStream)
{
    // utc = Date.UTC(this.value.getYear(),this.value.getMonth()); // Number of second since January 1970
    // utc1600 = DateTime(1601,1,1);

    value = this.value;
    console.log("value = ",this.value);
    console.log("value = ",value);
    console.log("value = ",parseInt(this.value/0xffffffff));
    console.log("value = ",parseInt(this.value % 0xffffffff));
    binaryStream.stream.writeUInt32LE(parseInt(value / 0xffffffff ),binaryStream.length);
    binaryStream.stream.writeUInt32LE(parseInt(value % 0xffffffff ),binaryStream.length+4);
    binaryStream.length += 8;
};
//===========================================================
function GUID(value) {
    // pattern should be
    // “72962B91-FA75-4AE6-8D28-B404DC7DAF63”
    this.guid = value;
}


GUID.prototype.encode = function(binaryStream)
{
    // utc = Date.UTC(this.value.getYear(),this.value.getMonth()); // Number of second since January 1970
    // utc1600 = DateTime(1601,1,1);

    value = this.value;

    //XX console.log("\n GUID  0123456789012345678901234567890123456789012345678901234567890");
    //XX console.log(" GUID ",this.guid);

    binaryStream.stream.writeUInt32LE(parseInt("0x"+this.guid.substr(0 ,8)) , binaryStream.length);
    binaryStream.length +=4;

    binaryStream.stream.writeUInt16LE(parseInt("0x"+this.guid.substr(9,4)) , binaryStream.length);
    binaryStream.length +=2;

    binaryStream.stream.writeUInt16LE(parseInt("0x"+this.guid.substr(14,4)) , binaryStream.length);
    binaryStream.length +=2;

    binaryStream.stream.writeUInt8(parseInt("0x"+this.guid.substr(19,2)), binaryStream.length+0);
    binaryStream.stream.writeUInt8(parseInt("0x"+this.guid.substr(21,2)), binaryStream.length+1);
    binaryStream.stream.writeUInt8(parseInt("0x"+this.guid.substr(24,2)), binaryStream.length+2);
    binaryStream.stream.writeUInt8(parseInt("0x"+this.guid.substr(26,2)), binaryStream.length+3);
    binaryStream.stream.writeUInt8(parseInt("0x"+this.guid.substr(28,2)), binaryStream.length+4);
    binaryStream.stream.writeUInt8(parseInt("0x"+this.guid.substr(30,2)), binaryStream.length+5);
    binaryStream.stream.writeUInt8(parseInt("0x"+this.guid.substr(32,2)), binaryStream.length+6);
    binaryStream.stream.writeUInt8(parseInt("0x"+this.guid.substr(34,2)), binaryStream.length+7);
    binaryStream.length += 8;
};



function Enum(possibleValues)
{
    this.possibleValues = possibleValues;
    this.value  = possibleValues[0];
}
Enum.prototype.encode = function(binaryStream)
{

};

function NodeId(name)
{
    this.namespace      = 0;
    this.value          = name;

}

NodeId.prototype.encode = function(binaryStream)
{
    if (typeof this.value === 'number' ) {
        if (this.value < 255 && this.namespace === 0 ) {
            // 2 byte encoding
            binaryStream.writeByte(0);// encoding byte
            binaryStream.writeByte(this.value);
        } else if (this.value <= 65535 && this.namespace >= 0 && this.namespace <= 255)  {
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

function LocalizeText()
{
    this.encodingMask= new Byte();
    this.locale = "";
    this.text   = "";
}

LocalizeText.prototype.encode = function(binaryStream)
{

};
LocalizeText.prototype.decode = function(binaryStream)
{

};
opcua = exports;

function HelloMessage()
{
    this.ProtocolVersion   =  new opcua.Integer(1);

    // UInt32 : The largest message that the sender can receive. This value shall be greater than 8192 bytes.
    this.ReceiveBufferSize = new opcua.Integer(8192);

    // UInt32 : The largest message that the sender will send.
    this.SendBufferSize    = new opcua.Integer(8192);

    this.MaxMessageSize    = new opcua.Integer(0);

    this.MaxChunkCount     = new opcua.Integer(0);

    this.EndpointUrl       = new opcua.UAString("");
}


HelloMessage.prototype.encode = function(binaryStream)
{
    this.ProtocolVersion.encode(binaryStream);
    this.ReceiveBufferSize.encode(binaryStream);
    this.SendBufferSize.encode(binaryStream);
    this.MaxMessageSize.encode(binaryStream);
    this.MaxChunkCount.encode(binaryStream);
    this.EndpointUrl.encode(binaryStream);

};
HelloMessage.prototype.decode = function(binaryStream)
{
    this.ProtocolVersion.decode(binaryStream);
    this.ReceiveBufferSize.decode(binaryStream);
    this.SendBufferSize.decode(binaryStream);
    this.MaxMessageSize.decode(binaryStream);
    this.MaxChunkCount.decode(binaryStream);
    this.EndpointUrl.decode(binaryStream);

};

function AcknowledgeMessage()
{
    this.ProtocolVersion   =  new opcua.Integer(1);

    // UInt32 : The largest message that the sender can receive. This value shall be greater than 8192 bytes.
    this.ReceiveBufferSize = new opcua.Integer(8192);

    // UInt32 : The largest message that the sender will send.
    this.SendBufferSize    = new opcua.Integer(8192);

    this.MaxMessageSize    = new opcua.Integer(0);

    this.MaxChunkCount     = new opcua.Integer(0);
}
AcknowledgeMessage.prototype.encode = function(binaryStream)
{
    this.ProtocolVersion.encode(binaryStream);
    this.ReceiveBufferSize.encode(binaryStream);
    this.SendBufferSize.encode(binaryStream);
    this.MaxMessageSize.encode(binaryStream);
    this.MaxChunkCount.encode(binaryStream);
};
AcknowledgeMessage.prototype.decode = function(binaryStream)
{
    this.ProtocolVersion.decode(binaryStream);
    this.ReceiveBufferSize.decode(binaryStream);
    this.SendBufferSize.decode(binaryStream);
    this.MaxMessageSize.decode(binaryStream);
    this.MaxChunkCount.decode(binaryStream);
};


ErrorMessageStruct =  {
    name : ErrorMessage ,
    fields: [
        [ "Error"   , "UInt32" , "The numeric code for the error. This shall be one of the values listed in Table 40." ],
        [ "Reason"  , "String" , "A more verbose description of the error.This string shall not be more than 4096 characters." ]
    ]
};

function ErrorMessage()
{

}

/**
 * @name encodeMessage
 * @type {{
 *     msgType: String,
 *     messageContent: Object,
 *     binaryStream: BinaryStream
 * }}
 */
encodeMessage = function(msgType,messageContent,binaryStream)
{
    // console.log(msgType)
    // console.log(['HEL','ACK','ERR']);
    assert(['HEL','ACK','ERR'].indexOf(msgType)>=0);
    binaryStream.writeByte(msgType.charCodeAt(0));
    binaryStream.writeByte(msgType.charCodeAt(1));
    binaryStream.writeByte(msgType.charCodeAt(2));
    binaryStream.writeByte(0); // reserved
    binaryStream.writeInteger(0); //the length of the message, in bytes. (includes the 8 bytes of the message header)
    messageContent.encode(binaryStream);
    length = binaryStream.length;
    binaryStream.stream.writeUInt32LE(length,4);
};


function readMessageHeader(stream)
{
    assert( stream instanceof opcua.BinaryStream);

    msgType = String.fromCharCode(stream.readByte()) +
        String.fromCharCode(stream.readByte()) +
        String.fromCharCode(stream.readByte());
    padding = stream.readByte();

    length  = stream.readInteger(4);
    console.log(" message length = ", length);

    return  { msgType: msgType, length: length };
}

function decodeMessage(stream,className)
{
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


function sendMessage(socket,msgType,msg,callback)
{
    assert(['HEL','ACK','ERR'].indexOf(msgType)>=0);

    // encode message in a packet
    var stream = new opcua.BinaryStream();
    opcua.encodeMessage(msgType,msg,stream);
    s = stream.stream.slice(0,stream.length);

    // write data to socket
    // console.log(" sending message length", s.length);
    socket.write(s,callback);

};
exports.sendMessage = sendMessage;

