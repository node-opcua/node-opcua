"use strict";
const async = require("async");
const should = require("should");
const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;
const StatusCodes = opcua.StatusCodes;

const build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;

const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;


const users = [
    {username: "user1", password: "1", role: "admin"},
    {username: "user1", password: "1", role: "operator"},
    {username: "anonymous", password: "0", role: "guest"},

];

// simplistic user manager for test purpose only ( do not use in production !)
const userManager = {

    isValidUser: function (username, password) {
        const uIndex = users.findIndex(function (u) {
            return u.username === username;
        });
        if (uIndex < 0) {
            return false;
        }
        if (users[uIndex].password !== password) {
            return false;
        }
        return true;
    },

    getUserRole: function (username) {
        const uIndex = users.findIndex(function (x) {
            return x.username === username;
        });
        if (uIndex < 0) {
            return "unknown";
        }
        const userRole = users[uIndex].role;
        return userRole;
    }

};

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client-Server with UserName/Password identity token", function () {

    let server, client, endpointUrl;
    let node1;

    const port = 2002;

    before(function (done) {

        const options = {
            port: port,
//xx            allowAnonymous: false
        };

        server = build_server_with_temperature_device(options, function (err) {

            const permissionType1 = {
                CurrentRead: ["*", "!guest"], // accept all, except guest
                CurrentWrite: ["!*", "admin"]  // deny all except admint
            };

            endpointUrl = server.endpoints[0].endpointDescriptions()[0].endpointUrl;
            // replace user manager with our custom one
            server.userManager = userManager;

            const addressSpace = server.engine.addressSpace;
            const namespace = addressSpace.getOwnNamespace();

            // create a variable that can only be read and written by admin
            node1 = namespace.addVariable({
                browseName: "v1",
                organizedBy: addressSpace.rootFolder.objects,
                dataType: "Double",
                value: {dataType: "Double", value: 3.14},

                permissions: permissionType1
            });
            // create a variable that can  be read and written by admin and read/nowrite by operator

            done(err);
        });
    });

    beforeEach(function (done) {
        client = null;
        done();
    });

    afterEach(function (done) {
        client = null;
        done();
    });

    after(function (done) {
        server.shutdown(done);
    });

    it("Anonymous user should not be able to read or to write V1 node value", function (done) {

        const client = OPCUAClient.create();

        function read(session, callback) {
            const nodeToRead = {
                nodeId: node1.nodeId.toString(),
                attributeId: opcua.AttributeIds.Value,
                indexRange: null,
                dataEncoding: null
            };
            session.read(nodeToRead, function (err, dataValue) {
                if (err) {
                    return callback(err);
                }
                callback(err, dataValue.statusCode);
            });
        }

        let _the_value = 45;

        function write(session, callback) {
            _the_value = _the_value + 1.12;
            const nodesToWrite = [
                {
                    nodeId: node1.nodeId.toString(),
                    attributeId: opcua.AttributeIds.Value,
                    value: /*new DataValue(*/{
                        value: {/* Variant */dataType: opcua.DataType.Double, value: _the_value}
                    }
                }
            ];
            session.write(nodesToWrite, function (err, results) {
                if (err) {
                    return callback(err);
                }
                callback(err, results[0]);
            });
        }

        perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

            async.series([

                // ---------------------------------------------------------------------------------
                // As Anonymous user
                // ---------------------------------------------------------------------------------

                function (callback) {
                    read(session, function (err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.BadUserAccessDenied);
                        callback();
                    })
                },
                function (callback) {
                    write(session, function (err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.BadUserAccessDenied);
                        callback();
                    })
                },

                // ---------------------------------------------------------------------------------
                // As admin user
                // ---------------------------------------------------------------------------------
                function (callback) {
                    console.log("    impersonate user user1 on existing session");
                    const userIdentity = {userName: "user1", password: "1"};

                    client.changeSessionIdentity(session, userIdentity, function (err) {
                        if (err) {
                            return callback(err);
                        }
                        callback();
                    });
                },

                function (callback) {
                    read(session, function (err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.Good);
                        callback();
                    });
                },
                function (callback) {
                    write(session, function (err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.Good);
                        callback();
                    });
                }
            ], inner_done);

        }, done);
    });

});
