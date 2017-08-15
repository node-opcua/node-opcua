"use strict";

module.exports = {
    ChannelSecurityToken: require("./src/services").ChannelSecurityToken,
    MessageSecurityMode: require("./src/services").MessageSecurityMode,
    SignatureData: require("./src/services").SignatureData,
    chooseSecurityHeader: require("./src/secure_message_chunk_manager").chooseSecurityHeader,
    SecureMessageChunkManager: require("./src/secure_message_chunk_manager").SecureMessageChunkManager,
    computeSignature: require("./src/security_policy").computeSignature,
    verifySignature: require("./src/security_policy").verifySignature,

    toURI: require("./src/security_policy").toURI,
    fromURI: require("./src/security_policy").fromURI,
    SecurityPolicy: require("./src/security_policy").SecurityPolicy,
    getCryptoFactory: require("./src/security_policy").getCryptoFactory,

    SequenceNumberGenerator: require("./src/sequence_number_generator").SequenceNumberGenerator

};


