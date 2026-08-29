import { BinaryStream } from "node-opcua-binary-stream";
import { QualifiedName } from "node-opcua-data-model";
import { coerceExpandedNodeId, ExpandedNodeId, NodeId, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { AliasNameDataType, AliasNameVerboseDataType } from "..";
import "should";

// The NodeIds assigned by OPC 10000-17 / the standard NodeSet2. Asserted as
// literals on purpose: comparing against node-opcua-constants would be circular,
// since the generator derives these very values from it (see code_gen/README.md).
const ALIAS_NAME_DATA_TYPE = 23468;
const ALIAS_NAME_DATA_TYPE_BINARY = 23499;
const ALIAS_NAME_DATA_TYPE_XML = 23505;
const ALIAS_NAME_DATA_TYPE_JSON = 23511;
const ALIAS_NAME_VERBOSE_DATA_TYPE = 24051;
const ALIAS_NAME_VERBOSE_DATA_TYPE_BINARY = 24262;
const ALIAS_NAME_VERBOSE_DATA_TYPE_XML = 24353;
const ALIAS_NAME_VERBOSE_DATA_TYPE_JSON = 24369;

/**
 * OPC 10000-17 (AliasNames) clauses 7.2 and 7.3.
 *
 * `AliasNameVerboseDataType` is what `FindAliasVerbose` returns; it has to encode
 * before that Method can be bound at all. These tests pin the four fields of
 * clause 7.3 Table 19 and the standard encoding NodeIds, so a future refresh of
 * the upstream `.bsd` that reorders or renames a field fails here rather than on
 * the wire.
 */
describe("OPC 10000-17: AliasName DataTypes", () => {
    /** Encode then decode through a fresh instance and return the reloaded object. */
    function binaryRoundTrip<T extends { encode(s: never): void; binaryStoreSize(): number }>(value: T, Ctor: new () => T): T {
        const stream = new BinaryStream(value.binaryStoreSize());
        (value as unknown as { encode(s: BinaryStream): void }).encode(stream);
        stream.rewind();
        const reloaded = new Ctor();
        (reloaded as unknown as { decode(s: BinaryStream): void }).decode(stream);
        return reloaded;
    }

    describe("AliasNameDataType (clause 7.2)", () => {
        it("should round trip through the binary encoding", () => {
            const value = new AliasNameDataType({
                aliasName: { namespaceIndex: 1, name: "TI101" },
                referencedNodes: [coerceExpandedNodeId("ns=2;s=Well/Temperature"), coerceExpandedNodeId("ns=2;i=4242")]
            });

            const reloaded = binaryRoundTrip(value, AliasNameDataType);

            reloaded.aliasName.toString().should.eql(value.aliasName.toString());
            reloaded.referencedNodes!.length.should.eql(2);
            reloaded.referencedNodes![0].toString().should.eql(value.referencedNodes![0].toString());
            reloaded.referencedNodes![1].toString().should.eql(value.referencedNodes![1].toString());
        });

        it("should preserve namespaceUri and serverIndex of referencedNodes at construction and through the binary encoding", () => {
            // Annex C.2: an aggregating server disambiguates alias targets with
            // serverIndex (against ServerArray) and namespaceUri - losing either
            // makes FindAlias results unresolvable for remote servers.
            const remote = new ExpandedNodeId(NodeIdType.STRING, "Temp1", 2, "urn:remote:pub1:ns", 1);
            const value = new AliasNameDataType({
                aliasName: { namespaceIndex: 1, name: "TI101" },
                referencedNodes: [remote]
            });

            value.referencedNodes![0].toString().should.eql("ns=2;s=Temp1;namespaceUri:urn:remote:pub1:ns;serverIndex:1");

            const reloaded = binaryRoundTrip(value, AliasNameDataType);
            reloaded.referencedNodes![0].namespaceUri!.should.eql("urn:remote:pub1:ns");
            reloaded.referencedNodes![0].serverIndex.should.eql(1);
            reloaded.referencedNodes![0].toString().should.eql(remote.toString());
        });

        it("should expose the standard DataType and encoding NodeIds", () => {
            AliasNameDataType.dataTypeNodeId.value.should.eql(ALIAS_NAME_DATA_TYPE);
            AliasNameDataType.encodingDefaultBinary.value.should.eql(ALIAS_NAME_DATA_TYPE_BINARY);
            AliasNameDataType.encodingDefaultXml.value.should.eql(ALIAS_NAME_DATA_TYPE_XML);
            AliasNameDataType.encodingDefaultJson.value.should.eql(ALIAS_NAME_DATA_TYPE_JSON);
        });
    });

    describe("AliasNameVerboseDataType (clause 7.3)", () => {
        it("should declare exactly the four fields of Table 19, in order", () => {
            AliasNameVerboseDataType.possibleFields.should.eql([
                "aliasName",
                "referencedNodes",
                "serverUris",
                "aliasNameCategoryId"
            ]);
        });

        it("should round trip through the binary encoding", () => {
            const value = new AliasNameVerboseDataType({
                aliasName: { namespaceIndex: 1, name: "TI101" },
                referencedNodes: [coerceExpandedNodeId("ns=2;s=Local"), coerceExpandedNodeId("ns=3;i=7")],
                // clause 7.3: parallel to referencedNodes, null for a node on the local server
                serverUris: [null, "urn:remote:server"],
                aliasNameCategoryId: resolveNodeId("i=23479")
            });

            const reloaded = binaryRoundTrip(value, AliasNameVerboseDataType);

            reloaded.aliasName.toString().should.eql(value.aliasName.toString());
            reloaded
                .referencedNodes!.map((n: ExpandedNodeId) => n.toString())
                .should.eql(value.referencedNodes!.map((n: ExpandedNodeId) => n.toString()));
            reloaded.serverUris!.should.eql([null, "urn:remote:server"]);
            reloaded.aliasNameCategoryId.toString().should.eql(value.aliasNameCategoryId.toString());
        });

        it("should keep ServerUris parallel to ReferencedNodes across the encoding", () => {
            const value = new AliasNameVerboseDataType({
                aliasName: { namespaceIndex: 1, name: "FIT-101" },
                referencedNodes: [
                    coerceExpandedNodeId("ns=2;i=1"),
                    coerceExpandedNodeId("ns=2;i=2"),
                    coerceExpandedNodeId("ns=2;i=3")
                ],
                serverUris: [null, "urn:a", null]
            });

            const reloaded = binaryRoundTrip(value, AliasNameVerboseDataType);

            reloaded.serverUris!.length.should.eql(reloaded.referencedNodes!.length);
            reloaded.serverUris!.should.eql([null, "urn:a", null]);
        });

        it("should default to an empty structure when constructed with no options", () => {
            const value = new AliasNameVerboseDataType();
            value.referencedNodes!.should.eql([]);
            value.serverUris!.should.eql([]);
            value.aliasNameCategoryId.should.eql(NodeId.nullNodeId);
            value.aliasName.should.eql(new QualifiedName({}));
        });

        it("should project to JSON with the Table 19 field names", () => {
            const value = new AliasNameVerboseDataType({
                aliasName: { namespaceIndex: 1, name: "LSH-201" },
                referencedNodes: [coerceExpandedNodeId("ns=2;i=9")],
                serverUris: [null],
                aliasNameCategoryId: resolveNodeId("i=23488")
            });
            const json = value.toJSON() as Record<string, unknown>;
            Object.keys(json).should.eql(["aliasName", "referencedNodes", "serverUris", "aliasNameCategoryId"]);
        });

        it("should expose the standard DataType and encoding NodeIds", () => {
            // A type present in the .bsd but missing from node-opcua-constants
            // generates silently with NodeId 0 - this is the guard against that.
            AliasNameVerboseDataType.dataTypeNodeId.value.should.eql(ALIAS_NAME_VERBOSE_DATA_TYPE);
            AliasNameVerboseDataType.encodingDefaultBinary.value.should.eql(ALIAS_NAME_VERBOSE_DATA_TYPE_BINARY);
            AliasNameVerboseDataType.encodingDefaultXml.value.should.eql(ALIAS_NAME_VERBOSE_DATA_TYPE_XML);
            AliasNameVerboseDataType.encodingDefaultJson.value.should.eql(ALIAS_NAME_VERBOSE_DATA_TYPE_JSON);
        });
    });
});
