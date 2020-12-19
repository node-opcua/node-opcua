const { OPCUAClient, ServerState } = require("node-opcua");

module.exports = function(test) {

    describe("Testing client keepalive options", function() {

        it("KA-1 it should terminate keepalive when session is closed", async () => {

            // Set NODEOPCUADEBUG=client_session_keepalive_manager
            const client = OPCUAClient.create({
                endpointMustExist: true,
                keepSessionAlive: true,
                requestedSessionTimeout: 100
            });

            const endpointUrl = test.endpointUrl;
            console.log(endpointUrl)
            await client.connect(endpointUrl);
            let session = await client.createSession();
            console.log("session.timeout= ", session.timeout);
            session.on("keepalive", (state, count) => {
                console.log("KeepAlive state=", ServerState[state], "count ", count);
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
            await session.close();
            console.log("session is closed");
            await client.disconnect();
            if (process.env.DEBUG) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

        })
    });
}
