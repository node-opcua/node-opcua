

import {
    OPCUAServer,
    resolveNodeId,
    DataType,
    ServerState,
    AttributeIds,
    RolePermissionTypeOptions,
    WellKnownRoles,
    PermissionType,
    AccessRestrictionsFlag,
    nodesets,
    setNamespaceMetaData,
    UserNameIdentityToken,
    UserTokenType
} from "node-opcua";
import {
    TimestampsToReturn,
    OPCUAClient,
} from "node-opcua";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    const server = new OPCUAServer({
        userManager: {
           isValidUser(username:string, password:string) {
            return true;
           }
        }
    });

    await server.initialize();


    const rolePermissions: RolePermissionTypeOptions[] = [
        {
            roleId: WellKnownRoles.Anonymous,
            permissions: PermissionType.None
        },
        {
            roleId: WellKnownRoles.AuthenticatedUser,
            permissions: PermissionType.Read | PermissionType.Write
        }
    ];
    const addressSpace = server.engine.addressSpace!
    const namespace = addressSpace.getOwnNamespace();

    setNamespaceMetaData(namespace);
    
    namespace.setDefaultRolePermissions(rolePermissions);
    namespace.setDefaultAccessRestrictions(AccessRestrictionsFlag.EncryptionRequired);


    var uaObject = namespace.addObject({
        browseName: "MyRestrictedObject",
        nodeId: "s=MyRestrictedObject",
        organizedBy: addressSpace.rootFolder.objects
    });
    var uaVariable = namespace.addVariable({
        browseName: "MyRestrictedVar",
        nodeId: "s=MyRestrictedVar",
        componentOf: uaObject,
        dataType: "Double"
    });
    uaVariable.setValueFromSource({dataType: DataType.Double, value: 13});

    await server.start();
    console.log("Server is now listening ... ( press CTRL+C to stop)");
    console.log(server.getEndpointUrl());

})();

(async () => {
    const client = OPCUAClient.create({ endpointMustExist: false });

    client.on("backoff", () => console.log("keep trying to connect"));

    const dataValue1 = await client.withSessionAsync(
        "opc.tcp://localhost:26543", async (session) => {

            return await session.read({ nodeId: `ns=1;s=MyRestrictedVar`, attributeId: AttributeIds.Value });
        });
    console.log("Anonymous User    : expecting BadUseaccessDenied; actual=", dataValue1.statusCode.toString());

})();
(async () => {
    const client = OPCUAClient.create({ 
        endpointMustExist: false,
    });

    client.on("backoff", () => console.log("keep trying to connect"));

    const dataValue1 = await client.withSessionAsync(
        {
            endpointUrl:"opc.tcp://localhost:26543",
            userIdentity: {
                type: UserTokenType.UserName,
                userName: "some-user",
                password: "whatever"
            }
        }
        , async (session) => {

            return await session.read({ nodeId: `ns=1;s=MyRestrictedVar`, attributeId: AttributeIds.Value });
        });
    console.log("Authenticated User: expecting Good; actual=", dataValue1.statusCode.toString());

})();
