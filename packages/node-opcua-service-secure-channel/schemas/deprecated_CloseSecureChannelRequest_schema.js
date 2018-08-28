
require("./RequestHeader_schema");

const CloseSecureChannelRequest_Schema = {
    name: "CloseSecureChannelRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"                  }
        // { name: "channelId",   fieldType: "ByteString"                     },
    ]
};
//
exports.CloseSecureChannelRequest_Schema =CloseSecureChannelRequest_Schema;

