import "should";
import {
    AttributeIds,
    DataType,
    OPCUAClient,
    StatusCodes,
    WellKnownRoles,
    allPermissions,
    PermissionType,
    UserTokenType,
    makeRoles
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { build_server_with_temperature_device } from "../../test_helpers/build_server_with_temperature_device";

interface TestUser { username: string; password: string; roles: any }

const users: TestUser[] = [
    { username: "user1", password: (() => "1")(), roles: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator]) },
    { username: "user2", password: (() => "2")(), roles: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin]) }
];

const userManager = {
    isValidUser(username: string, password: string) {
        const u = users.find((x) => x.username === username);
        return !!u && u.password === password;
    },
    getUserRoles(username: string) {
        const u = users.find((x) => x.username === username);
        if (!u) return makeRoles("Anonymous");
        return u.roles;
    }
};

const port = 2225;

describe("testing Client-Server with UserName/Password identity token (role-based access)", () => {
    let server: any; let endpointUrl: string; let node1: any; let valueCounter = 45;

    before(async () => {
        server = await build_server_with_temperature_device({ port, userManager });
        endpointUrl = server.getEndpointUrl();

        const rolePermissions = [
            { roleId: WellKnownRoles.Anonymous, permissions: allPermissions & ~PermissionType.Read & ~PermissionType.Write },
            { roleId: WellKnownRoles.AuthenticatedUser, permissions: allPermissions & ~PermissionType.Write },
            { roleId: WellKnownRoles.ConfigureAdmin, permissions: allPermissions }
        ];

        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();
        node1 = namespace.addVariable({
            browseName: "v1",
            organizedBy: addressSpace.rootFolder.objects,
            dataType: "Double",
            value: { dataType: "Double", value: 3.14 },
            rolePermissions
        });
    });

    after(async () => { await server.shutdown(); });

    async function read(session: any) {
        const dv = await session.read({ nodeId: node1.nodeId.toString(), attributeId: AttributeIds.Value });
        return dv.statusCode;
    }
    async function write(session: any) {
        valueCounter += 1.12;
        const statusCodes = await session.write([
            { nodeId: node1.nodeId.toString(), attributeId: AttributeIds.Value, value: { value: { dataType: DataType.Double, value: valueCounter } } }
        ]);
        return statusCodes[0];
    }

    it("Operator user should be able to read but not write v1; admin can do both; anonymous none", async () => {
        const client = OPCUAClient.create({});
        await client.withSessionAsync(endpointUrl, async (session) => {
            // Anonymous
            let statusCode = await read(session);
            statusCode.should.eql(StatusCodes.BadUserAccessDenied);
            statusCode = await write(session);
            statusCode.should.eql(StatusCodes.BadUserAccessDenied);

            // Operator
            await session.changeUser({ type: UserTokenType.UserName, userName: "user1", password: (() => "1")() });
            statusCode = await read(session); statusCode.should.eql(StatusCodes.Good);
            statusCode = await write(session); statusCode.should.eql(StatusCodes.BadUserAccessDenied);

            // Admin
            await session.changeUser({ type: UserTokenType.UserName, userName: "user2", password: (() => "2")() });
            statusCode = await read(session); statusCode.should.eql(StatusCodes.Good);
            statusCode = await write(session); statusCode.should.eql(StatusCodes.Good);

            // Back to Anonymous (deprecated path for coverage)
            await client.changeSessionIdentity(session, { type: UserTokenType.Anonymous });
            statusCode = await read(session); statusCode.should.eql(StatusCodes.BadUserAccessDenied);
            statusCode = await write(session); statusCode.should.eql(StatusCodes.BadUserAccessDenied);
        });
    });
});
