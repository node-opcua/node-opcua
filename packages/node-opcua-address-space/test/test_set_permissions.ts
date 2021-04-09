import { PermissionType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import * as should  from "should";
import { 
    AddressSpace, 
    UAObject, 
    Namespace, 
    SessionContext, 
    Permission,
    WellKnownRoles,
} from "..";

// let's make sure should don't get removed by typescript optimizer
const keep_should = should;

import { getMiniAddressSpace } from "../testHelpers";

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

    it("checkPermission-1 should obey default flags when variable has no specific permission", () => {
        const context = SessionContext.defaultContext;
        context.getCurrentUserRole = () => {
            return [ WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer ].join(";");
        };

        const someNode = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeNode",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        context.checkPermission(someNode, PermissionType.Read).should.eql(true);
        context.checkPermission(someNode, PermissionType.Write).should.eql(false);
    });
    it("checkPermission-2 should obey default flags when variable has no specific permission", () => {
        const context = SessionContext.defaultContext;
        context.getCurrentUserRole = () => {
            return [ WellKnownRoles.AuthenticatedUser, WellKnownRoles.Engineer ].join(";");
        };

        const someVariable1 = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeVariable1",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        someVariable1.setPermissions({
            [Permission.Read]: ["!*", WellKnownRoles.Engineer],
            [Permission.Write]: ["!*", WellKnownRoles.Engineer],
        });

        context.checkPermission(someVariable1, PermissionType.Read).should.eql(true);
        context.checkPermission(someVariable1, PermissionType.Write).should.eql(true);

        const someVariable2 = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeVariable2",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        someVariable2.setPermissions({
            [Permission.Read]: ["!*", WellKnownRoles.ConfigureAdmin],
            [Permission.Write]: ["!*", WellKnownRoles.ConfigureAdmin]
        });

        context.checkPermission(someVariable2, PermissionType.Read).should.eql(false);
        context.checkPermission(someVariable2, PermissionType.Write).should.eql(false);

        const someVariable3 = addressSpace.getOwnNamespace().addVariable({
            browseName: "SomeVariable3",
            dataType: DataType.Double,
            userAccessLevel: "CurrentRead"
        });
        someVariable3.setPermissions({
            [Permission.Read]: ["*", "!" + WellKnownRoles.Engineer],
            [Permission.Write]: ["!*", "!" + WellKnownRoles.Engineer]
        });

        context.checkPermission(someVariable3, PermissionType.Read).should.eql(false);
        context.checkPermission(someVariable3, PermissionType.Write).should.eql(false);
    });
});


function defaultMehod(): any {

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
    it("checkPermission-1 should obey default flags when method has no specific permission", () => {
  
        const someMethod = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "SomeNode",
            executable: true,
            userExecutable: true,
        });
        someMethod.bindMethod(defaultMehod);

        const context = SessionContext.defaultContext;
        context.getCurrentUserRole = () => {
            return "AuthenticatedUser;Engineer";
        };

        context.checkPermission(someMethod, PermissionType.Call).should.eql(true);

    });
    it("checkPermission-2 should obey default flags when method has no specific permission", () => {
        const context = SessionContext.defaultContext;
        context.getCurrentUserRole = () => {
            return "AuthenticatedUser;Engineer";
        };

        const someMethod = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "SomeNode",
            executable: true,
            userExecutable: true,
        });
        someMethod.bindMethod(defaultMehod);
        
        someMethod.setPermissions({
            [Permission.Call]: ["!*", WellKnownRoles.Engineer],
        });

        context.checkPermission(someMethod, PermissionType.Call).should.eql(true);
  

        const someMethod2 = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "SomeMethod2",
            executable: true,
            userExecutable: true,
        });
        someMethod2.bindMethod(defaultMehod);
        
        someMethod2.setPermissions({
            [Permission.Call]: ["!*", WellKnownRoles.ConfigureAdmin]
        });

        context.checkPermission(someMethod2, PermissionType.Call).should.eql(false);
 
        const someMethod3 = addressSpace.getOwnNamespace().addMethod(someObject, {
            browseName: "SomeMethod3",
            executable: true,
            userExecutable: true,
        });
        someMethod3.bindMethod(defaultMehod);

        
        someMethod3.setPermissions({
            [Permission.Call]: ["!*", WellKnownRoles.ConfigureAdmin]
        });

        context.checkPermission(someMethod3, PermissionType.Call).should.eql(false);
    });

});
