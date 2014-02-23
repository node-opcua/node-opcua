
var OPCUAClient  = require("../lib/opcua-client").OPCUAClient;
var MockTransport = require("./mocks/mock_transport").MockTransport;
var async  = require("async");
var m = require("./mocks/mock_transport");
var opcua = require("../lib/nodeopcua");

/*
 * this test verifies that the OPCUA Client  behave correctly
 * Server responses are emulated using a mock
 *
 */
describe("OPCUA-CLIENT",function(){



    xit("should connect and disconnect",function(done){


        var mock = new MockTransport([

            // transaction 1
            opcua.packTcpMessage("ACK", m.fake_AcknowledgeMessage),

            // transaction 2
            opcua.packTcpMessage("OPN", m.fake_OpenSecureChannelResponse),

            // transaction 3 ( getEndPointResponses)
            opcua.packTcpMessage("MSG", m.fake_GetEndpointsResponse),

            // transaction 4 ( CloseChannelResponse )
            opcua.packTcpMessage("CLO",m.fake_CloseSecureChannelResponse)


        ],done);
        require("../lib/transport/tcp_transport").setFakeTransport(mock.fake_socket.client);



        var client = new OPCUAClient();
        var endpoint_url = "fake://localhost:2033/SomeAddress";


        async.series([
            function(callback) {  client.connect(endpoint_url,callback); },
            function(callback) {  client.disconnect(callback); }

        ],done);



    });
    xit("should connect, createSession, closeSession, and disconnect",function(done){

        var mock = new MockTransport([

            // transaction 1
            opcua.packTcpMessage("ACK", m.fake_AcknowledgeMessage),

            // transaction 2
            opcua.packTcpMessage("OPN", m.fake_OpenSecureChannelResponse),

            // transaction 3 ( getEndPointResponses)
            opcua.packTcpMessage("MSG", m.fake_GetEndpointsResponse),


            // createSession
            opcua.packTcpMessage("MSG", m.fake_CreateSessionResponse),

            // activate
            opcua.packTcpMessage("MSG", m.fake_ActivateSessionResponse),


            // transaction 4 ( CloseChannelResponse )
            opcua.packTcpMessage("CLO",m.fake_CloseSecureChannelResponse)

        ],done);
        require("../lib/transport/tcp_transport").setFakeTransport(mock.fake_socket.client);



        var client = new OPCUAClient();
        var endpoint_url = "fake://localhost:2033/SomeAddress";


        var the_session = null;
        async.series([
            function(callback) {  client.connect(endpoint_url,callback); },
            function(callback) {
                client.createSession(function(err,session) {
                    the_session = session;
                    callback(err);
                });
            },
            function(callback) {
                the_session.close(callback);
            },

            function(callback) {  client.disconnect(callback); }

        ],done);

    });


    it("should connect, createSession, browseVariable, closeSession, and disconnect",function(done){
        done();

    });

    it("should not hang if the server send a ServerFault when closing the session",function(){
/*
0000   4d 53 47 46 34 00 00 00 cb 7f 63 02 01 00 00 00
0010   37 00 00 00 05 00 00 00 01 00 8d 01 80 8b eb d5
0020   06 29 cf 01 05 00 00 00 00 00 25 80 00 00 00 00
0030   00 00 00 00
*/
    });

});