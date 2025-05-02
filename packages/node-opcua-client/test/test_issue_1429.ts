// This file shall show the connection problems with the v2.151 of node-opcua-client in comparison to v2.150.0.

import {
    ConnectionStrategyOptions,
    OPCUAClient,
    OPCUAClientOptions,
} from "..";
import should from "should";
import EventEmitter from "node:events";

/**
 * Function to log every emitted event of an event emitter.
 * @param emitter The event emitter to patch.
 * @param logName The name to log with.
 */
export function patchEmitter(emitter: EventEmitter) {
    var oldEmit = emitter.emit;

    emitter.emit = function (eventName: string, ...eventArgs: any[]): boolean {
        // Log the event name and arguments
        const now = new Date();
        console.log(new Date().toISOString(), "Event emitted:", eventName);

        // Call the original emit method
        return oldEmit.apply(emitter, [eventName, ...eventArgs]);
    };
}

const endpointUrl = "opc.tcp://10.20.30.40:4840"; // arbitrary IP, no opc ua server shall exist at this address
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("issue_1429", function (this: any) {
    this.timeout(40*1000);
    it("should issue a backoff event if the endpoint is not reachable", async () => {
        // setup  connect with infinit retries
        const connectionStrategy: ConnectionStrategyOptions = {
            maxRetry: -1, // infinit retries
            initialDelay: 1 * 250,
            maxDelay: 1 * 500
        };

        const connectOptions: OPCUAClientOptions = {
            connectionStrategy: connectionStrategy,
            endpointMustExist: false,
            keepSessionAlive: true,
            tokenRenewalInterval: 2 * 1000,
            transportTimeout: 1 * 1000, //  backoff every 1 seconds
        };

        const client = OPCUAClient.create(connectOptions);

        patchEmitter(client); // log every event emitted by client

        let backoffCount = 0;
        let timerId: NodeJS.Timeout | undefined;
        let caughtError: Error | undefined;
        try {

            client.on("backoff", () => {
                backoffCount += 1;
            })
            timerId = setTimeout(async () => {
                // force disconnection after 20 seconds
                await client.disconnect();
                timerId = undefined;
            }, 10 * 1000);


            await client.connect(endpointUrl);

        } catch (err) {
            console.log('Error:', (err as Error).message);
            caughtError = err as Error;
        } finally {
            if (timerId) clearTimeout(timerId);
            await client.disconnect();
        }
        backoffCount.should.be.greaterThan(2,"Expecting server to go to a backoff mode if ip cannot be joined");
        /* should(caughtError).be.undefined(); */
    });
});
