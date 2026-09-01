import "should";
import { makeOptionalsMap } from "../dist/api/index.js";

const j = <T>(o: T) => JSON.parse(JSON.stringify(o));
describe("Testing makeOptionalsMap", () => {
    it("should create an optional map from a single string", () => {
        const map = makeOptionalsMap(["Hello"]);
        j(map).should.eql({ Hello: {} });
    });
    it("should create an optional map from a single string", () => {
        const map = makeOptionalsMap(["Hello.World", "Hello.Goodbye"]);
        j(map).should.eql({ Hello: { World: {}, Goodbye: {} } });
    });
    it("should not polute prototype", () => {
        var _someObj = {};
        console.log("Before Attack: ", JSON.stringify(Object.getPrototypeOf({})));
        try {
            makeOptionalsMap(["__proto__.pollutedKey", "pollutedValue"]);
        } catch (_e) {}

        var evidence = JSON.stringify(Object.getPrototypeOf({}));
        console.log("After Attack: ", evidence);
        delete (Object.prototype as unknown as Record<string, unknown>).pollutedKey;

        evidence.should.equal("{}");
    });
});
