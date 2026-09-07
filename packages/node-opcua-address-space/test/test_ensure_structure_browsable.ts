/**
 * Opc.Ua.NodeSet2.xml reserves Browse of the methods of Server/PublishSubscribe/SecurityGroups, and
 * of KeyPushTargets, to the SecurityKeyServerAdmin role. The loader is faithful to it, so a session
 * holding none of the SecurityKeyServer roles - every session of a node-opcua server - saw
 * SecurityGroups without the mandatory methods of its type (CTT Base Info Core Structure 002,
 * FEAT-30). ensureStructureIsBrowsable is what a server applies to keep the structure visible.
 */
import { ObjectIds } from "node-opcua-constants";
import { BrowseDirection } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { PermissionType } from "node-opcua-types";
import should from "should";
import {
    AddressSpace,
    type BaseNode,
    ensureStructureIsBrowsable,
    type IServerBase,
    type ISessionContext,
    makeRoles,
    WellKnownRoles
} from "../dist/api/index.js";
import { isMassivelyUsedReferenceType } from "../dist/impl/reference_impl.js";
import { generateAddressSpace } from "../nodeJS.js";
import { makeMockSessionContext } from "../testHelpers.js";

const securityGroups = "i=15443";
const addSecurityGroup = "i=15444";
const removeSecurityGroup = "i=15447";
const getSecurityKeys = "i=15215";

/** the eleven nodes the nodeset reserves to the SecurityKeyServerAdmin role, in browse order */
const reservedToSecurityKeyServerAdmin = [
    "i=15444", // SecurityGroups/AddSecurityGroup
    "i=15445", //   InputArguments
    "i=15446", //   OutputArguments
    "i=15447", // SecurityGroups/RemoveSecurityGroup
    "i=15448", //   InputArguments
    "i=25440", // KeyPushTargets
    "i=25441", //   AddPushTarget
    "i=25442", //     InputArguments
    "i=25443", //     OutputArguments
    "i=25444", //   RemovePushTarget
    "i=25445" //      InputArguments
].map((id) => resolveNodeId(id).toString());

const serverFor = (roles: ReturnType<typeof makeRoles>): IServerBase => ({ userManager: { getUserRoles: () => roles } });
const anonymousSession = () =>
    makeMockSessionContext({ userName: "anonymous", server: serverFor(makeRoles([WellKnownRoles.Anonymous])) });
/** the CTT's admin session: every administrative role a node-opcua user manager hands out */
const rootSession = () =>
    makeMockSessionContext({
        userName: "root",
        server: serverFor(
            makeRoles([
                WellKnownRoles.AuthenticatedUser,
                WellKnownRoles.Supervisor,
                WellKnownRoles.SecurityAdmin,
                WellKnownRoles.ConfigureAdmin
            ])
        )
    });
const securityKeyServerAdminSession = () =>
    makeMockSessionContext({
        userName: "sks",
        server: serverFor(makeRoles([WellKnownRoles.AuthenticatedUser, ObjectIds.WellKnownRole_SecurityKeyServerAdmin]))
    });

/** the aggregates of `node`, at any depth, that `context` may not browse */
function hiddenAggregates(context: ISessionContext, node: BaseNode): string[] {
    const hidden: string[] = [];
    for (const child of node.findReferencesExAsObject("Aggregates", BrowseDirection.Forward)) {
        if (context.isBrowseAccessRestricted(child)) {
            hidden.push(child.nodeId.toString());
        }
        hidden.push(...hiddenAggregates(context, child));
    }
    return hidden;
}

describe("the structure of Server/PublishSubscribe stays browsable", function (this: Mocha.Suite) {
    this.timeout(120000);
    let addressSpace: AddressSpace;
    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard]);
    });
    after(() => addressSpace.dispose());

    const forwardTargets = (nodeId: string, referenceType: string): string[] =>
        addressSpace
            .findNode(nodeId)!
            .findReferencesEx(referenceType, BrowseDirection.Forward)
            .map((reference) => reference.nodeId.toString());

    it("the loader holds every reference the nodeset declares on SecurityGroups and its methods", () => {
        forwardTargets(securityGroups, "HasComponent").should.containDeep([
            resolveNodeId(addSecurityGroup).toString(),
            resolveNodeId(removeSecurityGroup).toString()
        ]);
        forwardTargets(addSecurityGroup, "HasProperty").should.containDeep([
            resolveNodeId("i=15445").toString(),
            resolveNodeId("i=15446").toString()
        ]);
    });

    it("every reference of the standard nodeset is held from both ends", () => {
        // HasTypeDefinition and HasModellingRule are kept on the source only, by design
        const namespace = addressSpace.getDefaultNamespace() as unknown as { nodeIterator(): Iterable<BaseNode> };
        const missing: string[] = [];
        let checked = 0;
        for (const node of namespace.nodeIterator()) {
            for (const reference of node.allReferences()) {
                if (isMassivelyUsedReferenceType(reference.referenceType)) {
                    continue;
                }
                const target = addressSpace.findNode(reference.nodeId);
                if (!target) {
                    missing.push(`${node.nodeId} -> ${reference.nodeId}: no such node`);
                    continue;
                }
                checked++;
                const inverse = target
                    .allReferences()
                    .some(
                        (r) =>
                            r.isForward !== reference.isForward &&
                            sameNodeId(r.nodeId, node.nodeId) &&
                            sameNodeId(r.referenceType, reference.referenceType)
                    );
                if (!inverse) {
                    missing.push(
                        `${node.nodeId} ${reference.isForward ? "->" : "<-"} ${reference.nodeId} (${reference.referenceType})`
                    );
                }
            }
        }
        checked.should.be.greaterThan(10000); // 5476 nodes, 19109 references, 7000 of them HasTypeDefinition or HasModellingRule
        missing.should.eql([]);
    });

    it("the nodeset reserves Browse of eleven nodes under PublishSubscribe to the SecurityKeyServerAdmin role", () => {
        const publishSubscribe = addressSpace.findNode(ObjectIds.PublishSubscribe)!;
        // the CTT's admin session holds every role a user manager hands out, and sees none of them
        hiddenAggregates(rootSession(), publishSubscribe).should.eql(reservedToSecurityKeyServerAdmin);
        hiddenAggregates(anonymousSession(), publishSubscribe).should.containDeep(reservedToSecurityKeyServerAdmin);
        // the SecurityKeyServerAdmin sees the eleven; PubSubConfiguration keeps its own SecurityAdmin-only methods from it
        hiddenAggregates(securityKeyServerAdminSession(), publishSubscribe)
            .filter((id) => reservedToSecurityKeyServerAdmin.includes(id))
            .should.eql([]);
    });

    it("ensureStructureIsBrowsable shows them to every session and leaves Call with the SecurityKeyServerAdmin", () => {
        const publishSubscribe = addressSpace.findNode(ObjectIds.PublishSubscribe)!;
        const untouched = addressSpace.findNode(getSecurityKeys)!; // grants Browse to Anonymous already
        const before = JSON.stringify(untouched.rolePermissions);
        const noPermissions = publishSubscribe
            .findReferencesExAsObject("Aggregates", BrowseDirection.Forward)
            .find((child) => child.rolePermissions === undefined)!;
        should.exist(noPermissions);

        ensureStructureIsBrowsable(publishSubscribe);
        ensureStructureIsBrowsable(publishSubscribe); // idempotent

        hiddenAggregates(rootSession(), publishSubscribe).should.eql([]);
        hiddenAggregates(anonymousSession(), publishSubscribe).should.eql([]);

        const method = addressSpace.findNode(addSecurityGroup)!;
        rootSession().checkPermission(method, PermissionType.Call).should.eql(false);
        anonymousSession().checkPermission(method, PermissionType.Call).should.eql(false);
        securityKeyServerAdminSession().checkPermission(method, PermissionType.Call).should.eql(true);
        should(method.rolePermissions?.length).eql(3, "the nodeset's entry, plus Browse for Anonymous and AuthenticatedUser");

        JSON.stringify(untouched.rolePermissions).should.eql(before);
        should.not.exist(noPermissions.rolePermissions);
    });
});
