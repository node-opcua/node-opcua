
import { fieldsToJson } from "..";
import "should";

describe("testing fieldsToJson ", ()=>{

    it("fieldsToJson should be immune from prototype pollution attack", ()=>{
    
        var someObj = {}
        console.log("Before Attack: ", JSON.stringify(({} as any).__proto__));
        try {
            fieldsToJson(["__proto__.pollutedKey"], ["pollutedValue"] as any)
        } catch (e) { }

        var evidence = JSON.stringify(({} as any).__proto__);
        console.log("After Attack: ", evidence);
        delete (Object.prototype as any).pollutedKey;

        evidence.should.equal("{}");
    });

});
