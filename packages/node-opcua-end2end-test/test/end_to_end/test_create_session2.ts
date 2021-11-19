/***
 *
 */
import { OPCUAServer } from "node-opcua-server";
import { OPCUAClient } from "node-opcua-client";
import * as should from "should";
import { until } from "async";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;

const sleep = async (delay: number) => await new Promise((resolve) => setTimeout(resolve, delay));

const port = 1304;

describe("OPCUAClient#createSession2 - repeatly  createSession if Server returns BadTooManySession", () => {
    let server: OPCUAServer;
    before(async () => {
        server = new OPCUAServer({
            port,
            maxAllowedSessionNumber: 1
        });
        await server.start();
    });

    after(async () => {
        await server.shutdown();
    });

    it("NOS1 - OPCUAClient.createSession - should retry to connect a session", async () => {
        // Given client1 connected to the server ( which has one allowed session)
        const client1 = OPCUAClient.create({});
        await client1.connect(server.getEndpointUrl());
        // Given client1 is consuming the only session exposed by the server
        const session1 = await client1.createSession();

        // Given a second connected client
        const client2 = OPCUAClient.create({});
        await client2.connect(server.getEndpointUrl());

        let _err: Error | null = null;

        // When client2 tries to create a session
        try {
            try {
                const session2 = await client2.createSession();
                await session2.close();
            } catch (err) {
                _err = err as Error;
            }
        } finally {
            await client2.disconnect();
            await session1.close();
            await client1.disconnect();
        }
        // Then the server returns BadTooManySession
        // ahd createSession should fail with an expection
        should.exist(_err);
        _err!.message.should.match(/BadTooManySessions/);
    });
    it("NOS2 - OPCUAClient.createSession - should retry to connect a session", async () => {
        let connected = false;

        async function untilConnectedOrTimeout(duration: number): Promise<boolean> {
            const STEP = 1000;
            await sleep(STEP);
            duration -= STEP;
            if (duration <= 0) {
                return connected;
            }
            if (connected) {
                return true;
            }
            return await untilConnectedOrTimeout(duration);
        }

        // Given client1 connected to the server ( which has one allowed session)
        const client1 = OPCUAClient.create({});
        await client1.connect(server.getEndpointUrl());
        // Given client1 is consuming the only session exposed by the server
        const session1 = await client1.createSession();

        // Given a second connected client
        const client2 = OPCUAClient.create({});
        await client2.connect(server.getEndpointUrl());

        let _err: Error | null = null;

        // When client2 tries to create a session with the createSession2 method
        try {
            const tryToConnect = async () => {
                try {
                    const session2 = await client2.createSession2();

                    console.log("----- Connected => !");
                    await session2.close();
                    connected = true;
                } catch (err) {
                    _err = err as Error;
                }
            };
            tryToConnect();

            // Then it should not connect immediately
            await sleep(100);
            should(connected).eql(false);
            await sleep(100);
            should(connected).eql(false);

            // but When client1 closes the session
            setTimeout(async () => {
                await session1.close();
                await client1.disconnect();
            }, 1000);

            await untilConnectedOrTimeout(10 * 10000);
        } finally {
            await client2.disconnect();
        }

        should(connected).eql(true);
        should.not.exist(_err);
    });

    it("NOS3 - static OPCUAClient.createSession - should retry to connect a session", async () => {
        let connected = false;

        async function untilConnectedOrTimeout(duration: number): Promise<boolean> {
            const STEP = 1000;
            await sleep(STEP);
            duration -= STEP;
            if (duration <= 0) {
                return connected;
            }
            if (connected) {
                return true;
            }
            return await untilConnectedOrTimeout(duration);
        }

        // Given client1 connected to the server ( which has one allowed session)
        const client1 = OPCUAClient.create({});
        await client1.connect(server.getEndpointUrl());
        // Given client1 is consuming the only session exposed by the server
        const session1 = await client1.createSession();

        let _err: Error | null = null;

        // When client2 tries to create a session with the createSession2 method
        const tryToConnect = async () => {
            try {
                const session2 = await OPCUAClient.createSession(server.getEndpointUrl());

                console.log("----- Connected => !");
                await session2.close();
                connected = true;
            } catch (err) {
                _err = err as Error;
            }
        };
        tryToConnect();

        // Then it should not connect immediately
        await sleep(100);
        should(connected).eql(false);
        await sleep(100);
        should(connected).eql(false);

        // but When client1 closes the session
        setTimeout(async () => {
            await session1.close();
            await client1.disconnect();
        }, 1000);

        await untilConnectedOrTimeout(10 * 10000);

        should(connected).eql(true);
        should.not.exist(_err);
    });
});
