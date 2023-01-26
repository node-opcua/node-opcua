import * as should from "should";
import { verifyRankAndDimensions } from "..";
describe("verifyRankAndDimensions", () => {
    [
        { arrayDimensions: "string", valueRank: 1 },
        { arrayDimensions: [2, 2], valueRank: 3 },
        { arrayDimensions: [2, 2], valueRank: "2" },
        { arrayDimensions: [2, 2], valueRank: 0 },
        { arrayDimensions: [2, 2], valueRank: -1 },
        { arrayDimensions: [2, 3, 4], valueRank: 0 },
    ].forEach((params, index) =>
        it("TH-" + index + " should throw " + JSON.stringify(params), () => {
            should.throws(() => {
                verifyRankAndDimensions(params as any);
            });
        })
    );
    [
        {},
        { arrayDimensions: [], valueRank: -1 },
        { arrayDimensions: [2, 2], valueRank: 2 },
        { valueRank: -1 },
        { arrayDimensions: [2, 2], valueRank: undefined },
        { arrayDimensions: []},
        // auto repair: 
        { arrayDimensions: undefined, valueRank: 2 },
        { arrayDimensions: null, valueRank: 2 }
    ].forEach((params, index) =>
        it("NTH-" + index + "should NOT throw " + JSON.stringify(params), () => {
            verifyRankAndDimensions(params as any);
        })
    );
});
