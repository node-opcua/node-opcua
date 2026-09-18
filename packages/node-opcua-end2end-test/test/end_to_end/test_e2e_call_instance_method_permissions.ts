import {
    AccessRestrictionsFlag,
    type AddressSpace,
    DataType,
    type ISessionContext,
    MessageSecurityMode,
    makePermissionFlag,
    makeRoles,
    OPCUACertificateManager,
    OPCUAClient,
    OPCUAServer,
    SecurityPolicy,
    StatusCodes,
    type UAMethod,
    type UAObject,
    type UserIdentityInfo,
    UserTokenType,
    type Variant,
    WellKnownRoles
} from "node-opcua";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import should from "should";
import { tmpFolderFor } from "../../test_helpers/paths.js";

// OPC 10000-4 v1.05.07 §5.12.2 Call, methodId: "If the objectId is the NodeId of an Object, the methodId is either the NodeId
// of the Method that is a component of the Object instance or the NodeId of the Method in the ObjectType that defines
// the Method. Independent of the methodId parameter, the RolePermissions are always verified with the Method Node
// that is the target of a HasComponent from the Node defined by objectId."
describe("Call verifies the instance Method when the ObjectType Method id is used", () => {
    const port = 2898;
    const users = [
        {
            username: "operator",
            password: (() => "op")(),
            roles: makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator])
        },
        { username: "observer", password: (() => "ob")(), roles: makeRoles([WellKnownRoles.AuthenticatedUser]) }
    ];

    let server: OPCUAServer;
    let certificateManager: OPCUACertificateManager;
    let executed = 0;

    let typeMethodId: string;
    let encryptedObjectId: string;
    let encryptedMethodId: string;
    let operatorObjectId: string;
    let operatorMethodId: string;
    let deviceTypeId: string;
    let staticMethodId: string;

    before(async () => {
        certificateManager = new OPCUACertificateManager({
            automaticallyAcceptUnknownCertificate: true,
            rootFolder: tmpFolderFor("call_instance_method_permissions")
        });
        await certificateManager.initialize();

        server = new OPCUAServer({
            port,
            serverCertificateManager: certificateManager,
            userManager: {
                getUserRoles: (username: string) => users.find((u) => u.username === username)?.roles ?? [],
                isValidUser: (username: string, password: string) =>
                    users.find((u) => u.username === username)?.password === password
            }
        });
        await server.initialize();
        const addressSpace = server.engine.addressSpace as AddressSpace;
        const namespace = addressSpace.getOwnNamespace();

        const deviceType = namespace.addObjectType({ browseName: "SecuredDeviceType" });
        const typeMethod = namespace.addMethod(deviceType, {
            browseName: "DoIt",
            modellingRule: "Mandatory",
            inputArguments: [],
            outputArguments: [{ name: "Result", dataType: DataType.String }]
        });
        const staticMethod = namespace.addMethod(deviceType, {
            browseName: "StaticOp",
            inputArguments: [],
            outputArguments: [{ name: "Result", dataType: DataType.String }]
        });
        const implementation = async (_inputArguments: Variant[], _context: ISessionContext) => {
            executed++;
            return { statusCode: StatusCodes.Good, outputArguments: [{ dataType: DataType.String, value: "done" }] };
        };
        typeMethod.bindMethod(implementation);
        staticMethod.bindMethod(implementation);

        const encryptedObject = deviceType.instantiate({
            browseName: "EncryptedDevice",
            organizedBy: addressSpace.rootFolder.objects
        }) as UAObject;
        const encryptedMethod = encryptedObject.getMethodByName("DoIt") as UAMethod;
        encryptedMethod.setAccessRestrictions(AccessRestrictionsFlag.EncryptionRequired);

        const operatorObject = deviceType.instantiate({
            browseName: "OperatorDevice",
            organizedBy: addressSpace.rootFolder.objects
        }) as UAObject;
        const operatorMethod = operatorObject.getMethodByName("DoIt") as UAMethod;
        operatorMethod.setRolePermissions([
            { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse | Call") },
            { roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Browse") },
            { roleId: WellKnownRoles.Anonymous, permissions: makePermissionFlag("Browse") }
        ]);

        typeMethodId = typeMethod.nodeId.toString();
        staticMethodId = staticMethod.nodeId.toString();
        deviceTypeId = deviceType.nodeId.toString();
        encryptedObjectId = encryptedObject.nodeId.toString();
        encryptedMethodId = encryptedMethod.nodeId.toString();
        operatorObjectId = operatorObject.nodeId.toString();
        operatorMethodId = operatorMethod.nodeId.toString();

        await server.start();
    });
    after(async () => {
        await server.shutdown();
        await certificateManager.dispose();
    });
    beforeEach(() => {
        executed = 0;
    });

    async function callWith(
        securityMode: MessageSecurityMode,
        userIdentity: UserIdentityInfo,
        calls: { objectId: string; methodId: string }[]
    ) {
        const client = OPCUAClient.create({
            endpointMustExist: false,
            securityMode,
            securityPolicy: securityMode === MessageSecurityMode.None ? SecurityPolicy.None : SecurityPolicy.Basic256Sha256,
            clientCertificateManager: certificateManager
        });
        return await client.withSessionAsync({ endpointUrl: server.getEndpointUrl(), userIdentity }, async (session) => {
            const results = await session.call(calls.map((c) => ({ ...c, inputArguments: [] })));
            return results.map((r) => r.statusCode);
        });
    }

    const anonymous: UserIdentityInfo = { type: UserTokenType.Anonymous };
    const operator: UserIdentityInfo = { type: UserTokenType.UserName, userName: "operator", password: (() => "op")() };
    const observer: UserIdentityInfo = { type: UserTokenType.UserName, userName: "observer", password: (() => "ob")() };

    it("EncryptionRequired: a None channel gets BadSecurityModeInsufficient through the instance and the type method id", async () => {
        const statusCodes = await callWith(MessageSecurityMode.None, anonymous, [
            { objectId: encryptedObjectId, methodId: encryptedMethodId },
            { objectId: encryptedObjectId, methodId: typeMethodId }
        ]);
        should(statusCodes).eql([StatusCodes.BadSecurityModeInsufficient, StatusCodes.BadSecurityModeInsufficient]);
        should(executed).eql(0);
    });
    it("EncryptionRequired: a SignAndEncrypt channel succeeds through both ids", async () => {
        const statusCodes = await callWith(MessageSecurityMode.SignAndEncrypt, anonymous, [
            { objectId: encryptedObjectId, methodId: encryptedMethodId },
            { objectId: encryptedObjectId, methodId: typeMethodId }
        ]);
        should(statusCodes).eql([StatusCodes.Good, StatusCodes.Good]);
        should(executed).eql(2);
    });
    it("RolePermissions: a user without Call gets BadUserAccessDenied through the instance and the type method id", async () => {
        const statusCodes = await callWith(MessageSecurityMode.SignAndEncrypt, observer, [
            { objectId: operatorObjectId, methodId: operatorMethodId },
            { objectId: operatorObjectId, methodId: typeMethodId }
        ]);
        should(statusCodes).eql([StatusCodes.BadUserAccessDenied, StatusCodes.BadUserAccessDenied]);
        should(executed).eql(0);
    });
    it("RolePermissions: the allowed user succeeds through both ids", async () => {
        const statusCodes = await callWith(MessageSecurityMode.SignAndEncrypt, operator, [
            { objectId: operatorObjectId, methodId: operatorMethodId },
            { objectId: operatorObjectId, methodId: typeMethodId }
        ]);
        should(statusCodes).eql([StatusCodes.Good, StatusCodes.Good]);
        should(executed).eql(2);
    });
    it("a method defined only on the ObjectType can still be called on the ObjectType", async () => {
        const statusCodes = await callWith(MessageSecurityMode.None, anonymous, [
            { objectId: deviceTypeId, methodId: staticMethodId }
        ]);
        should(statusCodes).eql([StatusCodes.Good]);
        should(executed).eql(1);
    });
});
