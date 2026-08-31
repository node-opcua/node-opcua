import { BinaryStream, BinaryStreamMaxNestingLevelExceededError } from "node-opcua-binary-stream";
import should from "should";
import { DiagnosticInfo } from "../dist/index.js";

//
// DiagnosticInfo is self-recursive through innerDiagnosticInfo. A chain of nested masks
// costs one byte per level on the wire, so a small message can nest the decoder deep
// enough to exhaust the call stack (OPC UA Part 6 §5.2.2.12). DiagnosticInfo.decode
// counts each level against BinaryStream's shared nesting budget and refuses to descend
// past it.
//
// The end-to-end path (build -> encode -> decode) is exercised here; the counter's own
// arithmetic is unit-tested in node-opcua-binary-stream. The limit is lowered so the test
// stays small and readable instead of building a 128-deep object graph.
//

function buildChain(totalLevels: number): DiagnosticInfo {
    let di = new DiagnosticInfo({ symbolicId: 1 });
    for (let i = 1; i < totalLevels; i++) {
        di = new DiagnosticInfo({ innerDiagnosticInfo: di });
    }
    return di;
}

function encode(di: DiagnosticInfo): BinaryStream {
    const stream = new BinaryStream(Buffer.alloc(64 * 1024));
    di.encode(stream);
    return new BinaryStream(stream.buffer.subarray(0, stream.length));
}

describe("DiagnosticInfo nesting guard", () => {
    let savedMax: number;
    beforeEach(() => {
        savedMax = BinaryStream.maxNestingLevel;
        BinaryStream.maxNestingLevel = 5;
    });
    afterEach(() => {
        BinaryStream.maxNestingLevel = savedMax;
    });

    it("decodes a chain up to the nesting limit", () => {
        const input = encode(buildChain(5));
        const decoded = new DiagnosticInfo({});
        should(() => decoded.decode(input)).not.throw();
        // innermost symbolicId survived the round-trip through all five levels
        let di: DiagnosticInfo | undefined = decoded;
        for (let i = 1; i < 5; i++) di = di?.innerDiagnosticInfo;
        di?.symbolicId.should.eql(1);
    });

    it("refuses a chain deeper than the nesting limit", () => {
        const input = encode(buildChain(6));
        const decoded = new DiagnosticInfo({});
        should(() => decoded.decode(input)).throw(BinaryStreamMaxNestingLevelExceededError);
    });

    it("does not reject a very deep chain when the limit is left at its generous default", () => {
        BinaryStream.maxNestingLevel = savedMax; // back to the shipped 128
        const input = encode(buildChain(100));
        const decoded = new DiagnosticInfo({});
        should(() => decoded.decode(input)).not.throw();
    });
});
