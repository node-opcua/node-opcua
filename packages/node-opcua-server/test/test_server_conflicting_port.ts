import should from "should";

import { get_empty_nodeset_filename } from "node-opcua-address-space/testHelpers";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

import { OPCUAServer } from "../source";

const empty_nodeset_filename = get_empty_nodeset_filename();

const debugLog = make_debugLog("TEST");
const doDebug = checkDebugFlag("TEST");

const port = 12345;

describe("testing 2 servers on same port ", function () {
    let server1: OPCUAServer;

    before(async () => {
        server1 = new OPCUAServer({ port, nodeset_filename: empty_nodeset_filename });
        await server1.start();
    });
    after(async () => {
        await server1.shutdown();
    });
    it("should fail to start a second server on a busy port ", async () => {
        const server2 = new OPCUAServer({ port: 12345, nodeset_filename: empty_nodeset_filename });

        let _err: Error | undefined;
        try {
            await server2.start();
            await server2.shutdown();
        } catch (err) {
            _err = err as Error;
        }
        // note : on WSL (windows subsystem for Linux), it seems possible that
        //        two servers could listen to the same port
        should.exist(_err, "trying to start a second server on a port that is already in used shall produce an error");
        _err!.should.be.instanceOf(Error);
    });
});
