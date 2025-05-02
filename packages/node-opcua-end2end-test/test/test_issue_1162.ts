import should from "should";
import { OPCUAClientBase, OPCUAServer, OPCUAClient, UserTokenType, nodesets, makeRoles, WellKnownRoles, NodeId, EndpointWithUserIdentity } from "node-opcua";
import { clear } from "console";
const { wait, wait_until_condition } = require("../test_helpers/utils");

const port = 2511;

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing automatic reconnection to a server when credential have changed and client is not aware #1662", function (this: any) {

    this.timeout(5 * 60 * 1000);
    let server: OPCUAServer;
    const users = [
        {
            username: "user1",
            password: (() => "password1-Old")(),
            roles: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin])
        }
    ];

    const userManager = {
        isValidUser: (username: string, password: string): boolean => {
            const uIndex = users.findIndex(function (u) {
                return u.username === username;
            });
            if (uIndex < 0) {
                return false;
            }
            if (users[uIndex].password !== password) {
                return false;
            }
            return true;
        },

        getUserRoles: (username: string): NodeId[] => {
            const uIndex = users.findIndex(function (x) {
                return x.username === username;
            });
            if (uIndex < 0) {
                return makeRoles("Anonymous");
            }
            const userRole = users[uIndex].roles;
            return userRole;
        }
    };
    async function startServer() {
        server = new OPCUAServer({
            port: port,
            nodeset_filename: [nodesets.standard],
            userManager,
            maxConnectionsPerEndpoint: 1,
            serverCapabilities: {
                maxSessions: 1,
                maxSubscriptions: 1
            }
        });
        await server.initialize();
        await server.start();

        server.on("newChannel", () => {
            console.log("server => new channel");
        });
        server.on("session_activated", () => {
            console.log("server session activated");
        });
        server.on("connectionRefused", () => {
            console.log("server connection refused");
        });
        server.on("session_closed", () => {
            console.log("server session closed");
        });
        server.on("create_session", () => {
            console.log("server create session");
        });
        return server;
    }
    beforeEach(async () => {
        server = await startServer();
    });

    afterEach(async () => {
        await server.shutdown();
        await wait(2000);
    });

    let old: number;
    beforeEach(() => {
        users[0].password = "password1-Old";
        old = OPCUAClientBase.retryDelay;
        OPCUAClientBase.retryDelay = 500;
    });
    afterEach(() => {
        OPCUAClientBase.retryDelay = old;
    });
    let clientCounter = 0;

    function getClientName() {
        const clientName = "Client_1162_" + clientCounter;
        clientCounter++;
        return clientName;
    }

    function createClient() {
        const client: OPCUAClient = OPCUAClient.create({
            requestedSessionTimeout: 120 * 1000,
            clientName: getClientName(),
            endpointMustExist: false
        });

        client.on("backoff", (count, delay) => {
            console.log(client.clientName, "client: backoff: retrying connection", count, delay);
        });
        client.on("connection_lost", () => {
            console.log(client.clientName, "client: connection_lost");
        });
        client.on("after_reconnection", () => {
            console.log(client.clientName, "client: after_reconnection");
        });
        client.on("connection_failed", () => {
            console.log(client.clientName, "client: connection_failed");
        });

        client.on("connection_reestablished", () => {
            console.log(client.clientName, "client:    connection_reestablished");
        });
        return client;
    }
    async function createAndConnectClient() {

        const client = createClient();

        await client.connect(server.getEndpointUrl());

        const session = await client.createSession({
            type: UserTokenType.UserName,
            userName: "user1",
            password: (() => "password1-Old")()
        });
        console.log(client.clientName, "session timeout = ", session.timeout);

        const sub = await session.createSubscription2({
            maxNotificationsPerPublish: 10,
            priority: 1,
            publishingEnabled: true,
            requestedLifetimeCount: 10000,
            requestedMaxKeepAliveCount: 10,
            requestedPublishingInterval: 100
        });

        return {
            client, session
        };
    }

    async function shutDownServerChangePasswordAndRestart(waitingTIme: number, newPassword = "password1-New") {
        console.log("============================ shutting down server");
        await server.shutdown();
        await wait(waitingTIme);
        console.log("============================ changing user password");
        users[0].password = newPassword;
        console.log("============================ restarting server again");
        server = await startServer();
        console.log("============================ server restarted");
    }

    it("#1662-A should try to reconnected automatically - but fail to do so", async () => {
        const { client, session } = await createAndConnectClient();

        let reconnectingCount = 0;
        client.on("reconnecting", () => {
            reconnectingCount++;
        });
        try {
            await shutDownServerChangePasswordAndRestart(1, "password1-New");

            // wait until client is connected
            await wait_until_condition(() => {
                return client.isReconnecting;
            }, 10000);

            console.log("client.isReconnecting 1 = ", client.isReconnecting);
            client.isReconnecting.should.eql(true, "client should be trying to reconnect constantly without success");
            await wait(5 * 1000);

            console.log("client.isReconnecting 2 = ", client.isReconnecting);
            await wait(5 * 1000);

            // console.log("client.isReconnecting = ", client.isReconnecting);
            // await wait(10 * 1000);
            console.log("client.isReconnecting 3 = ", client.isReconnecting, session.toString());
            client.isReconnecting.should.eql(true, "client should be trying to reconnect constantly without success");


        } finally {
            console.log("now disconnecting");
            await session.close();
            await client.disconnect();
        }
        console.log("done!");
    });

    it("#1662-B should try to reconnection : using withSessionAsync test", async () => {

        const endpointUrl = server.getEndpointUrl();
        const client = createClient();

        const connectionInfo: EndpointWithUserIdentity = {
            endpointUrl,
            userIdentity: {
                type: UserTokenType.UserName,
                userName: "user1",
                password: (() => "password1-Old")()
            }
        }
        const err = await client.withSessionAsync(connectionInfo, async (session) => {

            const timerId = setInterval(async () => {
                await session.read({ nodeId: "ns=1;s=Temperature" });
            }, 1000);

            await shutDownServerChangePasswordAndRestart(1, "password1-New");

            try {
                // wait until client is connected
                await wait_until_condition(() => {
                    return client.isReconnecting;
                }, 10000);


                console.log("client.isReconnecting 1 = ", client.isReconnecting, session.toString());
                client.isReconnecting.should.eql(true, "client should be trying to reconnect constantly without success");
                await wait(5 * 1000);

                console.log("client.isReconnecting 2 = ", client.isReconnecting, session.toString());
                client.isReconnecting.should.eql(true, "client should be trying to reconnect constantly without success");
                await wait(5 * 1000);

                console.log((new Date()).toISOString(),"now leaving ... ");
                await wait(700);
            } catch (err) {
                return err;
            } finally {
                clearInterval(timerId);

            }
            return null;
        });
        console.log("done!" , (err as Error|null)?.message);
        should.not.exist(err);
    });

    it("#1662-C should reconnected automatically - long outage", async () => {
        const { client, session } = await createAndConnectClient();

        await shutDownServerChangePasswordAndRestart(10 * 1000, "password1-New");
        wait(20 * 1000);

        await session.close();
        await client.disconnect();
        await wait(1000);
    });

    it("#1662-D should reconnected automatically - back again", async () => {
        const { client, session } = await createAndConnectClient();

        await shutDownServerChangePasswordAndRestart(10*1000, "password1-New");
        await wait(5 * 1000);
        await shutDownServerChangePasswordAndRestart(10 * 1000, "password1-Old");
        await wait(6 * 1000);

        await session.close();
        await client.disconnect();
        await wait(10*1000);
    });
});
