import { OPCUAServer, makeRoles, WellKnownRoles, NodeId, nodesets } from "node-opcua";
import { hashSync, genSaltSync, compareSync } from "bcryptjs";
const port = 2510;
let server: OPCUAServer;

const salt = genSaltSync(10);
const users = [
    {
        username: "user1",
        password: (() => hashSync((()=>"password1")(), salt))(),
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
        return compareSync(password, users[uIndex].password);
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
            maxSessions: 2,
            maxSubscriptions: 10,
            maxSubscriptionsPerSession: 3
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

(async () => {
    let counter = 0;

    process.on("SIGINT", () => {
        if (counter > 5) {
            process.exit();
        }
    });

    while (true) {
        users[0].password = hashSync(`password${counter % 2}`, salt);
        counter++;
        console.log("user:",  users[0].username,  "(", `password${counter % 2}`,")");
        const server = await startServer();
        console.log("server started at", server.getEndpointUrl());

        await new Promise((resolve) => {
            console.log("waiting for CTRL+C to cycle");
            process.once("SIGINT", resolve);
        });

        console.log("now shutting down");

        await server.shutdown(1000);
        console.log("server stopped for maintenance");
    }
})();
