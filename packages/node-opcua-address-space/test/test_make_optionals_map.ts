import "should";
import { makeOptionalsMap } from "..";

const j = (o: any) => JSON.parse(JSON.stringify(o));
describe("Testing makeOptionalsMap", () => {
    it("should create an optional map from a single string", () => {
        const map = makeOptionalsMap(["Hello"]);
        j(map).should.eql({"Hello":{}});
    });
    it("should create an optional map from a single string", () => {
        const map = makeOptionalsMap(["Hello.World", "Hello.Goodbye"]);
       j(map).should.eql({ Hello: { World: {}, Goodbye: {} } });
    });
    it("should not polute prototype", ()=>{

        var someObj = {}
        console.log("Before Attack: ", JSON.stringify(({} as any).__proto__));
        try {
            makeOptionalsMap(["__proto__.pollutedKey","pollutedValue"] as any)
        } catch (e) { }

        var evidence = JSON.stringify(({} as any).__proto__);
        console.log("After Attack: ", evidence);
        delete (Object.prototype as any).pollutedKey;

        evidence.should.equal("{}");
    });
});
