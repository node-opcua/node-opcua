import { makePermissionFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { PermissionType, RolePermissionType } from "node-opcua-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";
import should from "should";
import {
    AddressSpace,
    type INamespace,
    makeRoles,
    setNamespaceMetaData,
    type UAVariable,
    WellKnownRoles
} from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";
import { makeMockSessionContext } from "../testHelpers.js";

/**
 * OPC 10000-3 5.2.9 / 5.2.10: DefaultRolePermissions is the policy of a namespace, and
 * DefaultUserRolePermissions is its view for the current Session. When a namespace has a role
 * default, that default decides; a stored DefaultUserRolePermissions value applies only to a
 * namespace with no role default.
 */
describe("namespace metadata: DefaultRolePermissions decides before DefaultUserRolePermissions", () => {
    let addressSpace: AddressSpace;
    let namespace: INamespace;
    let variable: UAVariable;
    let userDefaults: UAVariable;

    const anonymous = () => makeMockSessionContext({ userName: "anonymous" });
    const operator = () =>
        makeMockSessionContext({
            userName: "op",
            server: { userManager: { getUserRoles: () => makeRoles([WellKnownRoles.Operator]) } }
        });

    const entries = (role: WellKnownRoles) =>
        new Variant({
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: [
                new RolePermissionType({ roleId: resolveNodeId(role), permissions: makePermissionFlag("Browse | Read | Write") })
            ]
        });

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("urn:test:metadata-order");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        namespace = addressSpace.getNamespace("urn:test:metadata-order");
        setNamespaceMetaData(namespace);
        const metadata = addressSpace.rootFolder.objects.server
            .getChildByName("Namespaces")
            ?.getChildByName(namespace.namespaceUri);
        userDefaults = metadata?.getChildByName("DefaultUserRolePermissions") as UAVariable;
        should(userDefaults).not.eql(null);
        // a Variable with no RolePermissions of its own: the namespace defaults decide
        variable = namespace.addVariable({
            browseName: "UsesNamespaceDefaults",
            dataType: DataType.Double,
            organizedBy: addressSpace.rootFolder.objects,
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });
    });
    afterEach(() => addressSpace.dispose());

    it("NMO-1 the role default decides when the user default grants more", () => {
        namespace.setDefaultRolePermissions([
            { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse | Read | Write") }
        ]);
        userDefaults.setValueFromSource(entries(WellKnownRoles.Anonymous));
        should(anonymous().checkPermission(variable, PermissionType.Write)).eql(false);
        should(operator().checkPermission(variable, PermissionType.Write)).eql(true);
    });

    it("NMO-2 the user default applies to a namespace with no role default", () => {
        userDefaults.setValueFromSource(entries(WellKnownRoles.Operator));
        should(operator().checkPermission(variable, PermissionType.Write)).eql(true);
        should(anonymous().checkPermission(variable, PermissionType.Write)).eql(false);
    });
});
