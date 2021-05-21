import {allPermissions, OPCUAClient, OPCUAServer, StatusCodes, UserTokenType, WellKnownRoles, makeRoles} from "node-opcua";
import "should";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Issue #896: Check Authorization for UAMethods", () => {
    const users = [
        {username: "Gandalf", password: "g", roles: makeRoles([WellKnownRoles.AuthenticatedUser,WellKnownRoles.ConfigureAdmin])},
        {username: "Frodo", password: "f", roles:  makeRoles([WellKnownRoles.AuthenticatedUser])},
    ];

    const port = 2226;
    const server = new OPCUAServer({
        port,
        userManager: {
            getUserRoles: username => users.find(user => user.username === username)!.roles,
            
            isValidUser(username, password) {
                const user = users.find(user => user.username === username);
                if (!user) return false;
                return user.password === password;
            }
        }
    })

    const client = OPCUAClient.create({
        endpointMustExist: false,
    });

    let wasExecuted: boolean;

    before(async () => {
        await server.initialize();
        const addressSpace = server.engine.addressSpace!;
        const namespace = addressSpace.getOwnNamespace();
        const folder = namespace.addFolder(addressSpace.rootFolder.objects, {
            browseName: "e2e",
            nodeId: "ns=1;s=e2e"
        });
        namespace.addMethod(folder, {
            browseName: "doIt",
            nodeId: "ns=1;s=doIt",
            rolePermissions: [
                { 
                    roleId:  WellKnownRoles.ConfigureAdmin,
                    permissions: allPermissions
                }
            ]
            /*
            permissions: {
                 [Permission.Call]: ["!*", WellKnownRoles.ConfigureAdmin]
            }
            */
        }).bindMethod((inputArguments, context, callback) => {
            wasExecuted = true;
            callback(null, {statusCode: StatusCodes.Good})
        });
        await server.start();
        return client.connect(`opc.tcp://localhost:${port}/UA/NodeOPCUA`);
    });

    after(async () => {
        await client.disconnect();
        await server.shutdown();
    });

    beforeEach(() => wasExecuted = false);

    it("should allow Gandalf to execute the method", async () => {
        let clientSession = await client.createSession({
            type: UserTokenType.UserName,
            userName: "Gandalf",
            password: "g"
        });
        const result = await clientSession.call({
            methodId: "ns=1;s=doIt",
            objectId: "ns=1;s=e2e",
            inputArguments: [],
        });
        await clientSession.close();
        result.statusCode.should.eql(StatusCodes.Good);
        wasExecuted.should.eql(true);
    });

    it("should deny Frodo to execute the method", async () => {
        let clientSession = await client.createSession({
            type: UserTokenType.UserName,
            userName: "Frodo",
            password: "f"
        });
        const result = await clientSession.call({
            methodId: "ns=1;s=doIt",
            objectId: "ns=1;s=e2e",
            inputArguments: [],
        });
        await clientSession.close();
        result.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
        wasExecuted.should.eql(false);
    });
});