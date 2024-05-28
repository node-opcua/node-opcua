const os = require("os");
const should = require("should");

const { OPCUAClient, makeApplicationUrn } = require("node-opcua");
const doDebug = true;
// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function(test) {
    describe("Testing bug #596 - ClientSession#getNamespaceIndex", function() {
        it("should be possible to retrieve the namespace Index from a url (on client client side)", async () => {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;
            const hostname = os.hostname();

            const namespaceArray = await client.withSessionAsync(endpointUrl, async (session) => {
                session.getNamespaceIndex("http://opcfoundation.org/UA/").should.eql(0);
                session.getNamespaceIndex("urn://node-opcua-simulator").should.eql(2);
                if (doDebug) {
                    console.log("hostname = ", hostname);
                    console.log("$$namespaceArray =", session.$$namespaceArray);
                }
                return await session.readNamespaceArray();
            });
            namespaceArray[1].should.match(new RegExp(makeApplicationUrn(hostname, "NodeOPCUA-Server")));
        });
    });
};
