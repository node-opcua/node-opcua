import { OPCUAClientBase, OPCUAServer, OPCUAClient, UserTokenType, nodesets, makeRoles, WellKnownRoles, NodeId } from "node-opcua";


const port = 2511;

// const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Testing automatic reconnection to a server when credential have changed and client is not aware", function (this: any) {
    this.timeout(Math.max(10 * 60 * 1000, this.timeout()));
    let server: OPCUAServer;
    const users = [
        {
            username: "user1",
            password: "password1-Old",
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
            console.log("server sesion closed");
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
    async function createClient() {
        const clientName = "Client_1162_" + clientCounter;
        const client: OPCUAClient = OPCUAClient.create({
            requestedSessionTimeout: 120 * 1000,
            clientName,
            endpointMustExist: false
        });
        clientCounter++;

        client.on("backoff", (count, delay) => {
            console.log("client: backoff: retrying connection", count, delay);
        });
        client.on("connection_lost", () => {
            console.log("client: connection_lost");
        });
        client.on("after_reconnection", () => {
            console.log("client: after_reconnection");
        });
        client.on("connection_failed", () => {
            console.log("client: connection_failed");
        });

        client.on("connection_reestablished", () => {
            console.log("client:    connection_reestablished");
        });
        await client.connect(server.getEndpointUrl());

        const session = await client.createSession({
            type: UserTokenType.UserName,
            userName: "user1",
            password: "password1-Old"
        });
        console.log("session timeout = ", session.timeout);

        const sub = await session.createSubscription2({
            maxNotificationsPerPublish: 10,
            priority: 1,
            publishingEnabled: true,
            requestedLifetimeCount: 10000,
            requestedMaxKeepAliveCount: 10,
            requestedPublishingInterval: 100
        });

        return client;
    }

    async function wait(duration: number) {
        await new Promise((resolve) => setTimeout(resolve, duration));
    }

    async function shutDownServerChangePasswordAndRestart(waitingTIme: number, newPassword = "password1-New") {
        console.log("============================ shuting down server");
        await server.shutdown();
        await wait(waitingTIme);
        console.log("============================ changing user password");
        users[0].password = newPassword;
        console.log("============================ restarting server again");
        server = await startServer();
        console.log("============================ server restarteds");
    }

    it("should reconnected automatically - short outage", async () => {
        const client = await createClient();

        await shutDownServerChangePasswordAndRestart(1, "password1-New");
        await wait(3 * 1000);

        await client.disconnect();

        await wait(1000);
    });

    it("should reconnected automatically - long outage", async () => {
        const client = await createClient();

        await shutDownServerChangePasswordAndRestart(10 * 1000, "password1-New");
        wait(10 * 1000);

        await client.disconnect();
        await wait(1000);
    });

    it("should reconnected automatically - back again", async () => {
        const client = await createClient();

        await shutDownServerChangePasswordAndRestart(1000, "password1-New");
        await wait(5 * 1000);
        await shutDownServerChangePasswordAndRestart(1000, "password1-Old");
        await wait(5 * 1000);

        await client.disconnect();
        await wait(1000);
    });
});
