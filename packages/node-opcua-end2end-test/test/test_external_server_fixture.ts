const path = require("path");

const { start_simple_server, stop_simple_server, crash_simple_server } = require("../test_helpers/external_server_fixture");

const port = 4891;
describe("testing external fixture server", function () {
    it("MQS- should start and stop a server several time", async () => {
        /** */
        let serverHandle = await start_simple_server({
            port,
            server_sourcefile: path.join(__dirname, "../test_helpers/bin/simple_server_that_fails_to_republish.js")
        });
        await crash_simple_server(serverHandle);
        serverHandle = await start_simple_server({
            port,
            server_sourcefile: path.join(__dirname, "../test_helpers/bin/simple_server_that_fails_to_republish.js")
        });
        await crash_simple_server(serverHandle);
        serverHandle = await start_simple_server({
            port,
            server_sourcefile: path.join(__dirname, "../test_helpers/bin/simple_server_that_fails_to_republish.js")
        });
        await crash_simple_server(serverHandle);
    });
    it("MQS- should start and stop a server several time", async () => {
        /** */
        let serverHandle = await start_simple_server({
            port,
            server_sourcefile: path.join(__dirname, "../test_helpers/bin/simple_server_that_fails_to_republish.js")
        });
        await stop_simple_server(serverHandle);
        serverHandle = await start_simple_server({
            port,
            server_sourcefile: path.join(__dirname, "../test_helpers/bin/simple_server_that_fails_to_republish.js")
        });
        await stop_simple_server(serverHandle);
        serverHandle = await start_simple_server({
            port,
            server_sourcefile: path.join(__dirname, "../test_helpers/bin/simple_server_that_fails_to_republish.js")
        });
        await stop_simple_server(serverHandle);
    });
});
