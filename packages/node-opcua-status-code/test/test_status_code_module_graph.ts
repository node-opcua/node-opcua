import should from "should";

import { coerceStatusCode, getStatusCodeFromCode, StatusCode, StatusCodes } from "..";

/**
 * These pin the wiring that broke the import cycle between opcua_status_code.ts and the
 * generated table, rather than the status codes themselves (covered by
 * test_status_code.js).
 *
 * The generated table builds 280 ConstantStatusCode instances while its own module body
 * runs, using the classes declared in opcua_status_code.ts. That makes the dependency
 * one-directional, and nothing may point back. It used to point back: opcua_status_code
 * imported the table at the foot of the file and iterated it at module scope, which works
 * under CommonJS only because `require()` runs where it is written. Under ESM every import
 * hoists, so the table would evaluate before the classes it needs were initialised and
 * every one of those constructions would throw a TDZ ReferenceError.
 *
 * status_codes_registry.ts now owns that direction and injects what opcua_status_code
 * needs. What follows is what could silently regress if that injection is undone or
 * reordered.
 */
describe("status code module wiring", () => {
    it("SCW1 - resolves a known code to the identical instance, not a copy", () => {
        // callers compare status codes with ===, so identity is the contract
        should(getStatusCodeFromCode(0x80400000)).be.exactly(StatusCodes.BadNotImplemented);
    });

    it("SCW2 - falls back to StatusCodes.Bad itself for an unknown code", () => {
        // the fallback is injected; before the split it was read directly from the table
        should(getStatusCodeFromCode(0x81ff0000)).be.exactly(StatusCodes.Bad);
    });

    it("SCW3 - coerces every accepted shape", () => {
        should(coerceStatusCode(StatusCodes.BadInternalError)).be.exactly(StatusCodes.BadInternalError);
        should(coerceStatusCode(0x80400000)).be.exactly(StatusCodes.BadNotImplemented);
        should(coerceStatusCode("BadNotImplemented")).be.exactly(StatusCodes.BadNotImplemented);
        should(coerceStatusCode({ value: 0x80400000 })).be.exactly(StatusCodes.BadNotImplemented);
        should(() => coerceStatusCode("NoSuchStatusCode")).throw(/Cannot find StatusCode/);
    });

    it("SCW4 - keeps makeStatusCode attached to the generated table", () => {
        // monkey-patched on by the registry; it is part of the public surface
        should(StatusCode.makeStatusCode("BadNotImplemented", "SemanticChanged").value).equal(0x80404000);
    });

    it("SCW5 - the table's own static initializer ran during its evaluation", () => {
        // GoodWithOverflowBit is built by the generated module calling
        // StatusCode.makeStatusCode(StatusCodes.Good, ...) at static-init time, which is
        // before the registry has installed anything. makeStatusCode therefore has to
        // handle an already-coerced StatusCode without needing the table.
        should(StatusCodes.GoodWithOverflowBit.value).equal(0x480);
    });
});
