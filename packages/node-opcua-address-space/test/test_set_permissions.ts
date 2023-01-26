import * as should from "should";
import {
    AccessLevelExFlag,
    AccessLevelFlag,
    AccessRestrictionsFlag,
    AttributeIds,
    makeAccessLevelFlag,
    makePermissionFlag
} from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { CallMethodResultOptions, PermissionType, ReadRawModifiedDetails, RolePermissionTypeOptions } from "node-opcua-types";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, Variant } from "node-opcua-variant";
import {
    AddressSpace,
    UAObject,
    Namespace,
    SessionContext,
    WellKnownRoles,
    makeRoles,
    setNamespaceMetaData,
    UAMethod,
    ISessionContext,
    ContinuationPoint,
    ContinuationPointManager
} from "..";

// let's make sure should don't get removed by typescript optimizer
const keep_should = should;

import { date_add, getMiniAddressSpace } from "../testHelpers";

// tslint:disable-next-line:no-var-requires
const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("Variable#setPermissions & checkPermission", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });
    after(() => {
        addressSpace.dispose();
    });

    it("checkPermission-v1 should obey default flags when variable has no specific permission", () => {
        const context = new SessionContext();
        context.getCurrentUserRoles = () => {
            return [WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer].map((r: number) => resolveNodeId(r));
        };

        const someNode = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeNode",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        context.checkPermission(someNode, PermissionType.Read).should.eql(true);
        context.checkPermission(someNode, PermissionType.Write).should.eql(true);

        const dataValue = someNode.readAttribute(context, AttributeIds.UserAccessLevel);
        dataValue.value.value.should.eql(makeAccessLevelFlag("CurrentRead"));
        someNode.isUserWritable(context).should.eql(false);
        someNode.isUserReadable(context).should.eql(true);
    });
    it("checkPermission-v2 should obey default flags when variable has no specific permission", () => {
        const context = new SessionContext();
        context.getCurrentUserRoles = () => {
            return [WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer].map((r: number) => resolveNodeId(r));
        };

        const someVariable1 = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeVariable1",
            dataType: DataType.Double,
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead"
        });
        someVariable1.setRolePermissions([{ roleId: WellKnownRoles.Engineer, permissions: makePermissionFlag("Read | Write") }]);
        // someVariable1.setPermissions({
        //     [Permission.Read]: ["!*", WellKnownRoles.Engineer],
        //     [Permission.Write]: ["!*", WellKnownRoles.Engineer],
        // });

        context.checkPermission(someVariable1, PermissionType.Read).should.eql(true);
        context.checkPermission(someVariable1, PermissionType.Write).should.eql(true);

        const someVariable2 = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeVariable2",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        someVariable2.setRolePermissions([
            { roleId: WellKnownRoles.ConfigureAdmin, permissions: makePermissionFlag("Read | Write") }
        ]);
        // someVariable2.setPermissions({
        //     [Permission.Read]: ["!*", WellKnownRoles.ConfigureAdmin],
        //     [Permission.Write]: ["!*", WellKnownRoles.ConfigureAdmin]
        // });

        context.checkPermission(someVariable2, PermissionType.Read).should.eql(false);
        context.checkPermission(someVariable2, PermissionType.Write).should.eql(false);

        const someVariable3 = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeVariable3",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        someVariable3.setRolePermissions([
            { roleId: WellKnownRoles.ConfigureAdmin, permissions: makePermissionFlag("Read | Write") }
        ]);
        // someVariable3.setPermissions({
        //     [Permission.Read]: ["*", "!" + WellKnownRoles.Engineer],
        //     [Permission.Write]: ["!*", "!" + WellKnownRoles.Engineer]
        // });

        context.checkPermission(someVariable3, PermissionType.Read).should.eql(false);
        context.checkPermission(someVariable3, PermissionType.Write).should.eql(false);
    });
});

async function defaultMethod(
    this: UAMethod,
    inputArguments: Variant[],
    context: ISessionContext
): Promise<CallMethodResultOptions> {
    /** empty */
    return { statusCode: StatusCodes.Good };
}
describe("Method#setPermissions & checkPermission", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let someObject: UAObject;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
        someObject = addressSpace.getOwnNamespace().addObject({
            browseName: "SomeName",
            nodeId: "i=13"
        });
    });
    after(() => {
        addressSpace.dispose();
    });
    it("checkPermission-m1 should obey default flags when method has no specific permission", () => {
        const someMethod = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "SomeNode",
            executable: true,
            userExecutable: true
        });
        someMethod.bindMethod(defaultMethod);

        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);

        context.checkPermission(someMethod, PermissionType.Call).should.eql(true);
    });
    it("checkPermission-m2 should obey default flags when method has no specific permission", () => {
        const context = new SessionContext();
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);

        const someMethod = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "SomeNode",
            executable: true,
            userExecutable: true
        });
        someMethod.bindMethod(defaultMethod);

        someMethod.setRolePermissions([{ roleId: WellKnownRoles.Engineer, permissions: makePermissionFlag("Call") }]);
        // someMethod.setPermissions({
        //     [Permission.Call]: ["!*", WellKnownRoles.Engineer],
        // });

        context.checkPermission(someMethod, PermissionType.Call).should.eql(true);

        const someMethod2 = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "SomeMethod2",
            executable: true,
            userExecutable: true
        });
        someMethod2.bindMethod(defaultMethod);

        someMethod2.setRolePermissions([{ roleId: WellKnownRoles.ConfigureAdmin, permissions: makePermissionFlag("Call") }]);
        // someMethod2.setPermissions({
        //     [Permission.Call]: ["!*", WellKnownRoles.ConfigureAdmin]
        // });
        context.checkPermission(someMethod2, PermissionType.Call).should.eql(false);

        const someMethod3 = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "SomeMethod3",
            executable: true,
            userExecutable: true
        });
        someMethod3.bindMethod(defaultMethod);

        someMethod3.setRolePermissions([{ roleId: WellKnownRoles.ConfigureAdmin, permissions: makePermissionFlag("Call") }]);
        // someMethod3.setPermissions({
        //     [Permission.Call]: ["!*", WellKnownRoles.ConfigureAdmin]
        // });

        context.checkPermission(someMethod3, PermissionType.Call).should.eql(false);
    });
    it("checkPermission-m3 UserExecutable flag should be false if user has no Call permission #1197", () => {
        const namespace1 = addressSpace.getOwnNamespace();
        const context = new SessionContext();

        const someMethod = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "MethodForTest3",
            executable: true,
            userExecutable: true
        });
        someMethod.bindMethod(defaultMethod);
        someMethod.setRolePermissions([{ roleId: WellKnownRoles.Engineer, permissions: makePermissionFlag("Call") }]);

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);
        someMethod.readAttribute(context, AttributeIds.Executable).value.value.should.eql(true);
        someMethod.readAttribute(context, AttributeIds.UserExecutable).value.value.should.eql(true);

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);
        someMethod.readAttribute(context, AttributeIds.Executable).value.value.should.eql(true);
        someMethod.readAttribute(context, AttributeIds.UserExecutable).value.value.should.eql(false);
    });

    it("checkPermission-WriteHistorizing", async () => {
        const namespace1 = addressSpace.getOwnNamespace();
        const context = new SessionContext();

        const uaVariable = addressSpace.getOwnNamespace().addVariable({
            browseName: "VariableForTestHistorizing",
            dataType: "Double",
            historizing: true
        });
        uaVariable.setRolePermissions([{ roleId: WellKnownRoles.Engineer, permissions: PermissionType.ReadHistory | PermissionType.WriteHistorizing }]);
        const haConfiguration = addressSpace.getOwnNamespace().addObject({
            componentOf: uaVariable,
            browseName: "HA Configuration"
        });

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);
        (
            await uaVariable.writeAttribute(context, {
                attributeId: AttributeIds.Historizing,
                value: { value: { dataType: DataType.Boolean, value: true } }
            })
        ).should.eql(StatusCodes.Good);

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);
        (
            await uaVariable.writeAttribute(context, {
                attributeId: AttributeIds.Historizing,
                value: { value: { dataType: DataType.Boolean, value: true } }
            })
        ).should.eql(StatusCodes.BadUserAccessDenied);
    });

    it("checkPermission-ReadHistory", async () => {
        const namespace1 = addressSpace.getOwnNamespace();
        const context = new SessionContext({
            session: {
                getSessionId() {
                    return NodeId.nullNodeId;
                },
                continuationPointManager: new ContinuationPointManager()
            }
        });

        const uaVariable = addressSpace.getOwnNamespace().addVariable({
            browseName: "VariableForTestReadHistory",
            dataType: "Double",
            historizing: true,
            accessLevel: AccessLevelFlag.HistoryRead | AccessLevelFlag.HistoryWrite
        });
        addressSpace.installHistoricalDataNode(uaVariable, {
            maxOnlineValues: 3 // Only very few values !!!!
        });
        uaVariable.setRolePermissions([{ roleId: WellKnownRoles.Engineer, permissions: PermissionType.ReadHistory }]);
        const haConfiguration = addressSpace.getOwnNamespace().addObject({
            componentOf: uaVariable,
            browseName: "HA Configuration"
        });

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);
        (uaVariable as any).canUserReadHistory(context).should.eql(true);
        (uaVariable as any).canUserInsertHistory(context).should.eql(false);
        (uaVariable as any).canUserModifyHistory(context).should.eql(false);
        (uaVariable as any).canUserDeleteHistory(context).should.eql(false);

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);
        (uaVariable as any).canUserReadHistory(context).should.eql(false);
        (uaVariable as any).canUserInsertHistory(context).should.eql(false);
        (uaVariable as any).canUserModifyHistory(context).should.eql(false);
        (uaVariable as any).canUserDeleteHistory(context).should.eql(false);

        const today = new Date();

        const historyReadDetails = new ReadRawModifiedDetails({
            endTime: date_add(today, { seconds: 10 }),
            isReadModified: false,
            numValuesPerNode: 1000,
            returnBounds: true,
            startTime: date_add(today, { seconds: -10 })
        });
        const indexRange = null;
        const dataEncoding = null;
        const continuationPoint: ContinuationPoint | null = null;

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);
        {
            const r = await uaVariable.historyRead(context, historyReadDetails, indexRange, dataEncoding, { continuationPoint });
            r.statusCode.should.eql(StatusCodes.GoodNoData);
        }
        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);
        {
            const r = await uaVariable.historyRead(context, historyReadDetails, indexRange, dataEncoding, { continuationPoint });
            r.statusCode.should.eql(StatusCodes.BadUserAccessDenied);
        }
    });

    it("checkPermission-InsertHistory", async () => {
        const namespace1 = addressSpace.getOwnNamespace();
        const context = new SessionContext();

        const uaVariable = addressSpace.getOwnNamespace().addVariable({
            browseName: "VariableForTestInsertHistory",
            dataType: "Double",
            historizing: true,
            accessLevel: AccessLevelFlag.HistoryRead | AccessLevelFlag.HistoryWrite
        });
        uaVariable.setRolePermissions([{ roleId: WellKnownRoles.Engineer, permissions: PermissionType.InsertHistory }]);
        const haConfiguration = addressSpace.getOwnNamespace().addObject({
            componentOf: uaVariable,
            browseName: "HA Configuration"
        });

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);
        (uaVariable as any).canUserInsertHistory(context).should.eql(true);
        (uaVariable as any).canUserModifyHistory(context).should.eql(false);
        (uaVariable as any).canUserDeleteHistory(context).should.eql(false);

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);
        (uaVariable as any).canUserInsertHistory(context).should.eql(false);
        (uaVariable as any).canUserModifyHistory(context).should.eql(false);
        (uaVariable as any).canUserDeleteHistory(context).should.eql(false);
    });

    it("checkPermission-ModifyHistory", async () => {
        const namespace1 = addressSpace.getOwnNamespace();
        const context = new SessionContext();

        const uaVariable = addressSpace.getOwnNamespace().addVariable({
            browseName: "VariableForTestModifyHistory",
            dataType: "Double",
            historizing: true,
            accessLevel: AccessLevelFlag.HistoryRead | AccessLevelFlag.HistoryWrite
        });
        uaVariable.setRolePermissions([{ roleId: WellKnownRoles.Engineer, permissions: PermissionType.ModifyHistory }]);
        const haConfiguration = addressSpace.getOwnNamespace().addObject({
            componentOf: uaVariable,
            browseName: "HA Configuration"
        });

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);
        (uaVariable as any).canUserReadHistory(context).should.eql(false);
        (uaVariable as any).canUserInsertHistory(context).should.eql(false);
        (uaVariable as any).canUserModifyHistory(context).should.eql(true);
        (uaVariable as any).canUserDeleteHistory(context).should.eql(false);

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);
        (uaVariable as any).canUserReadHistory(context).should.eql(false);
        (uaVariable as any).canUserInsertHistory(context).should.eql(false);
        (uaVariable as any).canUserModifyHistory(context).should.eql(false);
        (uaVariable as any).canUserDeleteHistory(context).should.eql(false);
    });
    it("checkPermission-DeleteHistory", async () => {
        const namespace1 = addressSpace.getOwnNamespace();
        const context = new SessionContext();

        const uaVariable = addressSpace.getOwnNamespace().addVariable({
            browseName: "VariableForTestDeleteHistory",
            dataType: "Double",
            historizing: true,
            accessLevel: AccessLevelFlag.HistoryRead | AccessLevelFlag.HistoryWrite
        });
        uaVariable.setRolePermissions([{ roleId: WellKnownRoles.Engineer, permissions: PermissionType.DeleteHistory }]);
        const haConfiguration = addressSpace.getOwnNamespace().addObject({
            componentOf: uaVariable,
            browseName: "HA Configuration"
        });

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);
        (uaVariable as any).canUserReadHistory(context).should.eql(false);
        (uaVariable as any).canUserInsertHistory(context).should.eql(false);
        (uaVariable as any).canUserModifyHistory(context).should.eql(false);
        (uaVariable as any).canUserDeleteHistory(context).should.eql(true);

        context.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);
        (uaVariable as any).canUserReadHistory(context).should.eql(false);
        (uaVariable as any).canUserInsertHistory(context).should.eql(false);
        (uaVariable as any).canUserModifyHistory(context).should.eql(false);
        (uaVariable as any).canUserDeleteHistory(context).should.eql(false);
    });
});

describe("Namespace Permission", () => {
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = await getMiniAddressSpace();
        const namespace1 = addressSpace.getOwnNamespace();
        console.log(namespace1.namespaceUri);
        setNamespaceMetaData(namespace1);
    });
    after(() => {
        addressSpace.dispose();
    });

    it("a variable without permissions should expose the default permission of its parent namespace", () => {
        const namespace1 = addressSpace.getOwnNamespace();

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
        namespace1.setDefaultRolePermissions(rolePermissions);

        const someObject = namespace1.addObject({
            browseName: "SomeName"
        });
        someObject.nodeId.namespace.should.eql(namespace1.index);

        should(someObject.getRolePermissions(false)).eql(null);
        should(someObject.getRolePermissions(true)!.map(({ roleId, permissions }) => ({ roleId: roleId.value, permissions }))).eql(
            rolePermissions
        );

        const contextAuthenticated = new SessionContext();
        contextAuthenticated.getCurrentUserRoles = () => makeRoles([WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer]);

        contextAuthenticated.checkPermission(someObject, PermissionType.Call).should.eql(false);
        contextAuthenticated.checkPermission(someObject, PermissionType.Read).should.eql(true);
        contextAuthenticated.checkPermission(someObject, PermissionType.Write).should.eql(true);
        contextAuthenticated.checkPermission(someObject, PermissionType.Browse).should.eql(false);

        const contextAnonymous = new SessionContext();
        contextAnonymous.getCurrentUserRoles = () => makeRoles([WellKnownRoles.Anonymous]);

        contextAnonymous.checkPermission(someObject, PermissionType.Call).should.eql(false);
        contextAnonymous.checkPermission(someObject, PermissionType.Read).should.eql(false);
        contextAnonymous.checkPermission(someObject, PermissionType.Write).should.eql(false);
        contextAnonymous.checkPermission(someObject, PermissionType.Browse).should.eql(false);
    });
    it("a variable without permissions should expose the default AccessRestriction of its parent namespace", () => {
        // given a address space with 2 namespaces
        const namespace1 = addressSpace.getOwnNamespace();

        namespace1.setDefaultAccessRestrictions(AccessRestrictionsFlag.EncryptionRequired);

        const someObject = namespace1.addObject({
            browseName: "SomeName3"
        });

        someObject.getAccessRestrictions(true).should.eql(AccessRestrictionsFlag.EncryptionRequired);

        someObject.getAccessRestrictions(false).should.eql(AccessRestrictionsFlag.None);
    });
});
