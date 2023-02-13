
import "should";
import { checkValueRankCompatibility } from "../src/check_value_rank_compatibility";

const ScalarOrOneDimension = -3;
const OneOrMoreDimensions = 0;
const AnyDimension = -2;
const OneDimension = 1;
const Scalar = -1;
const InvalidValueRank = -99;
describe("test value rank compatibility", () => {

    describe("when base valueRank is ScalarOrOneDimension", () => {
        const referencedValueRank = ScalarOrOneDimension;

        it("invalid valueRank", () => {
            const { result, errorMessage } = checkValueRankCompatibility(InvalidValueRank, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: InvalidValueRank(-99)  can only be ScalarOrOneDimension(-3) AnyDimension(-2), Scalar(-1) OneOrMoreDimensions(0) or a positive number");
        });

        it("Scalar", () => {
            checkValueRankCompatibility(Scalar, referencedValueRank).result.should.equal(true);
        });
        it("OneDimension", () => {
            checkValueRankCompatibility(OneDimension, referencedValueRank).result.should.equal(true);
        });
        it("AnyDimension", () => {
            const { result, errorMessage } = checkValueRankCompatibility(AnyDimension, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: AnyDimension(-2): valueRank can only be identical to base type ScalarOrOneDimension(-3) , Scalar(-1) or OneDimension(1).");
        });
        it("OneOrMoreDimensions", () => {
            const { result, errorMessage } = checkValueRankCompatibility(OneOrMoreDimensions, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: OneOrMoreDimensions(0): valueRank can only be identical to base type ScalarOrOneDimension(-3) , Scalar(-1) or OneDimension(1).");
        });
        it("2 ", () => {
            const { result, errorMessage } = checkValueRankCompatibility(2, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: 2: valueRank can only be identical to base type ScalarOrOneDimension(-3) , Scalar(-1) or OneDimension(1).");
        });
    });
    describe("when base valueRank is OneOrMoreDimensions", () => {

        const referencedValueRank = OneOrMoreDimensions;
        it("invalid valueRank", () => {
            const { result, errorMessage } = checkValueRankCompatibility(InvalidValueRank, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: InvalidValueRank(-99)  can only be ScalarOrOneDimension(-3) AnyDimension(-2), Scalar(-1) OneOrMoreDimensions(0) or a positive number");
        });

        it("Scalar", () => {
            const { result, errorMessage } = checkValueRankCompatibility(Scalar, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: Scalar(-1): valueRank can only be identical to base type OneOrMoreDimensions(0) or be a positive number");
        });
        it("OneDimension", () => {
            checkValueRankCompatibility(OneDimension, referencedValueRank).result.should.equal(true);
        });
        it("AnyDimension", () => {
            const { result, errorMessage } = checkValueRankCompatibility(AnyDimension, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: AnyDimension(-2): valueRank can only be identical to base type OneOrMoreDimensions(0) or be a positive number");
        });
        it("OneOrMoreDimensions", () => {
            const { result, errorMessage } = checkValueRankCompatibility(OneOrMoreDimensions, referencedValueRank);
            result.should.equal(true);
        });
        it("2 ", () => {
            const { result, errorMessage } = checkValueRankCompatibility(2, referencedValueRank);
            result.should.equal(true);
        });
    });
    describe("when base valueRank is AnyDimension", () => {
        const referencedValueRank = AnyDimension;

        it("invalid valueRank", () => {
            const { result, errorMessage } = checkValueRankCompatibility(InvalidValueRank, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: InvalidValueRank(-99)  can only be ScalarOrOneDimension(-3) AnyDimension(-2), Scalar(-1) OneOrMoreDimensions(0) or a positive number");
        });
        it("ScalarOrOneDimension", () => {
            const { result, errorMessage } = checkValueRankCompatibility(ScalarOrOneDimension, referencedValueRank);
            result.should.equal(true);
        });
        it("Scalar", () => {
            const { result, errorMessage } = checkValueRankCompatibility(Scalar, referencedValueRank);
            result.should.equal(true);
        });
        it("OneDimension", () => {
            checkValueRankCompatibility(OneDimension, referencedValueRank).result.should.equal(true);
        });
        it("AnyDimension", () => {
            const { result, errorMessage } = checkValueRankCompatibility(AnyDimension, referencedValueRank);
            result.should.equal(true);
        });
        it("OneOrMoreDimensions", () => {
            const { result, errorMessage } = checkValueRankCompatibility(OneOrMoreDimensions, referencedValueRank);
            result.should.equal(true);
        });
        it("2 ", () => {
            const { result, errorMessage } = checkValueRankCompatibility(2, referencedValueRank);
            result.should.equal(true);
        });


    });

    describe("when base valueRank OneDimension", () => {
        const referencedValueRank = OneDimension;
        it("invalid valueRank", () => {
            const { result, errorMessage } = checkValueRankCompatibility(InvalidValueRank, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: InvalidValueRank(-99)  can only be ScalarOrOneDimension(-3) AnyDimension(-2), Scalar(-1) OneOrMoreDimensions(0) or a positive number");
        });
        it("ScalarOrOneDimension", () => {
            const { result, errorMessage } = checkValueRankCompatibility(ScalarOrOneDimension, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: ScalarOrOneDimension(-3):  valueRank can only be identical to base type OneDimension(1)");
        });
        it("Scalar", () => {
            const { result, errorMessage } = checkValueRankCompatibility(Scalar, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: Scalar(-1):  valueRank can only be identical to base type OneDimension(1)");
        });
        it("OneDimension", () => {
            checkValueRankCompatibility(OneDimension, referencedValueRank).result.should.equal(true);
        });
        it("AnyDimension", () => {
            const { result, errorMessage } = checkValueRankCompatibility(AnyDimension, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: AnyDimension(-2):  valueRank can only be identical to base type OneDimension(1)");
        });
        it("OneOrMoreDimensions", () => {
            const { result, errorMessage } = checkValueRankCompatibility(OneOrMoreDimensions, referencedValueRank);
            errorMessage!.should.equal("Invalid valueRank: OneOrMoreDimensions(0):  valueRank can only be identical to base type OneDimension(1)");
            result.should.equal(false);
        });
        it("2 ", () => {
            const { result, errorMessage } = checkValueRankCompatibility(2, referencedValueRank);
            errorMessage!.should.equal("Invalid valueRank: 2:  valueRank can only be identical to base type OneDimension(1)");
            result.should.equal(false);
        });
    })

    describe("when base valueRank Scalar", () => {
        const referencedValueRank = Scalar;
        it("invalid valueRank", () => {
            const { result, errorMessage } = checkValueRankCompatibility(InvalidValueRank, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: InvalidValueRank(-99)  can only be ScalarOrOneDimension(-3) AnyDimension(-2), Scalar(-1) OneOrMoreDimensions(0) or a positive number");
        });
        it("ScalarOrOneDimension", () => {
            const { result, errorMessage } = checkValueRankCompatibility(ScalarOrOneDimension, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: ScalarOrOneDimension(-3): valueRank can only be identical to base type Scalar(-1)");
        });
        it("Scalar", () => {
            const { result, errorMessage } = checkValueRankCompatibility(Scalar, referencedValueRank);
            result.should.equal(true);
        });
        it("OneDimension", () => {
            const { result, errorMessage } = checkValueRankCompatibility(OneDimension, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: OneDimension(1): valueRank can only be identical to base type Scalar(-1)");
        });
        it("AnyDimension", () => {
            const { result, errorMessage } = checkValueRankCompatibility(AnyDimension, referencedValueRank);
            result.should.equal(false);
            errorMessage!.should.equal("Invalid valueRank: AnyDimension(-2): valueRank can only be identical to base type Scalar(-1)");
        });
        it("OneOrMoreDimensions", () => {
            const { result, errorMessage } = checkValueRankCompatibility(OneOrMoreDimensions, referencedValueRank);
            errorMessage!.should.equal("Invalid valueRank: OneOrMoreDimensions(0): valueRank can only be identical to base type Scalar(-1)");
            result.should.equal(false);
        });
        it("2 ", () => {
            const { result, errorMessage } = checkValueRankCompatibility(2, referencedValueRank);
            errorMessage!.should.equal("Invalid valueRank: 2: valueRank can only be identical to base type Scalar(-1)");
            result.should.equal(false);
        });
    })

});
