/*global describe, it, require*/
const should = require("should");
const opcua = require("node-opcua");
const OPCUAClient = opcua.OPCUAClient;
const perform_operation_on_client_session = require("../../test_helpers/perform_operation_on_client_session").perform_operation_on_client_session;

module.exports = function (test) {

    describe("Testing bug #596 - ClientSession#getNamespaceIndex", function () {

        it("should be possible to retrieve the namespace Index from a url (on client clientside)", function(done) {

            const client = new OPCUAClient({});
            const endpointUrl = test.endpointUrl;

            perform_operation_on_client_session(client, endpointUrl, function (session, inner_done) {

                session.readNamespaceArray(function() {
                    session.getNamespaceIndex("http://opcfoundation.org/UA/").should.eql(0);
                    session.getNamespaceIndex("urn:NodeOPCUA-Server-default").should.eql(1);
                    session.getNamespaceIndex("urn://node-opcua-simulator").should.eql(2);
                    inner_done();
                });
            }, done);
        });
    });
};
