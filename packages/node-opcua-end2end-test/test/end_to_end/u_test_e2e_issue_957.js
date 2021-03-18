const should = require("should");
const os = require("os");

const { OPCUAClient, makeApplicationUrn } = require("node-opcua");
const { perform_operation_on_client_session } = require("../../test_helpers/perform_operation_on_client_session");
const doDebug = true;
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

module.exports = function (test) {
    describe("Testing bug #957 - ServerCertificate is a empty buffer",  ()  => {
        it("should be possible to create a client#session when server certificate is an empty buffer ( and not null))",  async () => {
            const client = OPCUAClient.create({
                defaultSecureTokenLifetime: 1000,
            });

            client.serverCertificate = Buffer.alloc(0);

            await client.connect(test.endpointUrl);

            const session = await client.createSession();

            await new Promise((resolve)=> client.on("security_token_renewed", resolve));


            await session.close();
            await client.disconnect();
            
        })
    });
}