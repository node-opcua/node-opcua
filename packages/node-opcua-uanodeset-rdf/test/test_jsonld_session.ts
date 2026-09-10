/**
 * The session-sourced export, judged against the address-space one.
 *
 * A `PseudoSession` over a loaded address space is the oracle this package would otherwise not
 * have. Both paths see the same model, so every difference between the two documents is a thing
 * OPC UA cannot say about a node rather than a thing the collector got wrong. Naming those
 * differences is the point: they are the contract of the session entry point, and VOCABULARY.md
 * lists the same ones.
 */
import { AddressSpace, PseudoSession } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS.js";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { addressSpaceToJsonLd } from "../source/address_space.js";
import { sessionToJsonLd, sessionToJsonLdText } from "../source/session.js";

const DI = "http://opcfoundation.org/UA/DI/";

type Entry = Record<string, unknown>;
type JsonLd = { "@context": Record<string, unknown>; "@graph": Entry[]; "@included": Entry[] };

const byId = (doc: JsonLd) => new Map(doc["@graph"].map((entry) => [entry["@id"] as string, entry]));

describe("JSON-LD from a session", function (this: Mocha.Suite) {
    this.timeout(120_000);

    let addressSpace: AddressSpace;
    let fromAddressSpace: JsonLd;
    let fromSession: JsonLd;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);
        fromAddressSpace = addressSpaceToJsonLd(addressSpace, { modelUri: DI }) as unknown as JsonLd;
        fromSession = (await sessionToJsonLd(new PseudoSession(addressSpace), { modelUri: DI })) as unknown as JsonLd;
    });

    after(() => {
        addressSpace.dispose();
    });

    it("RDFS-1 exports the same model, named the same way", () => {
        const ontology = fromSession["@graph"][0];
        should(ontology["@id"]).eql(DI);
        should(ontology["@type"]).eql(["uardf:UANodeSet", "owl:Ontology"]);
        should(ontology.modelUri).eql(DI);
    });

    it("RDFS-2 reaches every node except the ones nothing references", () => {
        const expected = new Set(byId(fromAddressSpace).keys());
        const actual = new Set(byId(fromSession).keys());

        const extra = [...actual].filter((id) => !expected.has(id));
        should(extra).eql([], "a crawl from Root reached a node the namespace does not hold");

        // OPC UA has no service that lists the nodes of a namespace, so the model is whatever a
        // crawl reaches. DI declares nine well-known function-group Objects that nothing points
        // at, in either direction: no crawl can reach them, from any root, by any reference type.
        const missing = [...expected].filter((id) => !actual.has(id));
        const names = missing.map((id) => byId(fromAddressSpace).get(id)?.name).sort();
        should(names).eql([
            "Configuration",
            "Diagnostics",
            "Identification",
            "Maintenance",
            "OperationCounters",
            "Operational",
            "Statistics",
            "Status",
            "Tuning"
        ]);

        // and the reason, checked rather than asserted: the address space holds no reference to
        // any of them, so their absence is a property of the model, not of this collector
        for (const id of missing) {
            const nodeId = Buffer.from(id.slice("di:".length), "base64url").toString("utf8");
            const node = addressSpace.findNode(nodeId.replace(`nsu=${DI};`, "ns=1;"));
            should.exist(node, `${nodeId} is in the address space`);
            should(node?.allReferences().filter((reference) => !reference.isForward)).eql(
                [],
                `${nodeId} is referenced by nothing, so no crawl finds it`
            );
        }
    });

    it("RDFS-3 gives every node the same @type, dataType and value", () => {
        const expected = byId(fromAddressSpace);
        const differences: string[] = [];
        for (const [id, actual] of byId(fromSession)) {
            const reference = expected.get(id);
            if (!reference) continue;
            for (const field of ["@type", "dataType", "valueRank", "arrayDimensions", "value", "name", "browseName"]) {
                if (JSON.stringify(actual[field]) !== JSON.stringify(reference[field])) {
                    differences.push(`${id}.${field}: ${JSON.stringify(actual[field])} != ${JSON.stringify(reference[field])}`);
                }
            }
        }
        should(differences).eql([]);
    });

    it("RDFS-4 states the subtype chain and the children the same way", () => {
        const expected = byId(fromAddressSpace);
        const differences: string[] = [];
        for (const [id, actual] of byId(fromSession)) {
            const reference = expected.get(id);
            if (!reference || id === DI) continue; // the ontology node is RDFS-7's business
            // every predicate the address-space document states, the session document states too,
            // which is the claim that matters for a query written against either
            for (const key of Object.keys(reference)) {
                if (key === "symbolicName") continue; // not an attribute; see RDFS-6
                const a = JSON.stringify(actual[key]);
                const b = JSON.stringify(reference[key]);
                if (a !== b) differences.push(`${id}.${key}: ${a} != ${b}`);
            }
        }
        should(differences).eql([], "the two documents state a node differently");
    });

    it("RDFS-5 declares the same context terms and the same @included entries", () => {
        should(Object.keys(fromSession["@context"]).sort()).eql(Object.keys(fromAddressSpace["@context"]).sort());

        const idsOf = (doc: JsonLd) => [...new Set(doc["@included"].map((entry) => entry["@id"] as string))].sort();
        should(idsOf(fromSession)).eql(idsOf(fromAddressSpace));
    });

    it("RDFS-6 carries no SymbolicName, because OPC UA has no such attribute", () => {
        // the address-space document has them; the session document cannot, and this is the
        // documented difference rather than a defect
        const withSymbolic = fromAddressSpace["@graph"].filter((entry) => entry.symbolicName !== undefined);
        should(withSymbolic.length).be.greaterThan(0, "the NodeSet2 document does state SymbolicName");
        should(fromSession["@graph"].filter((entry) => entry.symbolicName !== undefined)).eql([]);
    });

    it("RDFS-7 carries no owl:imports, because NamespaceMetadataType states no required models", () => {
        should(fromAddressSpace["@graph"][0]["owl:imports"]).eql([{ "@id": "http://opcfoundation.org/UA/" }]);
        should(fromSession["@graph"][0]["owl:imports"]).eql(undefined);
        should(fromSession["@graph"][0].requiredModels).eql(undefined);
    });

    it("RDFS-8 serialises, and twice over the same server gives the same bytes", async () => {
        const session = new PseudoSession(addressSpace);
        const once = await sessionToJsonLdText(session, { modelUri: DI });
        const twice = await sessionToJsonLdText(session, { modelUri: DI });
        should(once).eql(twice, "a crawl is ordered, so two exports of one server agree");
        should(once.endsWith("\n")).eql(true);
    });
});
