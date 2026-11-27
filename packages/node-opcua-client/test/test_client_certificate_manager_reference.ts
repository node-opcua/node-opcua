import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";

import { OPCUAClient } from "../source/index.js";
import { testPath } from "./paths.js";

/** Nothing listens here: every connect fails. */
const port = 20132;

/**
 * The client takes a reference on its certificate manager when it is built,
 * and gives it back at disconnect(): once, whether its connect succeeded,
 * failed, or was never tried. A manager shared with a server would otherwise
 * keep a reference for every failed attempt, and never be disposed.
 */
describe("OPCUAClient gives back its certificate manager reference at disconnect", () => {
    /** a certificate manager that counts its references and the dispose() calls */
    function certificateManager() {
        const manager = {
            referenceCounter: 0,
            disposed: 0,
            // read by the client constructor to name its own certificate files; no file is opened here
            rootDir: testPath("fixtures"),
            privateKey: testPath("fixtures", "private_key.pem"),
            async initialize() {},
            async checkCertificate() {
                return StatusCodes.Good;
            },
            async dispose() {
                manager.disposed++;
                manager.referenceCounter--;
            }
        };
        return manager;
    }

    function client(manager: ReturnType<typeof certificateManager>) {
        return OPCUAClient.create({
            clientCertificateManager: manager as never,
            endpointMustExist: false,
            connectionStrategy: { maxRetry: 0, initialDelay: 10, maxDelay: 20 }
        });
    }

    it("after a failed connect", async () => {
        const manager = certificateManager();
        const c = client(manager);
        should(manager.referenceCounter).eql(1);
        await should(c.connect(`opc.tcp://localhost:${port}`)).be.rejected();
        await c.disconnect();
        should(manager.disposed).eql(1);
        should(manager.referenceCounter).eql(0);
    });

    it("once, however many times disconnect() is called", async () => {
        const manager = certificateManager();
        const c = client(manager);
        await should(c.connect(`opc.tcp://localhost:${port}`)).be.rejected();
        await c.disconnect();
        await c.disconnect();
        should(manager.disposed).eql(1);
        should(manager.referenceCounter).eql(0);
    });

    it("connected again after a disconnect, it takes the reference back, and gives it back again", async () => {
        const manager = certificateManager();
        const c = client(manager);
        for (let attempt = 0; attempt < 2; attempt++) {
            await should(c.connect(`opc.tcp://localhost:${port}`)).be.rejected();
            should(manager.referenceCounter).eql(1);
            await c.disconnect();
            should(manager.referenceCounter).eql(0);
        }
        should(manager.disposed).eql(2);
    });

    it("for a client that never connected", async () => {
        const manager = certificateManager();
        await client(manager).disconnect();
        should(manager.disposed).eql(1);
        should(manager.referenceCounter).eql(0);
    });
});
