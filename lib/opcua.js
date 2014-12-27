Error.stackTraceLimit = Infinity;
global.opcua = {

    // name spaces
    packet_assembler:       require("./transport/packet_assembler"),

    packet_analyzer:        require("./misc/packet_analyzer"),
    message_builder:        require("./misc/message_builder"),
    utils:                  require("./misc/utils"),
    chunk_manager:          require('./misc/chunk_manager'),
    encode_decode:          require('./misc/encode_decode'),
    crypto_utils:           require("./misc/crypto_utils"),
    readRawMessageHeader:   require('./misc/message_builder_base').readRawMessageHeader,
    minDate:                require('./misc/factories_builtin_types').minDate,
    BinaryStream:           require('./misc/binaryStream').BinaryStream,

    HelloMessage:           require('./nodeopcua').HelloMessage,
    AcknowledgeMessage:     require('./nodeopcua').AcknowledgeMessage,

    readMessageHeader:      require('./misc/message_header').readMessageHeader,

    structures:             require('./datamodel/structures'),
    TCPErrorMessage:        require('./datamodel/structures').TCPErrorMessage,
    
    StatusCodes:            require("./datamodel/opcua_status_code").StatusCodes,
    StatusCode:             require("./datamodel/opcua_status_code").StatusCode,

    decodeMessage:          require('./nodeopcua').decodeMessage,
    packTcpMessage:         require('./nodeopcua').packTcpMessage,
    parseEndpointUrl:       require('./nodeopcua').parseEndpointUrl,
    is_valid_endpointUrl:   require('./nodeopcua').is_valid_endpointUrl,
    writeTCPMessageHeader:  require('./nodeopcua').writeTCPMessageHeader,
    
    // ---------------------------------------------------------- services -----
    browse_service:         require("./services/browse_service"),
    session_service:        require("./services/session_service"),
    endpoints_service:      require("./services/get_endpoints_service"),
    secure_channel_service: require("./services/secure_channel_service")
};

global.opcua.utils.packet_analyzer = require("./misc/packet_analyzer").packet_analyzer;

global.async  = require("async");
global.crypto = require("crypto");
global._      = require("underscore");
global.util   = require("util");
global.assert = require('better-assert');

module.exports = global.opcua;
