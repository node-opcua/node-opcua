import "mocha";
import { StatusCodes } from "node-opcua-status-code";
import should from "should";
import { AliasNameCallError, ClientAliasSet } from "node-opcua-alias-name-client";
import { startSampleServer, type SampleServerHandle } from "../bin/sample_server_with_aliases.js";
import { ANONYMOUS, withSession } from "./helpers.js";

/**
 * A `FindAlias` response large enough to span more than one message chunk.
 *
 * In process the result is an array of objects handed straight to the caller, so
 * nothing here is exercised: the array is never serialised, never split across
 * chunks, and never reassembled. This is the test that says the feature works on
 * a real plant tag set rather than on three demo tags.
 */
describe("OPC 10000-17: a large FindAlias result", function () {
    this.timeout(180000);

    /** Comfortably more than one 8 KB chunk once encoded. */
    const BULK_COUNT = 2000;

    let handle: SampleServerHandle;

    before(async () => {
        handle = await startSampleServer({
            port: 48562,
            bulkAliasCount: BULK_COUNT,
            // above the bulk count, so the cap is not what is being tested here
            maxResults: BULK_COUNT * 2
        });
    });

    after(async () => {
        await handle.shutdown();
    });

    it("should return every alias of a large set intact", async () => {
        await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
            const aliases = new ClientAliasSet(session);
            const entries = await aliases.findAlias("BULK-%");

            entries.should.have.length(BULK_COUNT, "nothing lost in framing or reassembly");
        });
    });

    it("should keep every entry well formed after chunked transfer", async () => {
        await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
            const aliases = new ClientAliasSet(session);
            const entries = await aliases.findAlias("BULK-%");

            // a chunk boundary falling inside an ExtensionObject would corrupt
            // the entries around it rather than the whole response
            for (const entry of entries) {
                entry.aliasName.should.match(/^BULK-\d{5}$/);
                entry.referencedNodes.should.have.length(1);
                should.exist(entry.referencedNodes[0].value);
            }
        });
    });

    it("should return them in a stable order across calls", async () => {
        await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
            const aliases = new ClientAliasSet(session);
            const first = (await aliases.findAlias("BULK-%")).map((e) => e.aliasName);
            const second = (await aliases.findAlias("BULK-%")).map((e) => e.aliasName);
            second.should.eql(first, "insertion order is deterministic, which is why it is the default");
        });
    });

    it("should carry a large verbose result too", async () => {
        // AliasNameVerboseDataType is the bigger of the two encodings
        await withSession(handle.endpointUrl, ANONYMOUS, async (session) => {
            const aliases = new ClientAliasSet(session);
            const entries = await aliases.findAliasVerbose("BULK-%");

            entries.should.have.length(BULK_COUNT);
            entries.every((e) => e.serverUris.length === e.referencedNodes.length).should.eql(true);
        });
    });

    it("should still honour maxResults on a large set", async () => {
        // a second server, capped below the bulk count
        const capped = await startSampleServer({
            port: 48563,
            bulkAliasCount: 100,
            maxResults: 10
        });
        try {
            await withSession(capped.endpointUrl, ANONYMOUS, async (session) => {
                const aliases = new ClientAliasSet(session);
                try {
                    await aliases.findAlias("BULK-%");
                    throw new Error("should have thrown");
                } catch (err) {
                    should(err).be.instanceOf(AliasNameCallError);
                    (err as AliasNameCallError).statusCode.should.eql(StatusCodes.BadResponseTooLarge);
                }

                // "try new filter and repeat find" - a narrower pattern works
                const narrower = await aliases.findAlias("BULK-0000%");
                narrower.length.should.be.belowOrEqual(10);
            });
        } finally {
            await capped.shutdown();
        }
    });
});
