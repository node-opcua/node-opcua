import type { Variant } from "node-opcua-variant";
import { fieldsToJson } from "..";
import "should";

describe("testing fieldsToJson ", () => {
    it("fieldsToJson should be immune from prototype pollution attack", () => {
        // biome-ignore lint/suspicious/noProto: deliberately probing __proto__ to verify the CVE-style attack below was neutralized
        console.log("Before Attack: ", JSON.stringify(({} as Record<string, unknown>).__proto__));
        try {
            // deliberately malformed eventFields to simulate an attacker-controlled payload
            fieldsToJson(["__proto__.pollutedKey"], ["pollutedValue"] as unknown as Variant[]);
        } catch (_e) {}

        // biome-ignore lint/suspicious/noProto: deliberately probing __proto__ to verify the CVE-style attack above was neutralized
        var evidence = JSON.stringify(({} as Record<string, unknown>).__proto__);
        console.log("After Attack: ", evidence);
        // biome-ignore lint/suspicious/noExplicitAny: cleaning up a possibly-polluted Object.prototype requires an untyped escape hatch
        delete (Object.prototype as any).pollutedKey;

        evidence.should.equal("{}");
    });
});
