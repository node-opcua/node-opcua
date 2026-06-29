// Regression test for https://github.com/node-opcua/node-opcua/issues/1524
//
// "Client does not recover subscriptions after Republish/BadMessageNotAvailable"
//
// After re-establishing a connection, the client calls Republish in a loop until the server
// answers with BadMessageNotAvailable. As soon as that status is received, the client must stop
// the Republish loop and resume normal Publish handling (OPC UA Part 4 §6.5/§6.7).
//
// Some servers (e.g. CoDeSys) return BadMessageNotAvailable as the *serviceResult* of a regular
// RepublishResponse (operation-level result) rather than as a ServiceFault. In that case the client
// used to treat the status as "keep going", spinning forever on the same sequence number and never
// resuming the publish engine.
import "mocha";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { StatusCodes } from "node-opcua-status-code";
import { type RepublishRequest, RepublishResponse } from "node-opcua-types";
import "should";
import type { ClientSidePublishEngine } from "../source/private/client_publish_engine";
import { republish } from "../source/private/reconnection/client_publish_engine_reconnection";

describe("issue #1524 - client must resume publishing after Republish returns BadMessageNotAvailable", function (this: Mocha.Suite) {
    this.timeout(10 * 1000);

    it("should stop the republish loop and complete when the server returns BadMessageNotAvailable", async () => {
        let republishCallCount = 0;
        let stopResponding = false;

        // minimal session/subscription/engine doubles, just enough to drive republish()
        const session = {
            _closeEventHasBeenEmitted: false,
            hasBeenClosed: () => false,
            _client: {
                _secureChannel: {},
                isUnusable: () => false
            },
            republish(_request: RepublishRequest, cb: (err: Error | null, response?: RepublishResponse) => void) {
                if (stopResponding) {
                    // halt the production loop if the test has already concluded
                    return;
                }
                republishCallCount += 1;
                // BadMessageNotAvailable returned as an operation-level result (not a ServiceFault)
                const response = new RepublishResponse({
                    responseHeader: { serviceResult: StatusCodes.BadMessageNotAvailable }
                });
                setImmediate(() => {
                    if (!stopResponding) cb(null, response);
                });
            }
        };

        const subscription = {
            subscriptionId: 1,
            lastSequenceNumber: 0,
            hasSession: true,
            session,
            onNotificationMessage() {
                /* no notification message expected in this scenario */
            }
        };

        const engine = {
            session,
            subscriptionMap: { "1": subscription },
            nbPendingPublishRequests: 0
        } as unknown as ClientSidePublishEngine;

        const completed = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => {
                stopResponding = true;
                resolve(false);
            }, 3000);
            republish(engine, () => {
                clearTimeout(timer);
                stopResponding = true;
                resolve(true);
            });
        });

        // Without the fix, the client loops forever on BadMessageNotAvailable: the callback never
        // fires and the publish engine is never resumed.
        completed.should.eql(true, "republish() must complete so that the publish engine can resume normal publishing");

        // A single Republish round-trip is enough to learn there is nothing left to replay.
        republishCallCount.should.be.lessThanOrEqual(2, "republish must not spin on BadMessageNotAvailable");
    });
});
