import {
    type AddressSpace,
    makeRoles,
    type Namespace,
    SessionContext,
    type UAVariable,
    WellKnownRoles
} from "node-opcua-address-space";
import { AttributeIds, makePermissionFlag } from "node-opcua-data-model";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { PermissionType } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../source/index.js";

/**
 * A Read resolves the user's Roles and the namespace defaults of permissions once for the whole
 * request, rather than once per node, and forgets them when the request is answered.
 */
describe("Read - permissions resolved once per request", function (this: Mocha.Suite) {
    let engine: ServerEngine;
    let namespace: Namespace;
    const variables: UAVariable[] = [];

    before((done) => {
        engine = new ServerEngine({ applicationUri: "application:uri" });
        engine.initialize({ nodeset_filename: nodesets.standard }, () => {
            namespace = (engine.addressSpace as AddressSpace).getOwnNamespace() as Namespace;
            for (let i = 0; i < 5; i++) {
                variables.push(
                    namespace.addVariable({
                        browseName: `RPC_Variable${i}`,
                        dataType: DataType.Double,
                        value: { dataType: DataType.Double, value: i },
                        accessLevel: "CurrentRead | CurrentWrite",
                        userAccessLevel: "CurrentRead | CurrentWrite"
                    })
                );
            }
            done();
        });
    });

    after(async () => {
        await engine.shutdown();
    });

    /** a context for one Role, counting how often its Roles are asked for */
    const contextForRole = (role: WellKnownRoles) => {
        const ctx = new SessionContext();
        const counter = { calls: 0 };
        ctx.getCurrentUserRoles = () => {
            counter.calls++;
            return makeRoles([role]);
        };
        return { ctx, counter };
    };

    const readAll = (ctx: SessionContext) =>
        engine.readSync(ctx, { nodesToRead: variables.map((v) => ({ nodeId: v.nodeId, attributeId: AttributeIds.Value })) });

    it("RPC-1 a Read of several nodes asks for the Roles once", () => {
        namespace.setDefaultRolePermissions([
            { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse | Read") }
        ]);
        const { ctx, counter } = contextForRole(WellKnownRoles.Operator);
        const results = readAll(ctx);
        should(results.map((r) => r.statusCode)).eql(variables.map(() => StatusCodes.Good));
        should(counter.calls).eql(1);
    });

    it("RPC-2 the namespace default denies every node of a Read for a Role it does not list", () => {
        namespace.setDefaultRolePermissions([
            { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse | Read") }
        ]);
        const { ctx } = contextForRole(WellKnownRoles.Observer);
        const results = readAll(ctx);
        should(results.map((r) => r.statusCode)).eql(variables.map(() => StatusCodes.BadUserAccessDenied));
    });

    it("RPC-3 a change of the namespace default applies from the next Read on", () => {
        const { ctx } = contextForRole(WellKnownRoles.Observer);
        namespace.setDefaultRolePermissions([
            { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse | Read") }
        ]);
        should(readAll(ctx)[0].statusCode).eql(StatusCodes.BadUserAccessDenied);

        namespace.setDefaultRolePermissions([
            { roleId: WellKnownRoles.Observer, permissions: makePermissionFlag("Browse | Read") }
        ]);
        should(readAll(ctx)[0].statusCode).eql(StatusCodes.Good);
    });

    it("RPC-4 the Roles are asked for again by each request, and outside of one", () => {
        namespace.setDefaultRolePermissions([
            { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse | Read") }
        ]);
        const { ctx, counter } = contextForRole(WellKnownRoles.Operator);
        readAll(ctx);
        readAll(ctx);
        should(counter.calls).eql(2);
        should(ctx.checkPermission(variables[0], PermissionType.Read)).eql(true);
        should(ctx.checkPermission(variables[1], PermissionType.Read)).eql(true);
        should(counter.calls).eql(4);
    });

    it("RPC-5 nested scopes share the outermost cache and drop it when it ends", () => {
        namespace.setDefaultRolePermissions([
            { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse | Read") }
        ]);
        const { ctx, counter } = contextForRole(WellKnownRoles.Operator);
        ctx.withPermissionCache(() => {
            ctx.checkPermission(variables[0], PermissionType.Read);
            ctx.withPermissionCache(() => ctx.checkPermission(variables[1], PermissionType.Read));
            ctx.checkPermission(variables[2], PermissionType.Read);
        });
        should(counter.calls).eql(1);
        ctx.checkPermission(variables[0], PermissionType.Read);
        should(counter.calls).eql(2);
    });

    it("RPC-6 the cache is dropped when the action throws", () => {
        namespace.setDefaultRolePermissions([
            { roleId: WellKnownRoles.Operator, permissions: makePermissionFlag("Browse | Read") }
        ]);
        const { ctx, counter } = contextForRole(WellKnownRoles.Operator);
        should(() =>
            ctx.withPermissionCache(() => {
                ctx.checkPermission(variables[0], PermissionType.Read);
                throw new Error("boom");
            })
        ).throw("boom");
        ctx.checkPermission(variables[0], PermissionType.Read);
        should(counter.calls).eql(2);
    });
});
