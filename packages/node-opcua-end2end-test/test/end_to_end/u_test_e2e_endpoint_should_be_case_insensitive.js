const { OPCUAClient } = require("node-opcua");

module.exports = function(test) {

    describe("Testing case sensitivity", function() {

        it("CASE-I should be possible to connect to server with endpoint in UpperCase", async () => {

            const client = OPCUAClient.create({
                endpoint_must_exist: true
            });

            const endpointUrl = test.endpointUrl;
            console.log(endpointUrl)
            await client.connect(endpointUrl.toUpperCase());
            let session = await client.createSession();
            await session.close();

            await client.disconnect();

            await client.connect(endpointUrl.toLowerCase());
            session = await client.createSession();
            await session.close();
            await client.disconnect();

        })
    });
}
