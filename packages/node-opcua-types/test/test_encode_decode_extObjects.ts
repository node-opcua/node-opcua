import { BinaryStream } from "node-opcua-binary-stream";
import { DataType } from "node-opcua-variant";
import { PubSubConfigurationDataType, PubSubConnectionDataType, UABinaryFileDataType } from "..";
import "should";

describe("Testing encoding/decoding of complex ExtensionObjects", () => {
    it("should encode and decode a large extension object encodeExtensionObject/decodeExtensionObject", async () => {
        const value = new PubSubConfigurationDataType({
            connections: [new PubSubConnectionDataType({})]
        });
        const binaryFile = new UABinaryFileDataType({
            body: { dataType: DataType.ExtensionObject, value }
        });

        const stream = new BinaryStream(binaryFile.binaryStoreSize());
        binaryFile.encode(stream);

        const reloaded = new UABinaryFileDataType();
        stream.rewind();

        reloaded.decode(stream);

        const a = binaryFile.toJSON();
        const b = reloaded.toJSON();

        a.should.eql(b);
        // console.log(a);
    });
});
