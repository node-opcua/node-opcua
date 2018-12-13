/*global describe, it, require*/
const async = require("async");
const should = require("should");
const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;
const UserTokenPolicy = opcua.UserTokenPolicy;
// require("node-opcua-service-session").UserNameIdentityToken;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing bug #574", function () {

    const port = 2222;
    let server = null;


    before(function(done) {

        server = new opcua.OPCUAServer({
            port,
            securityModes: [ opcua.MessageSecurityMode.None],
            securityPolicies: [opcua.SecurityPolicy.None],
            userManager: {
                isValidUser: (username , password) =>
                  (username === "user1" && password === "password1")
            }
        });

        // note: Some OPCUA servers (such as Softing) allow user token policies that
        //       send password in clear text on the TCP unencrypted channel.
        //       This behavior is not recommended by the OPCUA specification but
        //       exists in many server on the field.
        //       On our side, node opcua doesn't allow password to be send unsecurely.
        //       We need to tweak the server to allow this for the purpose
        //       of this test.
        //       Let's remove all but policy and add a single
        //       userIdentityTokens policy for username and uncrypted password
        let endpoints = server._get_endpoints();
        endpoints = endpoints.filter((e) => e.securityMode === opcua.MessageSecurityMode.None);
        endpoints.length.should.eql(1);

        endpoints[0].userIdentityTokens = [];
        endpoints[0].userIdentityTokens.push(new UserTokenPolicy({
            policyId: "usernamePassword_unsecure",
            tokenType: 1, /*UserTokenType.UserName,*/
            issuedTokenType: null,
            issuerEndpointUrl: null,
            securityPolicyUri: null
        }));

        server.start(done);
    });
    after(function(done) {
        server.shutdown(done);
    });

    it("should create a aession with user/password on unsecure connection", function (done) {

        // user1/password1
        const endpointUrl = "opc.tcp://localhost:"+port;

        const client = opcua.OPCUAClient.create({
            endpoint_must_exist: false,
            requestedSessionTimeout: 60000
        });


        const userIdentity = { userName: "user1", password: "password1" };
        let the_session;
        async.series([

            function client_connect(callback) {
                client.connect(endpointUrl, function (err) {
                    if (err) {
                        console.log(" cannot connect to endpoint :", endpointUrl);
                    } else {
                        console.log("connected !");
                    }
                    callback(err);
                });
            },

            function client_create_session(callback) {
                client.createSession(userIdentity, function (err, session) {
                    if (!err) {
                        the_session = session;
                    }
                    callback(err);
                });
            },

            function (callback) {
                the_session.close(callback);
            },
            function (callback) {
                client.disconnect(callback);
            }
        ], done);
    });
});

