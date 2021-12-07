const should = require("should");
const { assert } = require("node-opcua-assert");

const opcua = require("node-opcua");

const OPCUAServer = opcua.OPCUAServer;
const OPCUAClient = opcua.OPCUAClient;

const { make_debugLog, checkDebugFlag } = require("node-opcua-debug");
const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const empty_nodeset_filename = opcua.get_empty_nodeset_filename();


async function build_client_server_session(options) {

    assert(options.port, "must provide a port number");
    let endpointUrl;
    const server = new OPCUAServer(options);
    const client = OPCUAClient.create({});

  
    await server.start();
    
    // we will connect to first server end point
    endpointUrl = server.getEndpointUrl();
    debugLog("endpointUrl", endpointUrl);
    opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);


    await client.connect(endpointUrl);
    const session = await  client.createSession();

    async function shutdown() {

        // let's verify that the server has got at least one session active (the one we created above)
        assert(server.engine.currentSessionCount >= 1, "expecting at least one active session on service side");
        assert(client_server.g_session);

        await client_server.g_session.close();

            // disconnect client abruptly
        await client.disconnect();
        
                //xx // disconnecting the client should have cause the server to discard the subscriptions
                //xx assert(server.engine.currentSessionCount === 0);

                // OK, it  is now time to shutdown the server.
       await server.shutdown();

                    // let's perform some more verification
                    assert(server.engine.currentSessionCount === 0);
                    assert(server.engine.currentSubscriptionCount === 0);

    }

    const client_server = {
        g_session: session,
        g_server: server,
        shutdown: shutdown
    };
    return client_server;
}

exports.build_client_server_session = build_client_server_session;
