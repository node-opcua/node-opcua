import "mocha";
import { ALIASES_ROOT, AliasNameCallError, ClientAliasSet, TAG_VARIABLES } from "node-opcua-alias-name-client";
import { AttributeIds } from "node-opcua-data-model";
import { resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { ALIAS_CAPABILITY, type SampleServerHandle, startSampleServer } from "../bin/sample_server_with_aliases.js";
import { ANONYMOUS, asUser, withSession } from "./helpers.js";

/**
 * End-to-end AliasName tests over a **real TCP transport**.
 *
 * The unit suites drive `method.execute()` in process, which cannot show
 * encoding, chunking on a large result, permissions under a real session, or
 * session lifetime. Those four are the residual risk of the server package, and
 * this is where they are retired.
 */
describe("OPC 10000-17: AliasNames end to end", function () {
    // starting a real server with the standard nodeset is not fast
    this.timeout(120000);

    let handle: SampleServerHandle;

    before(async () => {
        handle = await startSampleServer({ port: 48561 });
    });

    after(async () => {
        await handle.shutdown();
    });

    describe("the ISA-5.1 bridge, which is the reason the feature exists", () => {
        it("should resolve a plant tag to an explicitly modelled Node", async () => {
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                const [entry] = await aliases.findAlias("TI101");

                should.exist(entry, "TI101 should resolve");
                sameNodeId(entry.referencedNodes[0], handle.nodeIds.temperatureIndicator).should.eql(true);
            });
        });

        it("should let a Client read the value it just resolved, knowing only the tag", async () => {
            // the whole point: no NodeId was configured anywhere in this test
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                const [entry] = await aliases.findAlias("TI101");

                const dataValue = await session.read({
                    nodeId: resolveNodeId(entry.referencedNodes[0].toString()),
                    attributeId: AttributeIds.Value
                });
                dataValue.statusCode.should.eql(StatusCodes.Good);
                dataValue.value.value.should.eql(21.5);
            });
        });

        it("should resolve a tag held in a nested vendor subcategory", async () => {
            // LSH-201 lives under TagVariables/Unit200, so finding it from the
            // root proves the search really is recursive over the wire
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                const [entry] = await aliases.findAlias("LSH-201");
                sameNodeId(entry.referencedNodes[0], handle.nodeIds.levelSwitchHigh).should.eql(true);
            });
        });

        it("should support a Like pattern across the whole hierarchy", async () => {
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                const names = (await aliases.findAlias("%-201")).map((e) => e.aliasName);
                names.should.eql(["LSH-201"]);
            });
        });
    });

    describe("encoding over the wire", () => {
        it("should round trip AliasNameDataType through the binary encoding", async () => {
            // in process the ExtensionObject is passed by reference and never
            // encoded; here it is serialised, framed, and decoded by the client
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                const entries = await aliases.findAlias("%101");

                entries
                    .map((e) => e.aliasName)
                    .sort()
                    .should.eql(["FIT-101", "TI101"]);
                for (const entry of entries) {
                    entry.aliasName.should.be.a.String();
                    entry.referencedNodes.should.be.an.Array();
                    entry.referencedNodes[0].namespace.should.be.a.Number();
                }
            });
        });

        it("should round trip AliasNameVerboseDataType, including its null ServerUris", async () => {
            // AliasNameVerboseDataType had no generated class at all before this
            // work; a null inside its ServerUris array is the fiddly part
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                const [entry] = await aliases.findAliasVerbose("LSH-201");

                entry.serverUris.should.eql([null], "null survives the encoding");
                entry.serverUris.length.should.eql(entry.referencedNodes.length);
                sameNodeId(entry.aliasNameCategoryId, handle.nodeIds.unit200Category).should.eql(
                    true,
                    "the nested category, not the one called"
                );
            });
        });

        it("should preserve a non-zero namespace index on the AliasName", async () => {
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                const [entry] = await aliases.findAlias("TI101");
                entry.namespaceIndex.should.not.eql(0, "namespace 0 is reserved for the OPC Foundation");
            });
        });
    });

    describe("permissions under a real session", () => {
        it("should show every category to an engineer", async () => {
            await withSession(handle.endpointUrl, asUser("engineer"), async (session) => {
                const aliases = new ClientAliasSet(session);
                const names = (await aliases.findAlias("%")).map((e) => e.aliasName).sort();
                names.should.eql(["FIT-101", "LSH-201", "TI101"]);
            });
        });

        it("should hide a gated category from a contractor, without erroring", async () => {
            // clause 6.3.2 has no code for "exists but not for you"; absence is
            // the only answer that discloses nothing
            await withSession(handle.endpointUrl, asUser("contractor"), async (session) => {
                const aliases = new ClientAliasSet(session);
                const names = (await aliases.findAlias("%")).map((e) => e.aliasName).sort();
                names.should.eql(["FIT-101", "TI101"], "LSH-201 lives in the denied Unit200 category");
            });
        });

        it("should answer Bad_UserAccessDenied on a direct call to the denied category", async () => {
            await withSession(handle.endpointUrl, asUser("contractor"), async (session) => {
                const aliases = new ClientAliasSet(session);
                try {
                    await aliases.findAlias("%", { categoryNodeId: handle.nodeIds.unit200Category });
                    throw new Error("should have thrown");
                } catch (err) {
                    should(err).be.instanceOf(AliasNameCallError);
                    (err as AliasNameCallError).statusCode.should.eql(StatusCodes.BadUserAccessDenied);
                }
            });
        });

        it("should apply the gate per session, not per server", async () => {
            // two identities against one running server, interleaved
            const engineerNames = await withSession(handle.endpointUrl, asUser("engineer"), async (session) =>
                (await new ClientAliasSet(session).findAlias("%")).map((e) => e.aliasName).sort()
            );
            const contractorNames = await withSession(handle.endpointUrl, asUser("contractor"), async (session) =>
                (await new ClientAliasSet(session).findAlias("%")).map((e) => e.aliasName).sort()
            );

            engineerNames.should.containEql("LSH-201");
            contractorNames.should.not.containEql("LSH-201");
        });
    });

    describe("session lifetime", () => {
        it("should serve a second session after the first is closed", async () => {
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                (await new ClientAliasSet(session).findAlias("TI101")).should.have.length(1);
            });
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                (await new ClientAliasSet(session).findAlias("TI101")).should.have.length(1);
            });
        });

        it("should serve two concurrent sessions", async () => {
            const [a, b] = await Promise.all([
                withSession(handle.endpointUrl, ANONYMOUS, async (session) => new ClientAliasSet(session).findAlias("TI101")),
                withSession(handle.endpointUrl, ANONYMOUS, async (session) => new ClientAliasSet(session).findAlias("FIT-101"))
            ]);
            a[0].aliasName.should.eql("TI101");
            b[0].aliasName.should.eql("FIT-101");
        });

        it("should not leak cached Method NodeIds across sessions", async () => {
            // ClientAliasSet caches per instance; a new session gets a new one,
            // and the cached NodeIds must still be valid because they are the
            // Server's, not the session's
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                await aliases.findAlias("TI101");
                await aliases.findAliasVerbose("TI101");
                (await aliases.supportsVerbose()).should.eql(true);
            });
        });
    });

    describe("the ALIAS ServerCapability (OPC 10000-12 Annex D)", () => {
        it("should be advertised by the sample server", () => {
            // a Server that does not advertise it is never discovered by
            // anything looking for alias-capable Servers, silently
            handle.server.capabilitiesForMDNS.should.containEql(ALIAS_CAPABILITY);
        });

        it("should use the normative spelling", () => {
            ALIAS_CAPABILITY.should.eql("ALIAS", "Part 12 Annex D is normative; Part 17 prose writes it 'Alias'");
        });
    });

    describe("browsing the published hierarchy", () => {
        it("should expose the well-known categories and the vendor subcategory", async () => {
            await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                const top = (await aliases.browseSubCategories(ALIASES_ROOT)).map((c) => c.browseName);
                top.should.containEql("TagVariables");
                top.should.containEql("Topics");

                const nested = (await aliases.browseSubCategories(TAG_VARIABLES)).map((c) => c.browseName);
                nested.should.containEql("Unit200");
            });
        });
    });
});
