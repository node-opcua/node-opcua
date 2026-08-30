import { roundToFloat2 } from "..";

describe("roundToFloat2", () => {
    it("roundToFloat2", () => {
        roundToFloat2(0).should.eql(0);
        roundToFloat2(0.00000001).should.eql(1e-8);
        roundToFloat2(1.0000000001).should.eql(1);
        roundToFloat2(0.9999999999).should.eql(1);
        roundToFloat2(-0.9999999999).should.eql(-1);
    });
});
