var hexDump = require("../../lib/utils").hexDump;
var DirectTransport = require("../../lib/transport/fake_socket").DirectTransport;
var debugLog  = require("../../lib/utils").make_debugLog(__filename);

var fake_AcknowledgeMessage =  new opcua.AcknowledgeMessage({
    protocolVersion:      1,
    receiveBufferSize:    8192,
    sendBufferSize:       8192,
    maxMessageSize:     100000,
    maxChunkCount:      600000
});

function MockTransport(promised_replies) {

    this._replies = promised_replies;
    this._counter = 0;
    this.fake_socket = new DirectTransport();

    var self = this;
    this.fake_socket.server.on("data",function(data){

        var reply = self._replies[self._counter];
        self._counter++;
        if (reply) {

            debugLog("\nFAKE SERVER RECEIVED");
            debugLog(hexDump(data).blue);
            debugLog("\nFAKE SERVER SEND");
            debugLog(hexDump(reply).red);
            self.fake_socket.server.write(reply);
        }
    });
}

exports.MockTransport = MockTransport;
exports.fake_AcknowledgeMessage = fake_AcknowledgeMessage;