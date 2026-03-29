import path from "node:path";

import { crash_simple_server, start_simple_server, stop_simple_server } from "../test_helpers/external_server_fixture";

const port = 4891;
describe("testing external fixture server", () => {
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
