var OPCUAServer = require("../../lib/server/opcua_server").OPCUAServer;
var OPCUAClient = require("../../lib/client/opcua_client").OPCUAClient;
var opcua = require("../../lib/nodeopcua");
var debugLog  = require("../../lib/misc/utils").make_debugLog(__filename);


function build_client_server_session(done){
    var server , client;
    var endpointUrl ;

    server = new OPCUAServer();
    // we will connect to first server end point
    endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
    debugLog("endpointUrl",endpointUrl);
    opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);

    client = new OPCUAClient();

    function start(done) {
        server.start(function() {
            setImmediate(function() {
                client.connect(endpointUrl,function(err){
                    client.createSession(function(err,session){
                        client_server.g_session = session;
                        done();
                    });
                });
            });
        });
    }

    function shutdown(done){

        // let's verify that the server has got at least one session active (the one we created above)
        assert(server.engine.currentSessionCount >= 1);

        // disconnect client abruptly
        client.disconnect( function (){

            //xx // disconnecting the client should have cause the server to discard the subscriptions
            //xx assert(server.engine.currentSessionCount === 0);

            // OK, it  is now time to shutdown the server.
            server.shutdown( function () {

                // let's perform some more verification
                assert(server.engine.currentSessionCount === 0);
                //xx assert(server.engine.currentSubscriptionCount === 0);
                //xx assert(server.engine.cumulatedSessionCount>=1);
                done();
            });
        });
    }

    var client_server = {
        g_session: null,
        shutdown: shutdown
    };
    start(done);
    return client_server;
}

exports.build_client_server_session = build_client_server_session;
