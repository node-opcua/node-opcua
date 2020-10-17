// tslint:disable: no-console
import { Benchmarker } from "node-opcua-benchmarker";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { Guid, isValidGuid } from "node-opcua-guid";
import { encodeGuid, randomGuid } from "..";

function write_UInt16Old(stream: OutputBinaryStream, guid: string, starts: number[]) {
    const n = starts.length;
    for (let i = 0; i < n; i++) {
        const start = starts[i];
        stream.writeUInt16(parseInt(guid.substr(start, 4), 16));
    }
}
function write_UInt32Old(stream: OutputBinaryStream, guid: string, starts: number[]) {
    const n = starts.length;
    for (let i = 0; i < n; i++) {
        const start = starts[i];
        stream.writeUInt32(parseInt(guid.substr(start, 8), 16));
    }
}
function write_UInt8Old(stream: OutputBinaryStream, guid: string, starts: number[]) {
    const n = starts.length;
    for (let i = 0; i < n; i++) {
        const start = starts[i];
        stream.writeUInt8(parseInt(guid.substr(start, 2), 16));
    }
}
export function encodeGuidOld(guid: Guid, stream: OutputBinaryStream): void {
    if (!isValidGuid(guid)) {
        throw new Error(" Invalid GUID : '" + JSON.stringify(guid) + "'");
    }
    write_UInt32Old(stream, guid, [0]);
    write_UInt16Old(stream, guid, [9, 14]);
    write_UInt8Old(stream, guid, [19, 21, 24, 26, 28, 30, 32, 34]);
}

describe("", () => {
    it("should encode guid efficiently", () => {
        const bench = new Benchmarker();

        const stream = new BinaryStream(100);
        stream.length.should.equal(0);

        const guid = randomGuid();
        const guid1 = randomGuid();
        const guid2 = randomGuid();
        const guid3 = randomGuid();
        const guid4 = "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF";

        console.log(guid);
        bench
            .add("encodeDecode GUID v1", () => {
                stream.rewind();
                encodeGuidOld(guid, stream);
                encodeGuidOld(guid1, stream);
                encodeGuidOld(guid2, stream);
                encodeGuidOld(guid3, stream);
                encodeGuidOld(guid4, stream);
            })
            .add("encodeDecode GUID v2", () => {
                stream.rewind();
                encodeGuid(guid, stream);
                encodeGuid(guid1, stream);
                encodeGuid(guid2, stream);
                encodeGuid(guid3, stream);
                encodeGuid(guid4, stream);
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: any) {
                console.log(" Fastest is " + this.fastest.name);
                console.log(" Speed Up : x", this.speedUp);
            })
            .run({ max_time: 0.5 });
    });
});
