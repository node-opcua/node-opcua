require("requirish")._(module);
var assert = require("better-assert");

var opcua = require("index.js");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;

var debugLog  = require("lib/misc/utils").make_debugLog(__filename);

var empty_nodeset_filename = require("path").join(__dirname,"../fixtures/fixture_empty_nodeset2.xml");


function build_client_server_session(done){
    var server , client;
    var endpointUrl ;

    var options = {
        port: 2001,
        nodeset_filename: empty_nodeset_filename
    };

    server = new OPCUAServer(options);
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
                        if (!err) {
                            client_server.g_session = session;
                        }
                        done(err);
                    });
                });
            });
        });
    }

    function shutdown(done){

        // let's verify that the server has got at least one session active (the one we created above)
        assert(server.engine.currentSessionCount >= 1);
        assert(client_server.g_session);

        client_server.g_session.close(function(){

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
