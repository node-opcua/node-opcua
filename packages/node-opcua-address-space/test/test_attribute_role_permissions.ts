// tslint:disable:no-bitwise
import "should";

import { AccessRestrictionsFlag, allPermissions, AttributeIds, makePermissionFlag } from "node-opcua-data-model";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { PermissionType, RolePermissionType } from "node-opcua-types";
import { resolveNodeId } from "node-opcua-nodeid";
import { AddressSpace, Namespace, WellKnownRoles } from "..";
import { getMiniAddressSpace } from "../testHelpers";

const describe = require("node-opcua-leak-detector").describeWithLeakDetector;
describe("testing RolePermission Attribute ", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;

    beforeEach(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
    });

    afterEach(() => {
        addressSpace.dispose();
    });

    const all = makePermissionFlag("Read | Browse");

    it("ARP-1 attribute RolePermission: ", () => {
        const v = namespace.addVariable({
            browseName: "Var",
            dataType: "Double",
            rolePermissions: [
                {
                    roleId: WellKnownRoles.ConfigureAdmin,
                    permissions: allPermissions
                },
                {
                    roleId: WellKnownRoles.Anonymous,
                    permissions: PermissionType.ReadRolePermissions
                },
                {
                    roleId: WellKnownRoles.AuthenticatedUser,
                    permissions: PermissionType.ReadRolePermissions
                }
            ]
        });

        const dataValue = v.readAttribute(null, AttributeIds.RolePermissions);
        dataValue.statusCode.should.eql(StatusCodes.Good);
        dataValue.value.dataType.should.eql(DataType.ExtensionObject);
        dataValue.value.arrayType.should.eql(VariantArrayType.Array);
        dataValue.value.value[0].constructor.name.should.eql("RolePermissionType");

        //xx  if(doDebug) {
        //xx      dataValue.value.value.map(x=>console.log(x.toString()));
        //xx  }

        const rp0 = dataValue.value.value[0] as RolePermissionType;
        rp0.roleId.toString().should.eql(resolveNodeId("WellKnownRole_ConfigureAdmin").toString());
        rp0.permissions.should.eql(allPermissions);

        const rp1 = dataValue.value.value[1] as RolePermissionType;
        rp1.roleId.toString().should.eql(resolveNodeId("WellKnownRole_Anonymous").toString());
        rp1.permissions.should.eql(PermissionType.ReadRolePermissions);

        const rp2 = dataValue.value.value[2] as RolePermissionType;
        rp2.roleId.toString().should.eql(resolveNodeId("WellKnownRole_AuthenticatedUser").toString());
        rp2.permissions.should.eql(PermissionType.ReadRolePermissions);

        // dataValue.value.value.should.eql(AccessRestrictionsFlag.SessionRequired + AccessRestrictionsFlag.SigningRequired)
    });
});
