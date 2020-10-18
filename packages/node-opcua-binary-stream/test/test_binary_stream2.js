const { BinaryStreamSizeCalculator, BinaryStream } = require("..");
const should = require("should");

const testCases = [
    { suffix: "Int8", value: 100, expectedLength: 1 },
    { suffix: "UInt8", value: 100, expectedLength: 1 },
    { suffix: "Int16", value: 100, expectedLength: 2 },
    { suffix: "UInt16", value: 100, expectedLength: 2 },
    { suffix: "Integer", value: 100, expectedLength: 4 },
    { suffix: "UInt32", value: 100, expectedLength: 4 },
    { suffix: "ByteStream", value: Buffer.from([1, 2, 3]), expectedLength: 4 + 3 },
    { suffix: "ByteStream", value: Buffer.alloc(0), expectedLength: 4 },
    { suffix: "ByteStream", value: null, expectedLength: 4 },
    { suffix: "String", value: "étienne", expectedLength: 4 + 8 },
    { suffix: "String", value: "", expectedLength: 4 },
    { suffix: "String", value: null, expectedLength: 4 },
    { suffix: "Float", value: 0, expectedLength: 4 },
    { suffix: "Double", value: 0, expectedLength: 8 },
    { suffix: "ArrayBuffer", value: new ArrayBuffer(10), expectedLength: 10 }
    //{ suffix: "Int64", value: [0, 100], expectedLength: 8 },
    //{ suffix: "UInt64", value: [0, 100], expectedLength: 8 },
]
describe("BinaryStreamSizeCalculator", () => {

    for (const { suffix, value, expectedLength } of testCases) {
        it(`${suffix}`, () => {
            const binarySizeCalculator = new BinaryStreamSizeCalculator();

            const p = binarySizeCalculator["write" + suffix];

            should.exist(p, " BinaryStreamSizeCalculator#write" + suffix + " not found");
            p.call(binarySizeCalculator, value);

            binarySizeCalculator.length.should.eql(expectedLength);

            binarySizeCalculator.rewind();
            binarySizeCalculator.length.should.eql(0);

        })

    }
});
describe("BinaryStream", () => {

    for (const { suffix, value, expectedLength } of testCases) {
        it(`${suffix}`, () => {
            const stream = new BinaryStream();

            const p = stream["write" + suffix];
            p.call(stream, value);

            stream.length.should.eql(expectedLength);

            stream.rewind();
            const r = stream["read" + suffix];
            const value2 = r.call(stream);

            if (value === null) {
                should(value2).eql(null);
            } else if (value instanceof ArrayBuffer) {
                // nothing
            } else if (value instanceof Buffer) {
                value.toString("base64").should.eql(value2.toString("base64"));
            } else {

                value.should.eql(value2);
            }
        })
    }
});