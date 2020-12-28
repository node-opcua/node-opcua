"use strict";
const async = require("async");
const should = require("should");
const opcua = require("node-opcua");

const OPCUAClient = opcua.OPCUAClient;
const StatusCodes = opcua.StatusCodes;

const build_server_with_temperature_device = require("../../test_helpers/build_server_with_temperature_device").build_server_with_temperature_device;

const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;


const users = [
    {
        username: "user1",
        password: "1",
        role: "operator"
    },
    {
        username: "user2",
        password: "2",
        role: "admin"
    },
];

// simplistic user manager for test purpose only ( do not use in production !)
const userManager = {

    isValidUser: function(username, password) {
        const uIndex = users.findIndex(function(u) {
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

    getUserRole: function(username) {
        const uIndex = users.findIndex(function(x) {
            return x.username === username;
        });
        if (uIndex < 0) {
            return "guest"; // by default were guest! ( i.e anonymous)
        }
        const userRole = users[uIndex].role;
        return userRole;
    }

};

const port = 2225;

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing Client-Server with UserName/Password identity token", function() {

    let server, client, endpointUrl;
    let node1;


    before(function(done) {

        const options = {
            port,
            //xx            allowAnonymous: false
        };

        server = build_server_with_temperature_device(options, function(err) {

            const permissionType1 = {
                CurrentRead: ["*", "!guest"], // accept all, except guest, so 'operator' should be allowed
                CurrentWrite: ["!*", "admin"]  // deny all except admin, so 'operator' should be denied
            };

            endpointUrl = server.getEndpointUrl();
            // replace user manager with our custom one
            server.userManager = userManager;

            const addressSpace = server.engine.addressSpace;
            const namespace = addressSpace.getOwnNamespace();
            // create a variable that can  be read and written by admins
            // and read/nowrite by operators
            // and noRead/noWrite by guests
            node1 = namespace.addVariable({
                browseName: "v1",
                organizedBy: addressSpace.rootFolder.objects,
                dataType: "Double",
                value: { dataType: "Double", value: 3.14 },
                permissions: permissionType1
            });
            //xx node1.permissions = permissionType1;

            done(err);
        });
    });

    beforeEach(function(done) {
        client = null;
        done();
    });

    afterEach(function(done) {
        client = null;
        done();
    });

    after(function(done) {
        server.shutdown(done);
    });

    it("Operator user should be able to read but not to write V1 node value", function(done) {

        const client = OPCUAClient.create({});

        function read(session, callback) {
            const nodeToRead = {
                nodeId: node1.nodeId.toString(),
                attributeId: opcua.AttributeIds.Value,
                indexRange: null,
                dataEncoding: null
            };
            session.read(nodeToRead, function(err, result) {
                if (err) {
                    return callback(err);
                }
                callback(err, result.statusCode);
            });
        }

        let _the_value = 45;

        function write(session, callback) {
            _the_value = _the_value + 1.12;

            const nodeToWrite = {
                nodeId: node1.nodeId.toString(),
                attributeId: opcua.AttributeIds.Value,
                value: /*new DataValue(*/{
                    value: {/* Variant */dataType: opcua.DataType.Double, value: _the_value }
                }
            };
            session.write(nodeToWrite, function(err, statusCode) {
                if (err) {
                    return callback(err);
                }
                callback(err, statusCode);
            });
        }

        perform_operation_on_client_session(client, endpointUrl, function(session, inner_done) {

            async.series([

                // ---------------------------------------------------------------------------------
                // As anonymous user
                // ---------------------------------------------------------------------------------
                function(callback) {

                    read(session, function(err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.BadUserAccessDenied);
                        callback();
                    });
                },
                function(callback) {
                    write(session, function(err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.BadUserAccessDenied);
                        callback();
                    });
                },
                // ---------------------------------------------------------------------------------
                // As operator user
                // ---------------------------------------------------------------------------------
                function(callback) {
                    console.log("    impersonate user user1 on existing session");
                    const userIdentity = { userName: "user1", password: "1" };

                    client.changeSessionIdentity(session, userIdentity, function(err) {
                        if (err) {
                            return callback(err);
                        }
                        callback();
                    });
                },

                function(callback) {

                    read(session, function(err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.Good);
                        callback();
                    });
                },
                function(callback) {
                    write(session, function(err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.BadUserAccessDenied);
                        callback();
                    });
                },

                // ---------------------------------------------------------------------------------
                // As admin user
                // ---------------------------------------------------------------------------------
                function(callback) {
                    console.log("    impersonate user user2 on existing session (user2 is admin)");
                    const userIdentity = { userName: "user2", password: "2" };
                    client.changeSessionIdentity(session, userIdentity, function(err) {
                        if (err) {
                            return callback(err);
                        }
                        callback();
                    });
                },

                function(callback) {

                    read(session, function(err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.Good);
                        callback();
                    });
                },

                function(callback) {
                    write(session, function(err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.Good);
                        callback();
                    });
                },
                // ---------------------------------------------------------------------------------
                // Back as anonymous
                // ---------------------------------------------------------------------------------
                function(callback) {
                    console.log("    impersonate anonymous user again");
                    const userIdentity = {};

                    client.changeSessionIdentity(session, userIdentity, function(err) {
                        if (err) {
                            return callback(err);
                        }
                        callback();
                    });
                },

                function(callback) {

                    read(session, function(err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.BadUserAccessDenied);
                        callback();
                    });
                },
                function(callback) {
                    write(session, function(err, statusCode) {
                        if (err) {
                            return callback(err);
                        }
                        statusCode.should.eql(StatusCodes.BadUserAccessDenied);
                        callback();
                    });
                },

            ], inner_done);

        }, done);
    });

});
