import * as should from "should";
// tslint:disable:no-string-literal
import { makeOptionalsMap } from "..";

describe("Testing makeOptionalsMap", () => {
    it("should create an optional map from a single string", () => {
        const map = makeOptionalsMap(["Hello"]);
        map.should.ownProperty("Hello");
    });
    it("should create an optional map from a single string", () => {
        const map = makeOptionalsMap(["Hello.World", "Hello.Goodbye"]);
        map.should.ownProperty("Hello");
        map["Hello"].should.ownProperty("World");
        map["Hello"].should.ownProperty("Goodbye");
    });
});
