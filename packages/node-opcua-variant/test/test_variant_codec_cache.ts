import type { BinaryStream as IBinaryStream } from "node-opcua-binary-stream";
import { BinaryStream } from "node-opcua-binary-stream";
import { findBuiltInType, registerType } from "node-opcua-factory";
import should from "should";
import { DataType, decodeVariant, Variant, VariantArrayType } from "..";

//
// get_encoder/get_decoder memoise the built-in codec per numeric DataType, because
// resolving one costs a reverse-enum lookup plus a recursive findBuiltInType with two
// string-hash Map lookups - and that ran once per scalar Variant, on both encode and
// decode.
//
// registerType and unregisterType are public API, so the memo has to be dropped when
// the registry changes or the cache serves a function that no longer exists. These
// tests exercise that through observable behaviour rather than by spying: the dist
// bundles expose their functions as getter-only, non-configurable properties, so a
// module-namespace spy silently fails to attach and would make the test vacuous.
//

describe("Variant codec cache invalidation", () => {
    const stock = findBuiltInType("Double");
    const stockEncode = stock.encode;
    const stockDecode = stock.decode;

    function restoreDouble() {
        registerType({
            name: "Double",
            subType: "Number",
            encode: stockEncode,
            decode: stockDecode,
            defaultValue: 0.0
        });
    }

    // the registry is process-global and the CI runner loads every test file into one
    // process, so leaving a sentinel codec registered would corrupt unrelated suites
    afterEach(() => {
        restoreDouble();
    });

    function encodedDouble(value: number): Buffer {
        const variant = new Variant({ dataType: DataType.Double, value });
        const buffer = Buffer.allocUnsafe(variant.binaryStoreSize());
        variant.encode(new BinaryStream(buffer));
        return buffer;
    }

    it("should pick up a decoder re-registered after the cache has been warmed", () => {
        const buffer = encodedDouble(1.5);

        // warm the memo through the normal path
        decodeVariant(new BinaryStream(buffer)).value.should.eql(1.5);

        registerType({
            name: "Double",
            subType: "Number",
            encode: stockEncode,
            decode: (stream: IBinaryStream) => {
                stockDecode(stream); // keep the cursor honest
                return 999;
            },
            defaultValue: 0.0
        });

        decodeVariant(new BinaryStream(buffer)).value.should.eql(999);
    });

    it("should return to the original decoder once it is registered back", () => {
        const buffer = encodedDouble(2.25);

        registerType({
            name: "Double",
            subType: "Number",
            encode: stockEncode,
            decode: (stream: IBinaryStream) => {
                stockDecode(stream);
                return 999;
            },
            defaultValue: 0.0
        });
        decodeVariant(new BinaryStream(buffer)).value.should.eql(999);

        restoreDouble();

        decodeVariant(new BinaryStream(buffer)).value.should.eql(2.25);
    });

    it("should not serve a cached codec to a numeric-string dataType", () => {
        // Array indices are strings, so encoderTable["11"] and encoderTable[11] are the
        // same slot. Once Double (11) is memoised, a Variant-shaped object carrying the
        // string "11" would be silently accepted unless the lookup checks the type first.
        const warm = new Variant({ dataType: DataType.Double, value: 1.5 });
        warm.encode(new BinaryStream(Buffer.allocUnsafe(warm.binaryStoreSize())));

        const forged = Object.create(Variant.prototype) as Variant;
        forged.dataType = String(DataType.Double) as unknown as DataType;
        forged.arrayType = VariantArrayType.Scalar;
        forged.value = 1.5;
        forged.dimensions = null;

        should(() => forged.encode(new BinaryStream(Buffer.allocUnsafe(32)))).throw();
    });

    it("should keep decoding every scalar DataType correctly once the cache is warm", () => {
        // a cache keyed by the wrong thing would cross-wire two DataTypes; decoding the
        // same set twice catches that, since the second pass runs entirely from the memo
        const samples: { dataType: DataType; value: number | string | boolean }[] = [
            { dataType: DataType.Double, value: 1.5 },
            { dataType: DataType.Float, value: 2.5 },
            { dataType: DataType.UInt32, value: 7 },
            { dataType: DataType.Int32, value: -3 },
            { dataType: DataType.UInt16, value: 9 },
            { dataType: DataType.Int16, value: -9 },
            { dataType: DataType.Byte, value: 200 },
            { dataType: DataType.SByte, value: -100 },
            { dataType: DataType.Boolean, value: true },
            { dataType: DataType.String, value: "hello" }
        ];

        for (let pass = 0; pass < 2; pass++) {
            for (const { dataType, value } of samples) {
                const variant = new Variant({ dataType, value });
                const buffer = Buffer.allocUnsafe(variant.binaryStoreSize());
                variant.encode(new BinaryStream(buffer));

                const decoded = decodeVariant(new BinaryStream(buffer));
                decoded.dataType.should.eql(dataType, `pass ${pass}, DataType ${DataType[dataType]}`);
                should(decoded.value).eql(value, `pass ${pass}, DataType ${DataType[dataType]}`);
            }
        }
    });
});
