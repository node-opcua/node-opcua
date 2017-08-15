var fs = require("fs");


var packets = require("./conversationData.js_data");


var packet_analyzer = require("node-opcua-packet-analyzer").packet_analyzer;
var verify_multi_chunk_message= require("./verify_message_chunk").verify_multi_chunk_message;
require("node-opcua-service-session");
require("node-opcua-service-read");
require("node-opcua-service-browse");

//xxverify_multi_chunk_message([packets.peer0_10]);
verify_multi_chunk_message([packets.peer1_28]);
process.exit(0);

// OpenChannelRequest
verify_multi_chunk_message([packets.peer0_1]);
// OpenChannelResponse
verify_multi_chunk_message([packets.peer1_1]);

// CreateSessionRequest
verify_multi_chunk_message([packets.peer0_2,packets.peer0_3]);
// CreateSessionResponse


verify_multi_chunk_message([
    packets.peer1_2, packets.peer1_3, packets.peer1_4,  packets.peer1_5, packets.peer1_6, packets.peer1_7,
    packets.peer1_8, packets.peer1_9, packets.peer1_10,packets.peer1_11,packets.peer1_12,packets.peer1_13,
    packets.peer1_14,packets.peer1_15,packets.peer1_16,packets.peer1_17,packets.peer1_18,packets.peer1_19,
    packets.peer1_20,packets.peer1_21,packets.peer1_22,packets.peer1_23,packets.peer1_24
]);


console.log("===================================================================================== A");
// ActivateSessionRequest
verify_multi_chunk_message([packets.peer0_4]);
// ActivateSessionResponset
verify_multi_chunk_message([packets.peer1_22]);

console.log("===================================================================================== B");
verify_multi_chunk_message([packets.peer0_5]);
verify_multi_chunk_message([packets.peer1_23]);

console.log("===================================================================================== C");
verify_multi_chunk_message([packets.peer0_6]);
verify_multi_chunk_message([packets.peer1_24]);

console.log("===================================================================================== D");
verify_multi_chunk_message([packets.peer0_7]);
verify_multi_chunk_message([packets.peer1_25]);

console.log("===================================================================================== E");
verify_multi_chunk_message([packets.peer0_8]);
verify_multi_chunk_message([packets.peer1_26]);

console.log("===================================================================================== F");
verify_multi_chunk_message([packets.peer0_9]);
verify_multi_chunk_message([packets.peer1_27]);


console.log("===================================================================================== G");
verify_multi_chunk_message([packets.peer0_10]);
verify_multi_chunk_message([packets.peer1_28]);

console.log("===================================================================================== H");
verify_multi_chunk_message([packets.peer0_11]);
verify_multi_chunk_message([packets.peer1_29]);

console.log("===================================================================================== I");
verify_multi_chunk_message([packets.peer0_12]);
verify_multi_chunk_message([packets.peer1_30]);

console.log("===================================================================================== J");
verify_multi_chunk_message([packets.peer0_13]);
verify_multi_chunk_message([packets.peer1_31,packets.peer1_32,packets.peer1_33]);

console.log("===================================================================================== K");
verify_multi_chunk_message([packets.peer0_14]);
verify_multi_chunk_message([packets.peer1_34]);

console.log("===================================================================================== L");
verify_multi_chunk_message([packets.peer0_15]);
verify_multi_chunk_message([packets.peer1_35]);

console.log("===================================================================================== M");
verify_multi_chunk_message([packets.peer0_16]);
verify_multi_chunk_message([packets.peer1_36]);

console.log("===================================================================================== N");
verify_multi_chunk_message([packets.peer0_17]);
verify_multi_chunk_message([packets.peer1_37]);

console.log("===================================================================================== O");
verify_multi_chunk_message([packets.peer0_18]);
verify_multi_chunk_message([packets.peer1_38]);

console.log("===================================================================================== P");
verify_multi_chunk_message([packets.peer0_19]);

