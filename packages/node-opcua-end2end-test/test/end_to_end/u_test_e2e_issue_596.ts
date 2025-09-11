import os from "os";
import "should";
import { OPCUAClient, makeApplicationUrn } from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";

interface TestHarness { endpointUrl: string; [k: string]: any }

/**
 * Bug #596 - ClientSession#getNamespaceIndex
 *
 * Verifies that a session can resolve namespace indexes from their URI strings on the client side
 * using `session.getNamespaceIndex`, and that the namespace array contains the expected application
 * URN for the server (constructed with `makeApplicationUrn`).
 *
 */
export function t(test: TestHarness) {
    describe("Bug #596 - ClientSession#getNamespaceIndex", () => {
        it("retrieves namespace index from URI on client side", async () => {
            const client = OPCUAClient.create({});
            const endpointUrl = test.endpointUrl;
            const hostname = os.hostname();

            const namespaceArray: string[] = await client.withSessionAsync(endpointUrl, async (session) => {
                session.getNamespaceIndex("http://opcfoundation.org/UA/").should.eql(0);
                session.getNamespaceIndex("urn://node-opcua-simulator").should.eql(2);
                // Debug trace (disabled by default)
                // console.log("hostname =", hostname);
                // console.log("namespaceArray (cached) =", (session as any).$$namespaceArray);
                return await session.readNamespaceArray();
            });

            namespaceArray[1].should.match(new RegExp(makeApplicationUrn(hostname, "NodeOPCUA-Server")));
        });
    });
}
