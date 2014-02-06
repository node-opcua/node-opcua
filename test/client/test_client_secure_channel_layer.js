var SecureChannelLayer = require("../../lib/client/client_secure_channel_layer").ClientSecureChannelLayer;
var should  = require("should");

var debugLog  = require("../../lib/utils").make_debugLog(__filename);

var MockTransport           = require("../mocks/mock_transport").MockTransport;
var fake_AcknowledgeMessage = require("../mocks/mock_transport").fake_AcknowledgeMessage;

describe("testing ClientSecureChannelLayer ",function(){

    it("should create a ClientSecureChannelLayer",function(done){

        var mock = new MockTransport([
            opcua.packTcpMessage("ACK", fake_AcknowledgeMessage),
            require("../fixture_full_tcp_packets").packet_sc_2
        ]);

        require("../../lib/transport/tcp_transport").setFakeTransport(mock.fake_socket.client);

        var secureChannel = new SecureChannelLayer();

        secureChannel.create("fake://localhost:2033/SomeAddress",function(err){
            done(err);
        });
    });
    it("should close a ClientSecureChannelLayer",function(done){

        var mock = new MockTransport([
            opcua.packTcpMessage("ACK", fake_AcknowledgeMessage),
            require("../fixture_full_tcp_packets").packet_sc_2
        ]);

        require("../../lib/transport/tcp_transport").setFakeTransport(mock.fake_socket.client);

        var secureChannel = new SecureChannelLayer();

        secureChannel.create("fake://localhost:2033/SomeAddress",function(err){
            secureChannel.close(function(err){
                done(err);
            });
        });
    });


    it("should use token provided by server in messages",function(done){

        var mock = new MockTransport([
            opcua.packTcpMessage("ACK", fake_AcknowledgeMessage),
            require("../fixture_full_tcp_packets").packet_sc_2
        ]);

        require("../../lib/transport/tcp_transport").setFakeTransport(mock.fake_socket.client);

        var secureChannel = new SecureChannelLayer();
        (!!secureChannel.tokenId).should.equal(false);

        secureChannel.create("fake://localhost:2033/SomeAddress",function(err){

            secureChannel.tokenId.should.equal(1);

            if (err) {
                done(err);
                return;
            }
            secureChannel.close(function(err){
                done(err);
            });
        });
    });

});
