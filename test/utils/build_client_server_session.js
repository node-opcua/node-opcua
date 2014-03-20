var OPCUAServer = require("../../lib/opcua-server").OPCUAServer;
var OPCUAClient = require("../../lib/opcua-client").OPCUAClient;
var opcua = require("../../lib/nodeopcua");
var debugLog  = require("../../lib/utils").make_debugLog(__filename);


function build_client_server_session(done){
    var server , client;
    var endpointUrl ;

    server = new OPCUAServer();
    // we will connect to first server end point
    endpointUrl = server.endpoints[0].endpointDescription().endpointUrl;
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
        client.disconnect(function(){
            server.shutdown(function() {
                done();
            });
        });
    }

    var client_server = {
        g_session: null,
        shutdown:shutdown
    };
    start(done);
    return client_server;
}

exports.build_client_server_session = build_client_server_session;
