import "mocha";
import type { AddressSpace, UAMethod, UAObject, UAVariable } from "node-opcua-address-space";
import { SessionContext } from "node-opcua-address-space";
import type { ISessionContext } from "node-opcua-address-space-base";
import { BrowseDirection } from "node-opcua-data-model";
import { coerceExpandedNodeId, ExpandedNodeId, NodeId, NodeIdType, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import type { CallMethodResultOptions } from "node-opcua-service-call";
import { type StatusCode, StatusCodes } from "node-opcua-status-code";
import { DataType, type VariantLike, VariantArrayType } from "node-opcua-variant";
import should from "should";
import { addAlias, findAlias } from "../source/add_alias.js";
import { AddressSpaceAliasStore } from "../source/address_space_alias_store.js";
import { addAliasCategory } from "../source/bind_alias_category.js";
import { installAliasNamesOnAddressSpace } from "../source/install_alias_names.js";
import { ALIAS_FOR, WellKnownCategories } from "../source/well_known.js";
import { getMethod, getObject, makeAddressSpace } from "./helpers.js";

/**
 * OPC 10000-17 clauses 6.3.4 and 6.3.5 — the *AliasName Configuration Support*
 * facet (CU 5874).
 *
 * Both Methods report **per item**: the call succeeds and an `ErrorCodes` array
 * parallel to `AliasNames` says what happened to each. Only the errors in
 * Tables 11 and 15 fail the call itself.
 */
describe("OPC 10000-17: the configuration Methods", () => {
    const spaces: AddressSpace[] = [];

    afterEach(() => {
        while (spaces.length) {
            spaces.pop()!.dispose();
        }
    });

    /** A Server with the configuration facet on and writes allowed. */
    async function writableServer(options?: { allowWrite?: boolean; allowRemoteTargets?: boolean }) {
        const space = await makeAddressSpace();
        spaces.push(space);
        await installAliasNamesOnAddressSpace(space, {
            configurationMethods: true,
            store: new AddressSpaceAliasStore(space, { allowRemoteTargets: options?.allowRemoteTargets }),
            isWriteAllowed: options?.allowWrite === false ? () => false : () => true
        });
        return space;
    }

    /** Call AddAliasesToCategory and return the raw result. */
    async function callAdd(
        category: UAObject,
        aliasNames: string[] | null,
        targetNodes: (ExpandedNodeId | NodeId)[] | null,
        targetServers: (string | null)[] | null = [],
        targetReferenceType: NodeId | null = null
    ): Promise<CallMethodResultOptions> {
        const method = getMethod(category, "AddAliasesToCategory") as UAMethod;
        should.exist(method, "AddAliasesToCategory should be bound");
        const inputArguments: VariantLike[] = [
            { dataType: DataType.String, arrayType: VariantArrayType.Array, value: aliasNames },
            { dataType: DataType.ExpandedNodeId, arrayType: VariantArrayType.Array, value: targetNodes },
            { dataType: DataType.String, arrayType: VariantArrayType.Array, value: targetServers },
            { dataType: DataType.NodeId, value: targetReferenceType ?? NodeId.nullNodeId }
        ];
        return method.execute(category, inputArguments, SessionContext.defaultContext);
    }

    /** Call DeleteAliasesFromCategory and return the raw result. */
    async function callDelete(
        category: UAObject,
        aliasNames: string[] | null,
        targetNodes: (ExpandedNodeId | NodeId)[] | null = []
    ): Promise<CallMethodResultOptions> {
        const method = getMethod(category, "DeleteAliasesFromCategory") as UAMethod;
        should.exist(method, "DeleteAliasesFromCategory should be bound");
        const inputArguments: VariantLike[] = [
            { dataType: DataType.String, arrayType: VariantArrayType.Array, value: aliasNames },
            { dataType: DataType.ExpandedNodeId, arrayType: VariantArrayType.Array, value: targetNodes }
        ];
        return method.execute(category, inputArguments, SessionContext.defaultContext);
    }

    /** The ErrorCodes array a call produced. */
    function errorCodes(result: CallMethodResultOptions): StatusCode[] {
        const output = result.outputArguments?.[0];
        return ((output as { value?: unknown } | undefined)?.value ?? []) as StatusCode[];
    }

    describe("the Methods appear only when asked for", () => {
        it("should not be present by default", async () => {
            const space = await makeAddressSpace();
            spaces.push(space);
            await installAliasNamesOnAddressSpace(space);
            const aliases = getObject(space, WellKnownCategories.Aliases);
            should.not.exist(getMethod(aliases, "AddAliasesToCategory"));
            should.not.exist(getMethod(aliases, "DeleteAliasesFromCategory"));
        });

        it("should be present and bound when configurationMethods is on", async () => {
            const space = await writableServer();
            const aliases = getObject(space, WellKnownCategories.Aliases);
            getMethod(aliases, "AddAliasesToCategory")!.isBound().should.eql(true);
            getMethod(aliases, "DeleteAliasesFromCategory")!.isBound().should.eql(true);
        });

        it("should use the NodeIds the specification reserves", async () => {
            // upstream assigns these even though the nodeset does not
            // instantiate them: Aliases_AddAliasesToCategory = 24057
            const space = await writableServer();
            const aliases = getObject(space, WellKnownCategories.Aliases);
            getMethod(aliases, "AddAliasesToCategory")!.nodeId.value.should.eql(24057);
            getMethod(aliases, "DeleteAliasesFromCategory")!.nodeId.value.should.eql(24060);
        });

        it("should appear on every category, not only the well-known ones", async () => {
            const space = await writableServer();
            const wells = addAliasCategory(space, WellKnownCategories.TagVariables, "Wells");
            getMethod(wells, "AddAliasesToCategory")!.isBound().should.eql(true);
        });
    });

    describe("AddAliasesToCategory: call-level errors (clause 6.3.4 Table 11)", () => {
        it("should reject arrays of differing size", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;

            const result = await callAdd(tags, ["A", "B"], [coerceExpandedNodeId(v.nodeId.toString())]);
            result.statusCode!.should.eql(StatusCodes.BadInvalidArgument);
        });

        it("should reject a TargetServers array of the wrong size", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;

            const result = await callAdd(tags, ["A"], [coerceExpandedNodeId(v.nodeId.toString())], ["x", "y"]);
            result.statusCode!.should.eql(StatusCodes.BadInvalidArgument);
        });

        it("should accept an empty TargetServers, meaning all targets are local", async () => {
            // Table 9: "If the parameter is null or empty then the target Server
            // for all of the AliasNames is the Server hosting the AliasName Node"
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;

            const result = await callAdd(tags, ["TI101"], [coerceExpandedNodeId(v.nodeId.toString())], []);
            result.statusCode!.should.eql(StatusCodes.Good);
            errorCodes(result)[0].should.eql(StatusCodes.Good);
        });

        it("should reject a call where all arrays are empty", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const result = await callAdd(tags, [], []);
            result.statusCode!.should.eql(StatusCodes.BadInvalidArgument);
        });
    });

    describe("AddAliasesToCategory: per-item codes (clause 6.3.4 Table 10)", () => {
        it("should add a local target and report Good", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;

            const result = await callAdd(tags, ["TI101"], [coerceExpandedNodeId(v.nodeId.toString())]);

            errorCodes(result).should.have.length(1);
            errorCodes(result)[0].should.eql(StatusCodes.Good);
            const alias = findAlias(space, tags, "TI101");
            should.exist(alias, "the alias should now exist");
        });

        it("should report Bad_NodeIdUnknown for a missing local target", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const missing = new ExpandedNodeId(NodeIdType.NUMERIC, 999999, space.getOwnNamespace().index);

            const result = await callAdd(tags, ["GHOST"], [missing]);
            errorCodes(result)[0].should.eql(StatusCodes.BadNodeIdUnknown);
        });

        it("should report Bad_NotSupported for a remote target when remote targets are off", async () => {
            // Table 10 explicitly allows this: "Support for remote Server
            // TargetNodes is optional"
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const remote = new ExpandedNodeId(NodeIdType.NUMERIC, 42, 1);

            const result = await callAdd(tags, ["REMOTE"], [remote], ["urn:other:server"]);
            errorCodes(result)[0].should.eql(StatusCodes.BadNotSupported);
        });

        it("should report Uncertain_ReferenceOutOfServer for a remote target when they are on", async () => {
            // "If the Server does not check for the external Node's existence,
            // it shall return Uncertain_ReferenceOutOfServer" - this Server does
            // not check, because that would mean being a Client of the other one
            const space = await writableServer({ allowRemoteTargets: true });
            const aliases = getObject(space, WellKnownCategories.Aliases);
            const remote = new ExpandedNodeId(NodeIdType.NUMERIC, 42, 1);

            const result = await callAdd(aliases, ["REMOTE"], [remote], ["urn:other:server"]);
            errorCodes(result)[0].should.eql(StatusCodes.UncertainReferenceOutOfServer);
        });

        it("should report each item independently", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;
            const missing = new ExpandedNodeId(NodeIdType.NUMERIC, 999999, space.getOwnNamespace().index);

            const result = await callAdd(tags, ["GOOD", "BAD"], [coerceExpandedNodeId(v.nodeId.toString()), missing]);

            result.statusCode!.should.eql(StatusCodes.Good, "one bad item does not fail the call");
            errorCodes(result)[0].should.eql(StatusCodes.Good);
            errorCodes(result)[1].should.eql(StatusCodes.BadNodeIdUnknown);
        });

        it("should ignore an exact duplicate that is already stored", async () => {
            // "it shall be ignored and no error shall be generated"
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;
            const target = coerceExpandedNodeId(v.nodeId.toString());

            await callAdd(tags, ["TI101"], [target]);
            const second = await callAdd(tags, ["TI101"], [target]);

            errorCodes(second)[0].should.eql(StatusCodes.Good, "ignored, not an error");
            findAlias(space, tags, "TI101")!
                .findReferencesEx(ALIAS_FOR, BrowseDirection.Forward)
                .should.have.length(1, "still one target");
        });

        it("should ignore a duplicate repeated within the same call", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;
            const target = coerceExpandedNodeId(v.nodeId.toString());

            const result = await callAdd(tags, ["TI101", "TI101"], [target, target]);

            errorCodes(result)[0].should.eql(StatusCodes.Good);
            errorCodes(result)[1].should.eql(StatusCodes.Good);
        });

        it("should let one name reach several targets, listed once per target", async () => {
            // "If the same AliasName is to reference multiple TargetNodes then
            // the AliasName shall be listed in the AliasNames array multiple
            // times, one for each TargetNode."
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const ns = space.getOwnNamespace();
            const a = ns.addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;
            const b = ns.addVariable({ browseName: "V2", dataType: "Double" }) as UAVariable;

            const result = await callAdd(
                tags,
                ["TI101", "TI101"],
                [coerceExpandedNodeId(a.nodeId.toString()), coerceExpandedNodeId(b.nodeId.toString())]
            );

            errorCodes(result).every((c) => c.isGood()).should.eql(true);
            findAlias(space, tags, "TI101")!.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward).should.have.length(2);
        });

        it("should default a null TargetReferenceType to AliasFor", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;

            await callAdd(tags, ["TI101"], [coerceExpandedNodeId(v.nodeId.toString())], [], null);

            const reference = findAlias(space, tags, "TI101")!.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward)[0];
            sameNodeId(reference.referenceType, ALIAS_FOR).should.eql(true);
        });

        it("should ignore the ServerIndex inside the ExpandedNodeId", async () => {
            // Table 9: "The ServerIndex in the ExpandedNodeId shall be ignored
            // and the TargetServers Uri shall be used."
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;
            // a misleading ServerIndex on an otherwise local target
            const misleading = new ExpandedNodeId(v.nodeId.identifierType, v.nodeId.value, v.nodeId.namespace, null, 7);

            const result = await callAdd(tags, ["TI101"], [misleading], []);

            errorCodes(result)[0].should.eql(StatusCodes.Good, "TargetServers said local, so it is local");
        });

        it("should enforce the clause 9.3 category restriction", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const object = space.getOwnNamespace().addObject({ browseName: "NotAVariable" });

            const result = await callAdd(tags, ["BAD"], [coerceExpandedNodeId(object.nodeId.toString())]);
            errorCodes(result)[0].should.eql(StatusCodes.BadNodeIdInvalid);
        });

        it("should move LastChange", async () => {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;
            const property = tags.getPropertyByName("LastChange") as UAVariable;
            property.readValue().value.value.should.eql(0);

            await callAdd(tags, ["TI101"], [coerceExpandedNodeId(v.nodeId.toString())]);

            (property.readValue().value.value as number).should.be.above(0);
        });
    });

    describe("DeleteAliasesFromCategory (clause 6.3.5)", () => {
        /** A Server with TI101 -> V1 already present. */
        async function serverWithAlias() {
            const space = await writableServer();
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;
            addAlias(space, tags, "TI101", v);
            return { space, tags, v };
        }

        it("should delete a named alias and report Good", async () => {
            const { space, tags } = await serverWithAlias();
            const result = await callDelete(tags, ["TI101"], []);

            result.statusCode!.should.eql(StatusCodes.Good);
            errorCodes(result)[0].should.eql(StatusCodes.Good);
            should.not.exist(findAlias(space, tags, "TI101"));
        });

        it("should report Bad_NotFound for a name that is not there", async () => {
            const { tags } = await serverWithAlias();
            const result = await callDelete(tags, ["NOPE"], []);
            errorCodes(result)[0].should.eql(StatusCodes.BadNotFound);
        });

        it("should delete every target when the TargetNodes entry is empty", async () => {
            // "If the TargetNodes array entry is null or empty, all AliasNames
            // with the provided name are deleted from the AliasNameCategory."
            const { space, tags } = await serverWithAlias();
            const b = space.getOwnNamespace().addVariable({ browseName: "V2", dataType: "Double" }) as UAVariable;
            addAlias(space, tags, "TI101", b);
            findAlias(space, tags, "TI101")!.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward).should.have.length(2);

            const result = await callDelete(tags, ["TI101"], []);

            errorCodes(result)[0].should.eql(StatusCodes.Good);
            should.not.exist(findAlias(space, tags, "TI101"), "both targets went");
        });

        it("should delete only the named target when one is given", async () => {
            const { space, tags, v } = await serverWithAlias();
            const b = space.getOwnNamespace().addVariable({ browseName: "V2", dataType: "Double" }) as UAVariable;
            addAlias(space, tags, "TI101", b);

            const result = await callDelete(tags, ["TI101"], [coerceExpandedNodeId(v.nodeId.toString())]);

            errorCodes(result)[0].should.eql(StatusCodes.Good);
            const alias = findAlias(space, tags, "TI101");
            should.exist(alias, "the other target keeps the alias alive");
            alias!.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward).should.have.length(1);
        });

        it("should be all-or-nothing per name", async () => {
            // "If all targets for an AliasNames array entry cannot be deleted,
            // then none of the targets are deleted."
            const { space, tags, v } = await serverWithAlias();
            const absent = new ExpandedNodeId(NodeIdType.NUMERIC, 999999, space.getOwnNamespace().index);

            // one requested target is present, the other is not
            const result = await callDelete(tags, ["TI101"], [absent]);

            errorCodes(result)[0].should.eql(StatusCodes.BadNotFound);
            should.exist(findAlias(space, tags, "TI101"), "nothing was deleted");
            findAlias(space, tags, "TI101")!.findReferencesEx(ALIAS_FOR, BrowseDirection.Forward).should.have.length(1);
            should.exist(space.findNode(v.nodeId), "the target Variable itself is untouched");
        });

        it("should remove the AliasNameType node when its last target goes", async () => {
            // clause 7.2: ReferencedNodes always has at least one entry, so an
            // alias naming nothing cannot be represented
            const { space, tags, v } = await serverWithAlias();
            const aliasNodeId = findAlias(space, tags, "TI101")!.nodeId;

            await callDelete(tags, ["TI101"], [coerceExpandedNodeId(v.nodeId.toString())]);

            should.not.exist(space.findNode(aliasNodeId));
        });

        it("should reject arrays of differing size (Table 15)", async () => {
            const { space, tags, v } = await serverWithAlias();
            void space;
            const result = await callDelete(tags, ["A", "B"], [coerceExpandedNodeId(v.nodeId.toString())]);
            result.statusCode!.should.eql(StatusCodes.BadInvalidArgument);
        });

        it("should reject an empty call", async () => {
            const { tags } = await serverWithAlias();
            const result = await callDelete(tags, [], []);
            result.statusCode!.should.eql(StatusCodes.BadInvalidArgument);
        });

        it("should move LastChange", async () => {
            const { space, tags } = await serverWithAlias();
            const property = tags.getPropertyByName("LastChange") as UAVariable;
            const before = property.readValue().value.value as number;

            await callDelete(tags, ["TI101"], []);

            (property.readValue().value.value as number).should.be.aboveOrEqual(before);
        });
    });

    describe("access control (item 10; Tables 11 and 15)", () => {
        it("should deny writes by default, even with the Methods exposed", async () => {
            // the read gate defaults to allow, the write gate to deny - they are
            // independent, and only one of them is safe to open by default
            const space = await makeAddressSpace();
            spaces.push(space);
            await installAliasNamesOnAddressSpace(space, { configurationMethods: true });
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;

            const result = await callAdd(tags, ["TI101"], [coerceExpandedNodeId(v.nodeId.toString())]);
            result.statusCode!.should.eql(StatusCodes.BadUserAccessDenied);
        });

        it("should deny deletes by default too", async () => {
            const space = await makeAddressSpace();
            spaces.push(space);
            await installAliasNamesOnAddressSpace(space, { configurationMethods: true });
            const tags = getObject(space, WellKnownCategories.TagVariables);

            const result = await callDelete(tags, ["TI101"], []);
            result.statusCode!.should.eql(StatusCodes.BadUserAccessDenied);
        });

        it("should gate reads and writes independently", async () => {
            // a Server may publish its aliases openly and still let nobody
            // change them, which is the common case
            const space = await makeAddressSpace();
            spaces.push(space);
            await installAliasNamesOnAddressSpace(space, {
                configurationMethods: true,
                isReadAllowed: () => true,
                isWriteAllowed: () => false
            });
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const v = space.getOwnNamespace().addVariable({ browseName: "V1", dataType: "Double" }) as UAVariable;
            addAlias(space, tags, "TI101", v);

            const findAliasMethod = getMethod(tags, "FindAlias") as UAMethod;
            const read = await findAliasMethod.execute(
                tags,
                [
                    { dataType: DataType.String, value: "%" },
                    { dataType: DataType.NodeId, value: NodeId.nullNodeId }
                ],
                SessionContext.defaultContext
            );
            read.statusCode!.should.eql(StatusCodes.Good, "reads are open");

            const write = await callAdd(tags, ["X"], [coerceExpandedNodeId(v.nodeId.toString())]);
            write.statusCode!.should.eql(StatusCodes.BadUserAccessDenied, "writes are not");
        });

        it("should receive the category, so writes can be gated per tenant", async () => {
            const space = await makeAddressSpace();
            spaces.push(space);
            const seen: NodeId[] = [];
            await installAliasNamesOnAddressSpace(space, {
                configurationMethods: true,
                isWriteAllowed: (_c: ISessionContext, categoryNodeId: NodeId) => {
                    seen.push(categoryNodeId);
                    return false;
                }
            });
            const topics = getObject(space, WellKnownCategories.Topics);
            await callAdd(topics, ["X"], [coerceExpandedNodeId(resolveNodeId("i=85").toString())]);

            seen.should.have.length(1);
            sameNodeId(seen[0], WellKnownCategories.Topics).should.eql(true);
        });

        it("should await an asynchronous write gate", async () => {
            const space = await makeAddressSpace();
            spaces.push(space);
            await installAliasNamesOnAddressSpace(space, {
                configurationMethods: true,
                isWriteAllowed: async () => {
                    await new Promise((resolve) => setTimeout(resolve, 1));
                    return false;
                }
            });
            const tags = getObject(space, WellKnownCategories.TagVariables);
            const result = await callDelete(tags, ["TI101"], []);
            result.statusCode!.should.eql(StatusCodes.BadUserAccessDenied);
        });
    });
});
