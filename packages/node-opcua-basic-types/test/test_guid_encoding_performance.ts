// tslint:disable: no-console
import { Benchmarker } from "node-opcua-benchmarker";
import { BinaryStream, OutputBinaryStream } from "node-opcua-binary-stream";
import { Guid, isValidGuid } from "node-opcua-guid";
import * as should from "should";
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

describe("GUID", () => {
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

describe("Map vs Object", () => {
    it("inserting ", () => {
        const bench = new Benchmarker();

        const map = new Map();
        const _map: any = {};
        let counter = 0;
        bench
            .add("inserting with Map", () => {
                map.set(counter.toString(), counter);
                counter = (counter + 1) % 12000;
            })
            .add("inserting with Object", () => {
                _map[counter.toString()] = counter;
                counter = (counter + 1) % 12000;
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: any) {
                console.log(" Fastest is " + this.fastest.name);
                console.log(" Speed Up : x", this.speedUp);
            })
            .run({ max_time: 0.25, min_count: 1000 });
    });

    it("has  ", () => {
        const bench = new Benchmarker();

        const map = new Map();
        const _map: any = {};

        let counter = 0;
        for (let i = counter; i < counter + 120000; i += 3) {
            map.set(counter.toString(), counter);
            _map[counter.toString()] = counter;
            counter++;
        }
        bench
            .add("has with Map", () => {
                map.has(counter.toString());
                counter = (counter + 1) % 120000;
            })
            .add("with Object", () => {
                Object.prototype.hasOwnProperty.call(_map,counter.toString());
                counter = (counter + 1) % 120000;
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: any) {
                console.log(" Fastest is " + this.fastest.name);
                console.log(" Speed Up : x", this.speedUp);
            })
            .run({ max_time: 0.25, min_count: 1000 });
    });
    it("get  ", () => {
        const bench = new Benchmarker();

        const map = new Map();
        const _map: any = {};

        let counter = 0;
        for (let i = counter; i < counter + 120000; i += 3) {
            map.set(counter.toString(), counter);
            _map[counter.toString()] = counter;
            counter++;
        }
        bench
            .add("has with Map", () => {
                const a = map.get(counter.toString());
                counter = (counter + 1) % 120000;
            })
            .add("with Object", () => {
                const a = _map[counter.toString()];
                counter = (counter + 1) % 120000;
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: any) {
                console.log(" Fastest is " + this.fastest.name);
                console.log(" Speed Up : x", this.speedUp);
            })
            .run({ max_time: 0.25, min_count: 1000 });
    });
});

describe("encodeGuid", () => {
    it("should raise a exception if GUID is invalid", () => {
        const stream = new BinaryStream(100);
        should.throws(() => {
            encodeGuid("Invalid GUID String", stream);
        });
    });
});
