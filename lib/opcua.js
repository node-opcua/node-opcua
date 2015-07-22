require("requirish")._(module);
Error.stackTraceLimit = Infinity;
global.opcua = {

    // name spaces
    packet_assembler: require("lib/transport/packet_assembler"),

    packet_analyzer: require("lib/misc/packet_analyzer"),
    message_builder: require("lib/misc/message_builder"),
    utils: require("lib/misc/utils"),
    chunk_manager: require("lib/misc/chunk_manager"),
    encode_decode: require("lib/misc/encode_decode"),
    crypto_utils: require("lib/misc/crypto_utils"),
    readRawMessageHeader: require("lib/misc/message_builder_base").readRawMessageHeader,
    minDate: require("lib/misc/factories_builtin_types").minDate,
    BinaryStream: require("lib/misc/binaryStream").BinaryStream,

    HelloMessage: require("lib/nodeopcua").HelloMessage,
    AcknowledgeMessage: require("lib/nodeopcua").AcknowledgeMessage,

    readMessageHeader: require("lib/misc/message_header").readMessageHeader,

    structures: require("lib/datamodel/structures"),
    TCPErrorMessage: require("lib/datamodel/structures").TCPErrorMessage,

    StatusCodes: require("lib/datamodel/opcua_status_code").StatusCodes,
    StatusCode: require("lib/datamodel/opcua_status_code").StatusCode,

    decodeMessage: require("lib/nodeopcua").decodeMessage,
    packTcpMessage: require("lib/nodeopcua").packTcpMessage,
    parseEndpointUrl: require("lib/nodeopcua").parseEndpointUrl,
    is_valid_endpointUrl: require("lib/nodeopcua").is_valid_endpointUrl,
    writeTCPMessageHeader: require("lib/nodeopcua").writeTCPMessageHeader,

    // ---------------------------------------------------------- services -----
    browse_service: require("lib/services/browse_service"),
    session_service: require("lib/services/session_service"),
    endpoints_service: require("lib/services/get_endpoints_service"),
    secure_channel_service: require("lib/services/secure_channel_service")
};

global.opcua.utils.packet_analyzer = require("lib/misc/packet_analyzer").packet_analyzer;

global.async = require("async");
global.crypto = require("crypto");
global._ = require("underscore");
global.util = require("util");
global.assert = require("better-assert");

module.exports = global.opcua;
