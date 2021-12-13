"use strict";
const should = require("should");

const {
    allPermissions,
    AttributeIds,
    RolePermissionType,
    PermissionType,
    DataType,
    OPCUAClient,
    StatusCodes,
    Permission,
    WellKnownRoles,
    makeRoles
} = require("node-opcua");
const { build_server_with_temperature_device } = require("../../test_helpers/build_server_with_temperature_device");

const users = [
    { username: "user1", password: "1", roles: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.ConfigureAdmin]) },
    { username: "user2", password: "2", roles: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator]) }
];

// simplistic user manager for test purpose only ( do not use in production !)
const userManager = {
    isValidUser: (username, password) => {
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

    getUserRoles: (username)/*: NodeId[] */ => {
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

// eslint-disable-next-line import/order
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
const { createServerCertificateManager } = require("../../test_helpers/createServerCertificateManager");
describe("issue171- testing Client-Server with UserName/Password identity token", function () {

    let server,  endpointUrl;
    let node1;

    const port = 2224;

    before(async () => {

        const serverCertificateManager = await createServerCertificateManager(port);
        const options = {
            port,
            serverCertificateManager
            //xx            allowAnonymous: false
        };

        server = await build_server_with_temperature_device(options);

        const rolePermission1 = [
            {
                roleId: WellKnownRoles.Anonymous,
                permissions: allPermissions & ~PermissionType.Read & ~PermissionType.Write
            },
            {
                roleId: WellKnownRoles.AuthenticatedUser,
                permissions: allPermissions & ~PermissionType.Write
            },
            {
                roleId: WellKnownRoles.ConfigureAdmin,
                permissions: allPermissions
            }
        ];
        endpointUrl = server.getEndpointUrl();
        // replace user manager with our custom one
        server.userManager = userManager;

        const addressSpace = server.engine.addressSpace;
        const namespace = addressSpace.getOwnNamespace();

        // create a variable that can only be read and written by admin
        node1 = namespace.addVariable({
            browseName: "v1",
            organizedBy: addressSpace.rootFolder.objects,
            dataType: "Double",
            value: { dataType: "Double", value: 3.14 },

            rolePermissions: rolePermission1
        });
    });

    after(async () => {
        await server.shutdown();
    });

    async function read(session) {
        const nodeToRead = {
            nodeId: node1.nodeId.toString(),
            attributeId: AttributeIds.Value
        };
        const dataValue = await session.read(nodeToRead);
        return dataValue.statusCode;
    }

    let _the_value = 45;

    async function write(session) {
        _the_value = _the_value + 1.12;
        const nodesToWrite = [
            {
                nodeId: node1.nodeId.toString(),
                attributeId: AttributeIds.Value,
                value: /*new DataValue(*/ {
                    value: { /* Variant */ dataType: DataType.Double, value: _the_value }
                }
            }
        ];
        const statusCodes = await session.write(nodesToWrite);
        return statusCodes[0];
    }

    it("Anonymous user should not be able to read or to write V1 node value", async () => {
        const client = OPCUAClient.create();

        client.on("backoff", () => {
            console.log("backoff");
        });

        await client.withSessionAsync(endpointUrl, async (session) => {
            // ---------------------------------------------------------------------------------
            // As Anonymous user - access should be denied for read and write
            // ---------------------------------------------------------------------------------
            let statusCode = await read(session);
            statusCode.should.eql(StatusCodes.BadUserAccessDenied);

            statusCode = await write(session);
            statusCode.should.eql(StatusCodes.BadUserAccessDenied);

            // ---------------------------------------------------------------------------------
            // As admin user - access should be granted
            // ---------------------------------------------------------------------------------
            console.log("    impersonate user user1 on existing session (ConfigAdmin)");
            const userIdentity = { userName: "user1", password: "1" };
           
            await client.changeSessionIdentity(session, userIdentity);

            statusCode = await read(session);
            statusCode.should.eql(StatusCodes.Good);

            statusCode = await write(session);
            statusCode.should.eql(StatusCodes.Good);

        });
    });
});
