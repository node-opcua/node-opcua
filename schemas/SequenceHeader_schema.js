"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

var SequenceHeader_Schema = {
    name: "SequenceHeader",
    id: factories.next_available_id(),
    fields: [
        // A monotonically increasing sequence number assigned by the sender to each
        // MessageChunk sent over the ClientSecureChannelLayer.
        { name: "sequenceNumber",    fieldType: "UInt32" },
        // An identifier assigned by the client to OPC UA request Message. All MessageChunks for
        // the request and the associated response use the same identifier.
        { name: "requestId",          fieldType: "UInt32" }
    ]
};
exports.SequenceHeader_Schema = SequenceHeader_Schema;