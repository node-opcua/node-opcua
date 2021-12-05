const os = require("os");
const should = require("should");

const { OPCUAClient, makeApplicationUrn } = require("node-opcua");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");
const doDebug = true;
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

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
                    session.readNamespaceArray((err, namespaceArray) => {
                        if (err) {
                            return inner_done(err);
                        }
                        if (doDebug) {
                            console.log("hostname = ", hostname);
                            console.log(" _namespaceArray =", session._namespaceArray);
                        }
                        try {
                            session.getNamespaceIndex("http://opcfoundation.org/UA/").should.eql(0);
                            namespaceArray[1].should.match(new RegExp(makeApplicationUrn(hostname, "NodeOPCUA-Server")));
                            session.getNamespaceIndex("urn://node-opcua-simulator").should.eql(2);
                            inner_done();
                        } catch (err) {
                            inner_done(err);
                        }
                    });
                },
                done
            );
        });
    });
};
