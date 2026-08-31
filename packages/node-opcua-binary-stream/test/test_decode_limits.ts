import should from "should";
import { BinaryStream, BinaryStreamArrayLengthExceededError, BinaryStreamMaxNestingLevelExceededError } from "../dist/index.js";

//
// Two decode-side guards live on BinaryStream so that every decoder - across packages -
// shares one implementation and one budget:
//
//   * checkArrayLength: refuses a wire array length that could not possibly be backed by
//     the remaining bytes, or that exceeds the configured ceiling. Without it a 12-byte
//     message can drive billions of decode iterations.
//
//   * enterNestingLevel / exitNestingLevel: bound how deep a recursive type may nest, so
//     a small message cannot exhaust the call stack (OPC UA Part 6 §5.1.8/§5.1.9).
//
// They are tested here in isolation, with no wire framing, because the value they protect
// is arithmetic, not any particular message shape.
//

describe("BinaryStream.checkArrayLength", () => {
    // A fresh 100-byte stream positioned at the start: 100 bytes remain to be read.
    function streamWithRemaining(remaining: number): BinaryStream {
        return new BinaryStream(Buffer.alloc(remaining));
    }

    let savedMax: number;
    beforeEach(() => {
        savedMax = BinaryStream.maxArrayLength;
    });
    afterEach(() => {
        BinaryStream.maxArrayLength = savedMax;
    });

    it("accepts a length that fits within both the ceiling and the remaining bytes", () => {
        const stream = streamWithRemaining(100);
        should(() => stream.checkArrayLength(100)).not.throw();
        should(() => stream.checkArrayLength(0)).not.throw();
    });

    it("rejects a length larger than the bytes remaining, even when under the ceiling", () => {
        const stream = streamWithRemaining(100);
        // 101 elements cannot be backed by 100 bytes: every element is at least one byte.
        should(() => stream.checkArrayLength(101)).throw(BinaryStreamArrayLengthExceededError);
    });

    it("rejects an implausibly large length instantly (huge length, tiny body)", () => {
        const stream = streamWithRemaining(8);
        should(() => stream.checkArrayLength(0x7ffffffe)).throw(BinaryStreamArrayLengthExceededError);
    });

    it("rejects a length above the configured ceiling", () => {
        BinaryStream.maxArrayLength = 10;
        // Give it plenty of bytes so only the ceiling can be the reason it is refused.
        const stream = streamWithRemaining(1000);
        should(() => stream.checkArrayLength(11)).throw(BinaryStreamArrayLengthExceededError, {
            message: /maximum allowed length of 10/
        });
        should(() => stream.checkArrayLength(10)).not.throw();
    });

    it("accounts for bytes already consumed", () => {
        const stream = streamWithRemaining(100);
        stream.readUInt32(); // consume 4 bytes -> 96 remain
        should(() => stream.checkArrayLength(96)).not.throw();
        should(() => stream.checkArrayLength(97)).throw(BinaryStreamArrayLengthExceededError);
    });
});

describe("BinaryStream nesting-level guard", () => {
    let savedMax: number;
    beforeEach(() => {
        savedMax = BinaryStream.maxNestingLevel;
    });
    afterEach(() => {
        BinaryStream.maxNestingLevel = savedMax;
    });

    it("allows exactly maxNestingLevel levels and refuses the next", () => {
        BinaryStream.maxNestingLevel = 3;
        const stream = new BinaryStream(Buffer.alloc(16));
        stream.enterNestingLevel();
        stream.enterNestingLevel();
        stream.enterNestingLevel();
        should(() => stream.enterNestingLevel()).throw(BinaryStreamMaxNestingLevelExceededError);
    });

    it("restores the budget as levels are exited", () => {
        BinaryStream.maxNestingLevel = 2;
        const stream = new BinaryStream(Buffer.alloc(16));
        stream.enterNestingLevel();
        stream.enterNestingLevel();
        should(() => stream.enterNestingLevel()).throw(BinaryStreamMaxNestingLevelExceededError);
        stream.exitNestingLevel();
        // one level was freed, so one more entry must now be allowed again
        should(() => stream.enterNestingLevel()).not.throw();
    });

    it("does not leak a level when an entry is refused", () => {
        // A refused enterNestingLevel is never paired with an exitNestingLevel (callers
        // put it before their try/finally). If it leaked, repeated refusals would starve
        // the budget permanently; this asserts the budget is unchanged after a refusal.
        BinaryStream.maxNestingLevel = 1;
        const stream = new BinaryStream(Buffer.alloc(16));
        stream.enterNestingLevel();
        for (let i = 0; i < 5; i++) {
            should(() => stream.enterNestingLevel()).throw(BinaryStreamMaxNestingLevelExceededError);
        }
        stream.exitNestingLevel();
        // back to zero depth despite five refusals -> a full level is available again
        should(() => stream.enterNestingLevel()).not.throw();
    });
});
