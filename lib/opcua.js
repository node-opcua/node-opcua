
global.opcua = {

    // name spaces
    secure_channel_service: require('./services/secure_channel_service'),
    packet_analyzer:        require("./packet_analyzer"),
    packet_assembler:       require("./transport/packet_assembler"),
    message_builder:        require("./message_builder"),
    utils:                  require("./utils"),
    chunk_manager:          require('./misc/chunk_manager'),
    encode_decode:          require('./encode_decode'),
    structures:             require('./datamodel/structures'),
    crypto_utils:           require("./crypto_utils"),
    browse_service:         require("./services/browse_service"),

    HelloMessage:           require('./nodeopcua').HelloMessage,
    AcknowledgeMessage:     require('./nodeopcua').AcknowledgeMessage,
    TCPErrorMessage:        require('./datamodel/structures').TCPErrorMessage,

    BinaryStream:           require('./misc/binaryStream').BinaryStream,
    StatusCodes:            require("./datamodel/opcua_status_code").StatusCodes,
    StatusCode:             require("./datamodel/opcua_status_code").StatusCode,

    decodeMessage:          require('./nodeopcua').decodeMessage,
    packTcpMessage:         require('./nodeopcua').packTcpMessage,
    parseEndpointUrl:       require('./nodeopcua').parseEndpointUrl,
    is_valid_endpointUrl:   require('./nodeopcua').is_valid_endpointUrl,
    readMessageHeader:      require('./nodeopcua').readMessageHeader,
    writeTCPMessageHeader:  require('./nodeopcua').writeTCPMessageHeader,
    readRawMessageHeader:   require('./message_builder_base').readRawMessageHeader,
    minDate:                require('./misc/factories').minDate
};

global.opcua.utils.packet_analyzer = require("./packet_analyzer").packet_analyzer;

global.async   = require("async");
global.crypto = require("crypto");
global._      = require("underscore");
global.util   = require("util");
global.assert = require('better-assert');

module.exports = global.opcua;
assert(global.opcua.structures);
