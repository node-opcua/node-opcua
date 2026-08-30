import "mocha";
import { AddressSpace, PseudoSession, type UAVariable } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { addAlias, addAliasCategory, installAliasNamesOnAddressSpace, WellKnownCategories } from "node-opcua-alias-name-server";
import { VariableIds } from "node-opcua-constants";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { ExpandedNodeId, NodeIdType, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import { DataType, VariantArrayType } from "node-opcua-variant";
import should from "should";
import {
    ALIASES_ROOT,
    AliasNameCallError,
    AliasNameMethodNotSupportedError,
    ClientAliasSet,
    TAG_VARIABLES
} from "../source/index.js";

/**
 * The Client is driven by a `PseudoSession` over an in-process address space, so
 * these need no transport. That is the point of taking an
 * `IBasicSessionAsync2`: the same code drives a remote `ClientSession`.
 *
 * What a PseudoSession cannot prove — encoding, chunking on a large result,
 * permissions under a real session, session lifetime — is the residual risk
 * named in the server package's README, and belongs to the integration suite.
 */
describe("OPC 10000-17: ClientAliasSet", () => {
    let addressSpace: AddressSpace;
    let session: PseudoSession;
    let aliases: ClientAliasSet;
    let ti101: UAVariable;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, nodesets.standard);
        const ns = addressSpace.registerNamespace("urn:test:alias-name-client");

        ti101 = ns.addVariable({ browseName: "TemperatureIndicator101", dataType: "Double" }) as UAVariable;
        const fit101 = ns.addVariable({ browseName: "FlowIndicatorTransmitter101", dataType: "Double" }) as UAVariable;
        addAlias(addressSpace, WellKnownCategories.TagVariables, "TI101", ti101);
        addAlias(addressSpace, WellKnownCategories.TagVariables, "FIT-101", fit101);

        // A real Server engine fills this in at startup; a bare address space
        // leaves it empty, and the Annex A resolution step is meaningless
        // without it. Index 0 is always the Server's own URI (OPC 10000-5).
        const serverArray = addressSpace.findNode(resolveNodeId(VariableIds.Server_ServerArray)) as UAVariable;
        serverArray.setValueFromSource({
            dataType: DataType.String,
            arrayType: VariantArrayType.Array,
            value: ["urn:test:local-server", "urn:test:remote-server"]
        });

        await installAliasNamesOnAddressSpace(addressSpace);

        session = new PseudoSession(addressSpace);
        aliases = new ClientAliasSet(session);
    });

    after(() => addressSpace.dispose());

    describe("findAlias", () => {
        it("should resolve an exact alias name to its Node", async () => {
            const entries = await aliases.findAlias("TI101");
            entries.should.have.length(1);
            entries[0].aliasName.should.eql("TI101");
            entries[0].referencedNodes.should.have.length(1);
            entries[0].referencedNodes[0].value.should.eql(ti101.nodeId.value);
        });

        it("should return typed values, never raw Variants", async () => {
            const [entry] = await aliases.findAlias("TI101");
            entry.aliasName.should.be.a.String();
            entry.namespaceIndex.should.be.a.Number();
            // an ExpandedNodeId, not a Variant wrapping one
            should.exist(entry.referencedNodes[0].identifierType);
            should.not.exist((entry.referencedNodes[0] as unknown as { dataType?: unknown }).dataType);
        });

        it("should accept a Like pattern", async () => {
            const entries = await aliases.findAlias("%101");
            entries
                .map((e) => e.aliasName)
                .sort()
                .should.eql(["FIT-101", "TI101"]);
        });

        it("should search from the Aliases root by default", async () => {
            // the alias lives under TagVariables; the default search is recursive
            const entries = await aliases.findAlias("TI101");
            entries.should.have.length(1);
        });

        it("should search a named category when asked", async () => {
            const entries = await aliases.findAlias("TI101", { categoryNodeId: TAG_VARIABLES });
            entries.should.have.length(1);
        });

        it("should return an empty array when nothing matches", async () => {
            // clause 6.3.2 Table 3: no match is Good with an empty list
            const entries = await aliases.findAlias("NOPE-999");
            entries.should.eql([]);
        });

        it("should report the namespace the alias was published in", async () => {
            const [entry] = await aliases.findAlias("TI101");
            entry.namespaceIndex.should.not.eql(0, "namespace 0 is reserved for the OPC Foundation");
        });

        it("should raise a typed error carrying the StatusCode on a bad pattern", async () => {
            try {
                await aliases.findAlias("TI[10");
                throw new Error("should have thrown");
            } catch (err) {
                should(err).be.instanceOf(AliasNameCallError);
                (err as AliasNameCallError).statusCode.should.eql(StatusCodes.BadInvalidArgument);
            }
        });

        it("should honour a ReferenceTypeFilter", async () => {
            const organizes = addressSpace.findReferenceType("Organizes")!;
            const entries = await aliases.findAlias("%", { referenceTypeFilter: organizes.nodeId });
            entries.should.eql([], "no alias reaches its target through Organizes");
        });
    });

    describe("findAliasVerbose", () => {
        it("should report the category that held the alias", async () => {
            const [entry] = await aliases.findAliasVerbose("TI101");
            sameNodeId(entry.aliasNameCategoryId, WellKnownCategories.TagVariables).should.eql(true);
        });

        it("should report ServerUris parallel to ReferencedNodes", async () => {
            const [entry] = await aliases.findAliasVerbose("TI101");
            entry.serverUris.should.have.length(entry.referencedNodes.length);
            entry.serverUris.should.eql([null], "null means the Node is on this Server");
        });

        it("should agree with findAlias on the names it returns", async () => {
            const plain = (await aliases.findAlias("%101")).map((e) => e.aliasName).sort();
            const verbose = (await aliases.findAliasVerbose("%101")).map((e) => e.aliasName).sort();
            verbose.should.eql(plain);
        });

        it("should report that the Server supports it", async () => {
            (await aliases.supportsVerbose()).should.eql(true);
        });
    });

    describe("a Server that implements only the mandatory Method", () => {
        let bareSpace: AddressSpace;
        let bareAliases: ClientAliasSet;

        before(async () => {
            bareSpace = AddressSpace.create();
            await generateAddressSpace(bareSpace, nodesets.standard);
            bareSpace.registerNamespace("urn:test:bare");
            // verbose: false leaves the address space exactly as the standard
            // nodeset ships it - FindAlias only, which is conformant
            await installAliasNamesOnAddressSpace(bareSpace, { verbose: false });
            bareAliases = new ClientAliasSet(new PseudoSession(bareSpace));
        });

        after(() => bareSpace.dispose());

        it("should still answer findAlias", async () => {
            (await bareAliases.findAlias("%")).should.eql([]);
        });

        it("should report that verbose is unsupported rather than failing at call time", async () => {
            (await bareAliases.supportsVerbose()).should.eql(false);
        });

        it("should raise a typed error naming the Method, not an unhandled Bad_NotImplemented", async () => {
            try {
                await bareAliases.findAliasVerbose("%");
                throw new Error("should have thrown");
            } catch (err) {
                should(err).be.instanceOf(AliasNameMethodNotSupportedError);
                const typed = err as AliasNameMethodNotSupportedError;
                typed.methodName.should.eql("FindAliasVerbose");
                sameNodeId(typed.categoryNodeId, ALIASES_ROOT).should.eql(true);
                typed.message.should.match(/Only FindAlias is mandatory/);
            }
        });

        it("should report that the configuration Methods are unsupported", async () => {
            (await bareAliases.supportsConfiguration()).should.eql(false);
        });
    });

    describe("Method NodeId resolution", () => {
        it("should resolve every Method of a category in one translateBrowsePath", async () => {
            const counting = new PseudoSession(addressSpace);
            let calls = 0;
            const original = counting.translateBrowsePath.bind(counting);
            (counting as unknown as { translateBrowsePath: unknown }).translateBrowsePath = (...args: unknown[]) => {
                calls += 1;
                return (original as (...a: unknown[]) => unknown)(...args);
            };

            const client = new ClientAliasSet(counting);
            await client.findAlias("TI101");
            calls.should.eql(1, "all four Methods resolved together");
        });

        it("should cache, so a second call makes no further resolution", async () => {
            const counting = new PseudoSession(addressSpace);
            let calls = 0;
            const original = counting.translateBrowsePath.bind(counting);
            (counting as unknown as { translateBrowsePath: unknown }).translateBrowsePath = (...args: unknown[]) => {
                calls += 1;
                return (original as (...a: unknown[]) => unknown)(...args);
            };

            const client = new ClientAliasSet(counting);
            await client.findAlias("TI101");
            await client.findAlias("FIT-101");
            await client.findAliasVerbose("TI101");
            calls.should.eql(1, "findAliasVerbose reuses what findAlias already resolved");
        });

        it("should resolve again after invalidate", async () => {
            const counting = new PseudoSession(addressSpace);
            let calls = 0;
            const original = counting.translateBrowsePath.bind(counting);
            (counting as unknown as { translateBrowsePath: unknown }).translateBrowsePath = (...args: unknown[]) => {
                calls += 1;
                return (original as (...a: unknown[]) => unknown)(...args);
            };

            const client = new ClientAliasSet(counting);
            await client.findAlias("TI101");
            client.invalidate();
            await client.findAlias("TI101");
            calls.should.eql(2);
        });
    });

    describe("browsing the hierarchy", () => {
        it("should list the well-known subcategories of Aliases", async () => {
            const children = await aliases.browseSubCategories();
            const names = children.map((c) => c.browseName).sort();
            names.should.containEql("TagVariables");
            names.should.containEql("Topics");
        });

        it("should list a vendor subcategory", async () => {
            const wells = addAliasCategory(addressSpace, WellKnownCategories.TagVariables, "Wells");
            const children = await aliases.browseSubCategories(TAG_VARIABLES);
            children.some((c) => sameNodeId(c.nodeId, wells.nodeId)).should.eql(true);
        });

        it("should not list AliasName instances as categories", async () => {
            // TagVariables Organizes both its aliases and its subcategories;
            // only the latter carry FindAlias
            const children = await aliases.browseSubCategories(TAG_VARIABLES);
            children.map((c) => c.browseName).should.not.containEql("TI101");
        });
    });

    describe("resolving a returned Node's Server (Annex A)", () => {
        it("should treat serverIndex 0 as the local Server", async () => {
            const [entry] = await aliases.findAlias("TI101");
            const located = await aliases.serverIndexResolver.locate(entry.referencedNodes[0]);
            located.local.should.eql(true);
            should(located.serverUri).be.null();
        });

        it("should read the ServerArray to resolve a non-zero index", async () => {
            const serverArray = await aliases.serverIndexResolver.getServerArray();
            serverArray.should.eql(["urn:test:local-server", "urn:test:remote-server"]);
        });

        it("should resolve a Node on another Server to that Server's URI", async () => {
            // the Annex A step: a returned ExpandedNodeId whose serverIndex is
            // not 0 says only "somewhere else" until the ServerArray names it
            const remote = new ExpandedNodeId(NodeIdType.NUMERIC, 42, 1, null, 1);
            const located = await aliases.serverIndexResolver.locate(remote);

            located.local.should.eql(false);
            located.serverIndex.should.eql(1);
            located.serverUri!.should.eql("urn:test:remote-server");
        });

        it("should read the ServerArray only once", async () => {
            const counting = new PseudoSession(addressSpace);
            let reads = 0;
            const original = counting.read.bind(counting);
            (counting as unknown as { read: unknown }).read = (...args: unknown[]) => {
                reads += 1;
                return (original as (...a: unknown[]) => unknown)(...args);
            };
            const resolver = new ClientAliasSet(counting).serverIndexResolver;

            await resolver.resolveServerIndex(1);
            await resolver.resolveServerIndex(1);
            await resolver.getServerArray();
            reads.should.eql(1);
        });

        it("should report null for an index the ServerArray does not cover", async () => {
            // a Server defect, but a Client has to survive it
            should(await aliases.serverIndexResolver.resolveServerIndex(999)).be.null();
        });

        it("should recognise the local Server's own URI at index 0", async () => {
            const serverArray = await aliases.serverIndexResolver.getServerArray();
            const resolved = await aliases.serverIndexResolver.resolveServerIndex(0);
            should.exist(resolved);
            resolved!.should.eql(serverArray[0]);
        });
    });
});
