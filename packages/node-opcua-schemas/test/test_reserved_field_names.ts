import { BinaryStream } from "node-opcua-binary-stream";
import { BaseUAObject, DataTypeFactory } from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import should from "should";
import {
    type AnyConstructorFunc,
    createDynamicObjectConstructor,
    getOrCreateStructuredTypeSchema,
    InternalTypeDictionary,
    type MapDataTypeAndEncodingIdProvider,
    type StructureTypeRaw
} from "../source/index.js";
import { MockProvider } from "./mock_id_provider.js";

// A StructureDefinition may originate from a remote peer. A field whose name is a
// reserved JavaScript property ("__proto__", "constructor", "prototype") must be
// stored as an ordinary own data property on the decoded instance and must never
// alter the instance's prototype chain.
describe("dynamic extension object - reserved structure field names", () => {
    const dataTypeFactory = new DataTypeFactory([]);
    const idProvider: MapDataTypeAndEncodingIdProvider = new MockProvider();
    const dict = new InternalTypeDictionary();

    function build(raw: StructureTypeRaw): AnyConstructorFunc {
        dict.addStructureRaw(raw);
        const schema = getOrCreateStructuredTypeSchema(raw.name, dict, dataTypeFactory, idProvider);
        return createDynamicObjectConstructor(schema, dataTypeFactory);
    }

    it("keeps the prototype chain when a scalar field is named __proto__", () => {
        const Evil = build({
            name: "EvilScalar",
            baseType: "ExtensionObject",
            fields: [{ name: "__proto__", fieldType: "opc:Int32" }]
        });
        const evil = new Evil();
        should(evil instanceof BaseUAObject).eql(true);
        should(typeof (evil as unknown as { encode: unknown }).encode).eql("function");
    });

    it("keeps the prototype chain at construction when an array field is named __proto__", () => {
        const Evil = build({
            name: "EvilArray",
            baseType: "ExtensionObject",
            fields: [{ name: "__proto__", isArray: true, fieldType: "opc:Int32" }]
        });
        const evil = new Evil();
        should(evil instanceof BaseUAObject).eql(true);
        should(typeof (evil as unknown as { encode: unknown }).encode).eql("function");
        should(Object.prototype.hasOwnProperty.call(evil, "__proto__")).eql(true);
    });

    it("keeps the prototype chain when decoding an absent array field named __proto__", () => {
        const Evil = build({
            name: "EvilArrayDecode",
            baseType: "ExtensionObject",
            fields: [{ name: "__proto__", isArray: true, fieldType: "opc:Int32" }]
        });
        const evil = new Evil();
        const wire = Buffer.alloc(4);
        wire.writeUInt32LE(0xffffffff, 0); // null array
        (evil as unknown as { decode: (s: BinaryStream) => void }).decode(new BinaryStream(wire));

        should(evil instanceof BaseUAObject).eql(true);
        should((evil as unknown as Record<string, unknown>)["__proto__"]).eql(null);
        // no global pollution
        should((Object.prototype as unknown as Record<string, unknown>).__evil).eql(undefined);
    });
});
