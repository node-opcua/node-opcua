import { makePermissionFlag } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { PermissionType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { type AddressSpace, makeRoles, type Namespace, type UAVariable, WellKnownRoles } from "..";
import { getMiniAddressSpace, makeMockSessionContext } from "../testHelpers";

/**
 * A namespace default set through Namespace.setDefaultRolePermissions() must be honoured by the
 * permission-enforcement path, not only by the local BaseNode.getRolePermissions(inherited=true)
 * getter.
 *
 * A programmatically created namespace has no NamespaceMetadata node under Server/Namespaces, so
 * the enforcement path used to resolve the namespace default to null and fall back to its
 * unresolved-permission default (permissive), ignoring the configured policy entirely. The two
 * resolution paths — the configuration field and the enforcement lookup — are now consistent.
 */
describe("SessionContext - namespace DefaultRolePermissions on the enforcement path", () => {
    let addressSpace: AddressSpace;
    let namespace: Namespace;
    let variable: UAVariable;

    beforeEach(async () => {
        addressSpace = await getMiniAddressSpace();
        namespace = addressSpace.getOwnNamespace();
        // a Variable that carries no per-node RolePermissions and therefore relies on the
        // namespace default for its access control
        variable = namespace.addVariable({
            browseName: "RelyingOnNamespaceDefault",
            dataType: DataType.Double,
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });
    });
    afterEach(() => addressSpace.dispose());

    const anonymous = () => makeMockSessionContext({ userName: "anonymous" });
    const operator = () =>
        makeMockSessionContext({
            userName: "op",
            server: { userManager: { getUserRoles: () => makeRoles([WellKnownRoles.Operator]) } }
        });

    it("NSDP-1 grants an anonymous Session everything when no namespace default is configured (unchanged default)", () => {
        // documents the historical permissive default: with no policy anywhere, the request is
        // resolved by the unresolved-permission default, which is permissive out of the box.
        anonymous().checkPermission(variable, PermissionType.Write).should.eql(true);
    });

    it("NSDP-2 denies an anonymous Session once the namespace default excludes it", () => {
        namespace.setDefaultRolePermissions([{ roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Read | Write") }]);
        const ctx = anonymous();
        // the configured default now reaches enforcement: Anonymous matches no entry -> no bits
        ctx.getApplicableRolePermissions(variable).should.not.eql(null);
        ctx.checkPermission(variable, PermissionType.Write).should.eql(false);
    });

    it("NSDP-3 still grants the role named in the namespace default", () => {
        namespace.setDefaultRolePermissions([{ roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Read | Write") }]);
        operator().checkPermission(variable, PermissionType.Write).should.eql(true);
    });

    it("NSDP-4 lets a per-node RolePermissions override the namespace default", () => {
        namespace.setDefaultRolePermissions([{ roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Read | Write") }]);
        // grant the Variable itself to Operator only, explicitly
        variable.setRolePermissions([{ roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Read | Write") }]);
        anonymous().checkPermission(variable, PermissionType.Write).should.eql(false);
        operator().checkPermission(variable, PermissionType.Write).should.eql(true);
    });
});
