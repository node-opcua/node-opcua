const async = require("async");
const should = require("should");
const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const UserTokenPolicy = opcua.UserTokenPolicy;
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");
// require("node-opcua-service-session").UserNameIdentityToken;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing bug #1170", function() {

    const port = 1170;
    let server = null;
    let endpointUrl = "";


    before(async () => {


        server = new opcua.OPCUAServer({
            port
        });

        await server.start();

        let endpoints = server._get_endpoints();
        endpointUrl = endpoints[0].endpointUrl;


    });
    after(function(done) {
        server.shutdown(done);
    });

    it("should productURI have the same value", (done) => {

        // user1/password1

        const client = opcua.OPCUAClient.create({
            endpointMustExist: false,
            requestedSessionTimeout: 60000
        });

        let the_session;
        async.series([

            function client_connect(callback) {
                client.connect(endpointUrl, function(err) {
                    if (err) {
                        console.log(" cannot connect to endpoint :", endpointUrl);
                    } else {
                        console.log("connected !");
                    }
                    callback(err);
                });
      
            },

            function client_create_session(callback) {
                
                client.createSession({}, function(err, session) {
                    if (!err) {
                        the_session = session;
                        should(session.serverEndpoints[0].server.productUri).eql("NodeOPCUA-Server");
                    }
                    callback(err);
                });
            },

            function(callback) {
                the_session.close(callback);
            },
            function(callback) {
                client.disconnect(callback);
            }
        ], done);
    });
});

