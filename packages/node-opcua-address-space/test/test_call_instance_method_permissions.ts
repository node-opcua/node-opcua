import { AccessRestrictionsFlag, makePermissionFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import type { NodeId } from "node-opcua-nodeid";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import {
    type AddressSpace,
    type ISessionContext,
    makeRoles,
    type Namespace,
    PseudoSession,
    SessionContext,
    type UAMethod,
    type UAObject,
    type UAObjectType,
    WellKnownRoles
} from "../dist/api/index.js";
import { getMiniAddressSpace, makeMockSessionContext } from "../testHelpers.js";

// OPC 10000-4 v1.05.07 §5.12.2 Call, methodId: "Independent of the methodId parameter, the RolePermissions are
// always verified with the Method Node that is the target of a HasComponent from the Node defined by objectId."
describe("Call verifies the instance Method whatever methodId names (OPC 10000-4 v1.05.07 §5.12.2)", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    let deviceType: UAObjectType;
    let typeDoIt: UAMethod;
    let typeDoLater: UAMethod;
    let typeStaticOp: UAMethod;

    let encryptedDevice: UAObject; // instance methods require SignAndEncrypt
    let operatorDevice: UAObject; // instance methods callable by Operator only
    let ownImplDevice: UAObject; // instance method with an implementation of its own
    let otherObject: UAObject;

    const executed: string[] = [];

    function outputOf(tag: string) {
        return async function (this: UAMethod, _inputArguments: Variant[], context: ISessionContext) {
            executed.push(`${tag}:${context.object?.browseName.toString()}`);
            return {
                statusCode: StatusCodes.Good,
                outputArguments: [new Variant({ dataType: DataType.String, value: tag })]
            };
        };
    }

    function restrictMethods(obj: UAObject, apply: (m: UAMethod) => void) {
        for (const m of obj.getMethods()) {
            apply(m);
        }
    }

    const operatorOnly = [
        { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse | Call") },
        { roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Browse") }
    ];

    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();

        deviceType = namespace.addObjectType({ browseName: "SecuredDeviceType" });
        const methodOptions = {
            modellingRule: "Mandatory" as const,
            inputArguments: [],
            outputArguments: [{ name: "Result", dataType: DataType.String }]
        };
        typeDoIt = namespace.addMethod(deviceType, { browseName: "DoIt", ...methodOptions });
        typeDoLater = namespace.addMethod(deviceType, { browseName: "DoLater", ...methodOptions });
        // not instantiated: only exists on the ObjectType
        typeStaticOp = namespace.addMethod(deviceType, {
            browseName: "StaticOp",
            inputArguments: [],
            outputArguments: [{ name: "Result", dataType: DataType.String }]
        });

        // bound before instantiation: every instance clones this implementation
        typeDoIt.bindMethod(outputOf("DoIt"));
        typeStaticOp.bindMethod(outputOf("StaticOp"));

        encryptedDevice = deviceType.instantiate({ browseName: "EncryptedDevice", organizedBy: addressSpace.rootFolder.objects });
        operatorDevice = deviceType.instantiate({ browseName: "OperatorDevice", organizedBy: addressSpace.rootFolder.objects });
        ownImplDevice = deviceType.instantiate({ browseName: "OwnImplDevice", organizedBy: addressSpace.rootFolder.objects });

        // bound after instantiation: the instances' DoLater have no implementation, the type's runs
        typeDoLater.bindMethod(outputOf("DoLater"));

        restrictMethods(encryptedDevice, (m) => m.setAccessRestrictions(AccessRestrictionsFlag.EncryptionRequired));
        restrictMethods(operatorDevice, (m) => m.setRolePermissions(operatorOnly));
        ownImplDevice.getMethodByName("DoIt")?.bindMethod(outputOf("OwnDoIt"));

        otherObject = namespace.addObject({ browseName: "OtherObject", organizedBy: addressSpace.rootFolder.objects });
        const unrelated = namespace.addMethod(otherObject, {
            browseName: "DoIt",
            inputArguments: [],
            outputArguments: [{ name: "Result", dataType: DataType.String }]
        });
        unrelated.bindMethod(outputOf("Unrelated"));
    });
    after(() => {
        addressSpace.dispose();
    });
    beforeEach(() => {
        executed.length = 0;
    });

    function instanceMethodId(obj: UAObject, name: string): NodeId {
        const m = obj.getMethodByName(name);
        should(m).not.eql(null);
        return (m as UAMethod).nodeId;
    }

    async function call(context: ISessionContext, objectId: NodeId, methodId: NodeId): Promise<StatusCode> {
        const session = new PseudoSession(addressSpace, context);
        const result = await session.call({ objectId, methodId, inputArguments: [] });
        return result.statusCode;
    }

    const none = () => makeMockSessionContext({ userName: "anonymous", securityMode: MessageSecurityMode.None });
    const encrypted = () => makeMockSessionContext({ userName: "anonymous", securityMode: MessageSecurityMode.SignAndEncrypt });
    function withRoles(roles: number[]) {
        const context = makeMockSessionContext({ userName: "joe", securityMode: MessageSecurityMode.SignAndEncrypt });
        context.getCurrentUserRoles = () => makeRoles(roles);
        return context;
    }

    describe("AccessRestrictions EncryptionRequired on the instance method", () => {
        for (const name of ["DoIt", "DoLater"]) {
            it(`${name}: a None channel gets BadSecurityModeInsufficient through the instance and the type method id`, async () => {
                const typeMethod = name === "DoIt" ? typeDoIt : typeDoLater;
                should(await call(none(), encryptedDevice.nodeId, instanceMethodId(encryptedDevice, name))).eql(
                    StatusCodes.BadSecurityModeInsufficient
                );
                should(await call(none(), encryptedDevice.nodeId, typeMethod.nodeId)).eql(StatusCodes.BadSecurityModeInsufficient);
                should(executed).eql([]);
            });
            it(`${name}: a SignAndEncrypt channel succeeds through both ids`, async () => {
                const typeMethod = name === "DoIt" ? typeDoIt : typeDoLater;
                should(await call(encrypted(), encryptedDevice.nodeId, instanceMethodId(encryptedDevice, name))).eql(
                    StatusCodes.Good
                );
                should(await call(encrypted(), encryptedDevice.nodeId, typeMethod.nodeId)).eql(StatusCodes.Good);
                should(executed).eql([`${name}:1:EncryptedDevice`, `${name}:1:EncryptedDevice`]);
            });
        }
    });

    describe("RolePermissions on the instance method", () => {
        for (const name of ["DoIt", "DoLater"]) {
            it(`${name}: a user without Call gets BadUserAccessDenied through the instance and the type method id`, async () => {
                const typeMethod = name === "DoIt" ? typeDoIt : typeDoLater;
                const denied = withRoles([WellKnownRoles.AuthenticatedUser]);
                should(await call(denied, operatorDevice.nodeId, instanceMethodId(operatorDevice, name))).eql(
                    StatusCodes.BadUserAccessDenied
                );
                should(await call(denied, operatorDevice.nodeId, typeMethod.nodeId)).eql(StatusCodes.BadUserAccessDenied);
                should(executed).eql([]);
            });
            it(`${name}: an Operator succeeds through both ids`, async () => {
                const typeMethod = name === "DoIt" ? typeDoIt : typeDoLater;
                const allowed = withRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Operator]);
                should(await call(allowed, operatorDevice.nodeId, instanceMethodId(operatorDevice, name))).eql(StatusCodes.Good);
                should(await call(allowed, operatorDevice.nodeId, typeMethod.nodeId)).eql(StatusCodes.Good);
                should(executed).eql([`${name}:1:OperatorDevice`, `${name}:1:OperatorDevice`]);
            });
        }
        it("BadSecurityModeInsufficient comes before BadUserAccessDenied, as in UAMethod#execute", async () => {
            const both = encryptedDevice.getMethodByName("DoIt") as UAMethod;
            both.setRolePermissions(operatorOnly);
            try {
                const denied = makeMockSessionContext({ userName: "joe", securityMode: MessageSecurityMode.None });
                denied.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser]);
                should(await call(denied, encryptedDevice.nodeId, both.nodeId)).eql(StatusCodes.BadSecurityModeInsufficient);
                should(await call(denied, encryptedDevice.nodeId, typeDoIt.nodeId)).eql(StatusCodes.BadSecurityModeInsufficient);
            } finally {
                both.setRolePermissions([
                    { roleId: WellKnownRoles.Anonymous, permissions: makePermissionFlag("Browse | Call") },
                    { roleId: WellKnownRoles.AuthenticatedUser, permissions: makePermissionFlag("Browse | Call") }
                ]);
            }
        });
    });

    describe("which implementation runs", () => {
        it("the instance's own implementation runs when the type method id is used", async () => {
            should(await call(SessionContext.defaultContext, ownImplDevice.nodeId, typeDoIt.nodeId)).eql(StatusCodes.Good);
            should(await call(SessionContext.defaultContext, ownImplDevice.nodeId, instanceMethodId(ownImplDevice, "DoIt"))).eql(
                StatusCodes.Good
            );
            should(executed).eql(["OwnDoIt:1:OwnImplDevice", "OwnDoIt:1:OwnImplDevice"]);
        });
        it("the type's implementation runs, with the instance as object, when the instance method has none", async () => {
            should((ownImplDevice.getMethodByName("DoLater") as UAMethod).isBound()).eql(false);
            should(await call(SessionContext.defaultContext, ownImplDevice.nodeId, typeDoLater.nodeId)).eql(StatusCodes.Good);
            should(executed).eql(["DoLater:1:OwnImplDevice"]);
        });
    });

    describe("methods with no instance component", () => {
        it("a method defined only on the ObjectType can be called on the ObjectType", async () => {
            should(await call(none(), deviceType.nodeId, typeStaticOp.nodeId)).eql(StatusCodes.Good);
            should(executed).eql(["StaticOp:1:SecuredDeviceType"]);
        });
        it("a type method with no instance component can still be called on an instance", async () => {
            should(encryptedDevice.getMethodByName("StaticOp")).eql(null);
            should(await call(none(), encryptedDevice.nodeId, typeStaticOp.nodeId)).eql(StatusCodes.Good);
            should(executed).eql(["StaticOp:1:EncryptedDevice"]);
        });
        it("a type method of the ObjectType itself is verified on the ObjectType's method", async () => {
            should(await call(none(), deviceType.nodeId, typeDoIt.nodeId)).eql(StatusCodes.Good);
            should(executed).eql(["DoIt:1:SecuredDeviceType"]);
        });
    });

    describe("a methodId that is not a method of the object or of its types", () => {
        it("the method of an unrelated object gives BadMethodInvalid", async () => {
            const unrelated = instanceMethodId(otherObject, "DoIt");
            should(await call(SessionContext.defaultContext, encryptedDevice.nodeId, unrelated)).eql(StatusCodes.BadMethodInvalid);
            should(executed).eql([]);
        });
        it("the method of another instance of the same type gives BadMethodInvalid", async () => {
            const sibling = instanceMethodId(ownImplDevice, "DoIt");
            should(await call(encrypted(), encryptedDevice.nodeId, sibling)).eql(StatusCodes.BadMethodInvalid);
            should(await call(none(), encryptedDevice.nodeId, sibling)).eql(StatusCodes.BadMethodInvalid);
            should(executed).eql([]);
        });
        it("an instance method called on its ObjectType gives BadMethodInvalid", async () => {
            should(await call(SessionContext.defaultContext, deviceType.nodeId, instanceMethodId(ownImplDevice, "DoIt"))).eql(
                StatusCodes.BadMethodInvalid
            );
        });
    });
});
