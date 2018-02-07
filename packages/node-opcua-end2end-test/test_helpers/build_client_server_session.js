var should = require("should");
var assert = require("node-opcua-assert");
var _ = require("underscore");

var opcua = require("node-opcua");

var OPCUAServer = opcua.OPCUAServer;
var OPCUAClient = opcua.OPCUAClient;

var debugLog = require("node-opcua-debug").make_debugLog(__filename);

var empty_nodeset_filename = opcua.empty_nodeset_filename;


/**
 * @method build_client_server_session
 * @param done
 * @return {{g_session: null, g_server: (*|OPCUAServer), shutdown: shutdown}}
 *
 * @example
 * before(function (done) {
 *    client_server = build_client_server_session(server_options,function (err) {
 *       if (!err) {
 *         g_session = client_server.g_session;
 *       }
 *       done(err);
 *     });
 *
 * });
 * after(function (done) {
 *       client_server.shutdown(done);
 * });
 *
 */
function build_client_server_session(options,done) {

    var server, client;
    var endpointUrl;

    if (_.isFunction(options)) {
        done = options;
        options = {
            port: 2001,
            nodeset_filename: empty_nodeset_filename
        };
    }

    options.port = options.port || 2001;

    server = new OPCUAServer(options);
    // we will connect to first server end point
    endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;

    debugLog("endpointUrl", endpointUrl);

    opcua.is_valid_endpointUrl(endpointUrl).should.equal(true);


    client = new OPCUAClient({});

    function start(done) {
        server.start(function () {
            setImmediate(function () {
                client.connect(endpointUrl, function (err) {
                    if (err) {
                        return done(err);
                    }
                    client.createSession(function (err, session) {
                        if (!err) {
                            client_server.g_session = session;
                        }
                        done(err);
                    });
                });
            });
        });
    }

    function shutdown(done) {

        // let's verify that the server has got at least one session active (the one we created above)
        assert(server.engine.currentSessionCount >= 1 , "expecting at least one active session on service side");
        assert(client_server.g_session);

        client_server.g_session.close(function () {

            // disconnect client abruptly
            client.disconnect(function () {

                //xx // disconnecting the client should have cause the server to discard the subscriptions
                //xx assert(server.engine.currentSessionCount === 0);

                // OK, it  is now time to shutdown the server.
                server.shutdown(function () {

                    // let's perform some more verification
                    assert(server.engine.currentSessionCount === 0);
                    assert(server.engine.currentSubscriptionCount === 0);
                    //xx assert(server.engine.cumulatedSessionCount>=1);
                    done();
                });
            });

        });
    }

    var client_server = {
        g_session: null,
        g_server: server,
        shutdown: shutdown
    };
    start(done);
    return client_server;
}

exports.build_client_server_session = build_client_server_session;
