import {
    type AddressSpace,
    makeRoles,
    type Namespace,
    SessionContext,
    type UAObject,
    type UAVariable,
    WellKnownRoles
} from "node-opcua-address-space";
import { makePermissionFlag } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import { PermissionType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../source/index.js";

/**
 * A namespace default configured with Namespace.setDefaultRolePermissions() must reach the
 * permission-enforcement path through a fully initialized ServerEngine, i.e. across the real
 * Server/Namespaces structure — not only the mini address space used by the unit tests.
 *
 * ServerEngine.initialize() normalizes the DefaultRolePermissions / DefaultUserRolePermissions
 * Property of each namespace so it is readable; that normalization must leave an already
 * declared value in place and must not sever the configured default from enforcement.
 */
describe("ServerEngine - namespace DefaultRolePermissions on the enforcement path", function (this: Mocha.Suite) {
    let engine: ServerEngine;

    before((done) => {
        engine = new ServerEngine({ applicationUri: "application:uri" });
        engine.initialize({ nodeset_filename: nodesets.standard }, () => done());
    });

    after(async () => {
        await engine.shutdown();
    });

    const addressSpace = () => engine.addressSpace as AddressSpace;

    const contextForRole = (role: WellKnownRoles): SessionContext => {
        const ctx = new SessionContext();
        ctx.getCurrentUserRoles = () => makeRoles([role]);
        return ctx;
    };

    it("SNDP-1 leaves each namespace's DefaultRolePermissions Property readable after initialize()", () => {
        const server = addressSpace().rootFolder.objects.server;
        const namespacesNode = server.getComponentByName("Namespaces") as UAObject;
        should.exist(namespacesNode, "Server/Namespaces should exist");
        const ns0 = namespacesNode.getChildByName("http://opcfoundation.org/UA/") as UAObject;
        should.exist(ns0, "the namespace-0 metadata node should exist");
        const defaultRolePermissions = ns0.getChildByName("DefaultRolePermissions") as UAVariable;
        should.exist(defaultRolePermissions, "DefaultRolePermissions Property should exist");
        defaultRolePermissions.readValue().statusCode.isGood().should.eql(true);
    });

    it("SNDP-2 enforces a namespace default set via setDefaultRolePermissions() against an anonymous Session", () => {
        const namespace = addressSpace().getOwnNamespace() as Namespace;
        namespace.setDefaultRolePermissions([{ roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Read | Write") }]);
        const variable = namespace.addVariable({
            browseName: "SNDP_RelyingOnNamespaceDefault",
            dataType: DataType.Double,
            accessLevel: "CurrentRead | CurrentWrite",
            userAccessLevel: "CurrentRead | CurrentWrite"
        });
        contextForRole(WellKnownRoles.Anonymous).checkPermission(variable, PermissionType.Write).should.eql(false);
        contextForRole(WellKnownRoles.Operator).checkPermission(variable, PermissionType.Write).should.eql(true);
    });
});
