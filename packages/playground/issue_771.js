


const {
    OPCUAServer,
    OPCUAClient,
    UserTokenType,
    makeRoles,
} = require("node-opcua");


const users = [
    { username: "user1", password: "password1", roles: makeRoles("ConfigAdmin;SystemAdmin") },
    { username: "user2", password: "password2", roles: makeRoles("Operator") },
    { username: "anonymous", password: "0", roles: makeRoles("Anonymous") },
];

// simplistic user manager for test purpose only ( do not use in production !)
const userManager = {

    isValidUser: function (username, password) {
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

    getUserRoles: function (username) {
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

async function createServer() {

    const server = new OPCUAServer({
        port: 1234,
        userManager
    });
    await server.initialize();
    await server.start();

    server.on("session_activated", (session) => {
        console.log("username is =", session.userIdentityToken.userName);
    });
    return server;
}
(async () => {

    try {
        const server = await createServer();
        const endpointUrl = "opc.tcp://localhost:1234";

        const client = OPCUAClient.create({ endpointMustExist: false });
        await client.connect(endpointUrl);

        const session = await client.createSession({
            type: UserTokenType.UserName,
            userName: "user1",
            password: "password1"
        })

        await session.close();

        await client.disconnect();


        await server.shutdown();

    } catch (err) {

        console.log("Error", err)
    }
})();