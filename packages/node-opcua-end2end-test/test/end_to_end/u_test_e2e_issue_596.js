/*global describe, it, require*/
const should = require("should");
const os = require("os");

const { OPCUAClient, makeApplicationUrn } = require("node-opcua");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");
const doDebug = true;
module.exports = function (test) {
    describe("Testing bug #596 - ClientSession#getNamespaceIndex", function () {
        it("should be possible to retrieve the namespace Index from a url (on client clientside)", function (done) {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;

            const hostname = os.hostname();
            perform_operation_on_client_session(
                client,
                endpointUrl,
                function (session, inner_done) {
                    session.readNamespaceArray(function () {
                        if (doDebug) {
                            console.log("hostname = ", hostname);
                            console.log(" _namespaceArray =", session._namespaceArray);
                        }
                        session.getNamespaceIndex("http://opcfoundation.org/UA/").should.eql(0);
                        session.getNamespaceIndex(makeApplicationUrn(hostname,"Node-OPCUA-Server")).should.eql(1);
                        session.getNamespaceIndex("urn://node-opcua-simulator").should.eql(2);
                        inner_done();
                    });
                },
                done
            );
        });
    });
};
