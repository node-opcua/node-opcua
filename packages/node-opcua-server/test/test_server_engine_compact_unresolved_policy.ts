import type { CompactAddressSpace } from "node-opcua-address-space";
import type { ISessionContext } from "node-opcua-address-space-base";
import { SharedStoreReader, type StoreVariableView } from "node-opcua-address-space-store";
import { WellKnownRoles } from "node-opcua-constants";
import { type NodeId, resolveNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { MessageSecurityMode } from "node-opcua-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { ServerEngine } from "../dist/server_engine.js";

const operator = resolveNodeId(WellKnownRoles.Operator);

/** a remote session context reduced to what the compact store checks: the channel's mode and the roles */
function session(roles: NodeId[]): ISessionContext {
    return {
        session: { channel: { securityMode: MessageSecurityMode.SignAndEncrypt } },
        getCurrentUserRoles: () => roles
    } as unknown as ISessionContext;
}

/**
 * The server's unresolvedPermissionPolicy decides what a remote session may do on a node that no
 * RolePermissions cover, of its own or of its namespace. The compact address space applies the
 * same policy as the classic one: the engine hands it over, a later change reaches it, and the
 * readers in other threads (the fronts) do not serve such a node in place when the policy denies.
 */
describe("ServerEngine with a compact address space: unresolvedPermissionPolicy", function () {
    this.timeout(60000);
    let engine: ServerEngine;
    let compact: CompactAddressSpace;
    let speed: StoreVariableView;

    before((done) => {
        engine = new ServerEngine({ applicationUri: "urn:test:compact:policy", unresolvedPermissionPolicy: "deny" });
        engine.initialize(
            { nodeset_filename: nodesets.standard, compactAddressSpace: { expectedNodes: 8192, shared: true } },
            () => {
                compact = engine.compactAddressSpace as CompactAddressSpace;
                const ns = engine.registerCompactNamespace("urn:test:compact:policy:plant");
                const objects = compact.findNode("ns=0;i=85") as never;
                speed = compact.addVariable({
                    nodeId: `ns=${ns};s=Speed`,
                    browseName: "Speed",
                    organizedBy: objects,
                    dataType: "Double",
                    value: { dataType: DataType.Double, value: 12.5 }
                }) as unknown as StoreVariableView;
                done();
            }
        );
    });
    after(async () => {
        await engine.shutdown();
    });

    it("CUP-1 hands the engine's policy to the compact address space", () => {
        should(engine.unresolvedPermissionPolicy).eql("deny");
        should(compact.permissions.unresolvedPermissionPolicy).eql("deny");
    });

    it("CUP-2 denies a remote session a node that no RolePermissions cover", () => {
        should(speed.readValue(session([operator])).statusCode).eql(StatusCodes.BadUserAccessDenied);
    });

    it("CUP-3 does not let a reader in another thread serve that node in place", () => {
        const reader = new SharedStoreReader(compact.store.shareForReaders());
        const index = reader.find(speed.nodeId);
        should(index).be.aboveOrEqual(0);
        should(reader.isOpen(index)).eql(false);
    });

    it("CUP-4 carries a later change of the engine's policy to the store and to the readers", () => {
        const reader = new SharedStoreReader(compact.store.shareForReaders());
        const index = reader.find(speed.nodeId);

        engine.unresolvedPermissionPolicy = "allow";
        should(compact.permissions.unresolvedPermissionPolicy).eql("allow");
        should(speed.readValue(session([operator])).statusCode).eql(StatusCodes.Good);
        should(reader.isOpen(index)).eql(true);

        engine.unresolvedPermissionPolicy = "deny";
        should(speed.readValue(session([operator])).statusCode).eql(StatusCodes.BadUserAccessDenied);
        should(reader.isOpen(index)).eql(false);
    });
});
