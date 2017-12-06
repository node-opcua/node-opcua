"use strict";
var _ = require("underscore");
var assert = require("node-opcua-assert");

var hexDump = require("node-opcua-debug").hexDump;

var DirectTransport = require("node-opcua-transport/test_helpers/fake_socket").DirectTransport;

var debugLog = require("node-opcua-debug").make_debugLog(__filename);

var packet_analyzer = require("node-opcua-packet-analyzer").packet_analyzer;

var display_trace_from_this_projet_only = require("node-opcua-debug").display_trace_from_this_projet_only;


var CloseSecureChannelResponse = require("node-opcua-service-secure-channel").CloseSecureChannelResponse;
var OpenSecureChannelResponse = require("node-opcua-service-secure-channel").OpenSecureChannelResponse;
var CreateSessionResponse = require("node-opcua-service-session").CreateSessionResponse;
var ActivateSessionResponse = require("node-opcua-service-session").ActivateSessionResponse;

var AcknowledgeMessage = require("node-opcua-transport").AcknowledgeMessage;
var GetEndpointsResponse = require("node-opcua-service-endpoints").GetEndpointsResponse;

var fake_AcknowledgeMessage = new AcknowledgeMessage({
    protocolVersion: 0,
    receiveBufferSize: 8192,
    sendBufferSize: 8192,
    maxMessageSize: 100000,
    maxChunkCount: 600000
});

var fake_CloseSecureChannelResponse = new CloseSecureChannelResponse({});


var fake_OpenSecureChannelResponse = new OpenSecureChannelResponse({
    serverProtocolVersion: 0,
    securityToken: {
        secureChannelId: 23,
        tokenId: 1,
        createdAt: new Date(), // now
        revisedLifeTime: 30000
    },
    serverNonce: new Buffer("qwerty")
});

var fake_GetEndpointsResponse = new GetEndpointsResponse({
    endpoints: [
        {
            endpointUrl: "fake://localhost:2033/SomeAddress"
        }
    ]
});

var fake_CreateSessionResponse = new CreateSessionResponse();
var fake_ActivateSessionResponse = new ActivateSessionResponse();


function MockTransport(promised_replies, done) {

    this._replies = promised_replies;
    this._counter = 0;
    this.fake_socket =  new DirectTransport();

    var self = this;
    this.fake_socket.server.on("data", function (data) {

        var reply = self._replies[self._counter];
        self._counter++;
        if (reply) {

            if (_.isFunction(reply)) {
                reply = reply.call(self);
                // console.log(" interpreting reply as a function" + reply);
                if (!reply) {
                    return;
                }
            }

            debugLog("\nFAKE SERVER RECEIVED");
            debugLog(hexDump(data).blue);

            var replies = [];
            if (reply instanceof Buffer) {
                replies.push(reply);
            } else {
                replies = reply;
            }
            assert(replies.length >= 1, " expecting at least one reply " + JSON.stringify(reply));
            replies.forEach(function (reply) {
                debugLog("\nFAKE SERVER SEND");
                debugLog(hexDump(reply).red);
                self.fake_socket.server.write(reply);
            });

        } else {
            var msg = " MockTransport has no more packets to send to client to emulate server responses.... ";
            console.log(msg.red.bold);
            console.log(hexDump(data).blue.bold);

            display_trace_from_this_projet_only();
            packet_analyzer(data);
            done(new Error(msg));
        }
    });
}

exports.MockTransport = MockTransport;
exports.fake_AcknowledgeMessage = fake_AcknowledgeMessage;
exports.fake_CloseSecureChannelResponse = fake_CloseSecureChannelResponse;
exports.fake_OpenSecureChannelResponse = fake_OpenSecureChannelResponse;
exports.fake_CreateSessionResponse = fake_CreateSessionResponse;
exports.fake_ActivateSessionResponse = fake_ActivateSessionResponse;
exports.fake_GetEndpointsResponse = fake_GetEndpointsResponse;
