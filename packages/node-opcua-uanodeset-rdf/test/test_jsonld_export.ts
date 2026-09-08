/**
 * The JSON-LD export of a real model.
 *
 * There is no reader, so none of the checks that make a serialisation trustworthy are available
 * here: no round trip, no fixpoint, no digest equivalence. What is available is that the output
 * does not change unless someone means it to, and that is what these tests defend. The counts are
 * the parity figures from VOCABULARY.md, so a change to any of them is a change to how close this
 * sits to the reference implementation, and the hash catches everything the counts do not.
 */
import crypto from "node:crypto";
import { AddressSpace } from "node-opcua-address-space";
import { generateAddressSpace } from "node-opcua-address-space/nodeJS";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { addressSpaceToJsonLd, addressSpaceToJsonLdText, prefixOfNamespace } from "../source/index.js";

/** what the exporter produced when this test was written, for DI on top of the standard nodeset */
const DI_SHA1 = "16d2e9e535aeba450c7022799e42b6bbd6df787b";

type JsonLd = {
    "@context": Record<string, unknown>;
    "@graph": Record<string, unknown>[];
    "@included": Record<string, unknown>[];
};

describe("JSON-LD export", function (this: Mocha.Suite) {
    this.timeout(60_000);

    let addressSpace: AddressSpace;
    let doc: JsonLd;
    let text: string;

    before(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);
        doc = addressSpaceToJsonLd(addressSpace) as unknown as JsonLd;
        text = addressSpaceToJsonLdText(addressSpace);
    });

    after(() => {
        addressSpace.dispose();
    });

    it("RDF-1 exports the last namespace loaded, and says which model it is", () => {
        const ontology = doc["@graph"][0];
        should(ontology["@id"]).eql("http://opcfoundation.org/UA/DI/");
        should(ontology["@type"]).eql(["uardf:UANodeSet", "owl:Ontology"]);
        should(ontology.modelUri).eql("http://opcfoundation.org/UA/DI/");
        // the required models become owl:imports, which is what makes a reasoner load them
        should(ontology["owl:imports"]).eql([{ "@id": "http://opcfoundation.org/UA/" }]);
    });

    it("RDF-2 holds the parity figures VOCABULARY.md quotes", () => {
        should(doc["@graph"].length).eql(434, "@graph entries");
        should(doc["@included"].length).eql(173, "@included entries");
        should(Object.keys(doc["@context"]).length).eql(220, "@context terms");
    });

    it("RDF-3 names types by BrowseName and everything else by encoded NodeId", () => {
        const byId = new Map(doc["@graph"].map((entry) => [entry["@id"] as string, entry]));

        const deviceType = byId.get("di:DeviceType");
        should.exist(deviceType, "an ObjectType is named by its BrowseName");
        should(deviceType?.["@type"]).eql(["uardf:UAObjectType", "owl:Class"]);
        // HasSubtype is written as subClassOf rather than as a reference, which is what makes the
        // subtype chain an OWL class hierarchy a reasoner can walk
        should(deviceType?.subClassOf).eql("di:ComponentType");

        // an instance is named by base64url of its canonical NodeId, so no two models collide;
        // a type is named by its BrowseName, so a query can be written by hand
        let instances = 0;
        let types = 0;
        for (const entry of doc["@graph"]) {
            const id = entry["@id"] as string;
            if (!id.startsWith("di:")) continue; // the ontology node is the model's own uri
            const encoded = id.slice("di:".length);
            should(encoded).not.match(/[+/=]/, `${id} is base64url, unpadded, or a BrowseName`);
            const decoded = Buffer.from(encoded, "base64url").toString("utf8");
            if (decoded.startsWith("nsu=http://opcfoundation.org/UA/DI/;")) instances++;
            else types++;
        }
        should(instances).eql(375, "instances, named by encoded NodeId");
        should(types).eql(58, "types, named by BrowseName");
    });

    it("RDF-4 drops the legacy OPC Binary machinery and keeps the DataTypes", () => {
        // 447 nodes in the namespace, 14 of them the dictionaries, their descriptions and what
        // those own. VOCABULARY.md quotes the same 14.
        should(doc["@graph"].length - 1).eql(433, "the ontology node plus one entry per kept node");

        // ParameterResultDataType exists twice in DI: the DataType, and the description Variable
        // inside the binary dictionary. Exactly the second one goes, which is the whole rule.
        const named = doc["@graph"].filter((entry) => entry.name === "ParameterResultDataType");
        should(named.length).eql(1, "only one ParameterResultDataType survives");
        should(named[0]["@type"]).eql(["uardf:UADataType", "owl:Class"], "and it is the DataType");
    });

    it("RDF-5 declares every reference type the model defines as an owl:ObjectProperty", () => {
        const declarations = doc["@included"].filter((entry) => entry.label !== undefined);
        should(declarations.length).be.greaterThan(0);
        for (const entry of declarations) {
            should(entry["@type"]).eql("owl:ObjectProperty");
            should(entry.symmetric).be.a.Boolean();
        }
    });

    it("RDF-6 is unchanged", () => {
        // a hash rather than a fixture: the point is that nobody changes the output by accident,
        // and 280 KB of JSON in the tree would be read by no one
        should(crypto.createHash("sha1").update(text).digest("hex")).eql(
            DI_SHA1,
            "the export changed; if that was deliberate, update DI_SHA1 and the counts above"
        );
    });

    it("RDF-7 abbreviates a namespace by its last path segment", () => {
        should(prefixOfNamespace("http://opcfoundation.org/UA/")).eql("opcua");
        should(prefixOfNamespace("http://opcfoundation.org/UA/DI/")).eql("di");
        should(prefixOfNamespace("urn:example:Widget")).eql("widget");
    });
});
