const utils = require("..");
const should = require("should");

describe("string_utils", function() {

    describe("capitalizeFirstLetter", function() {
        const capitalizeFirstLetter = utils.capitalizeFirstLetter;

        it("should capitalize a lowercased first letter", function() {
            capitalizeFirstLetter("foo").should.eql("Foo");
        });

        it("should keep a capitalized first letter capitalized", function() {
            capitalizeFirstLetter("Foo").should.eql("Foo");
        });

        it("should handle nulls", function() {
            should.equal(capitalizeFirstLetter(null), null);
        });
    });

    describe("lowerFirstLetter", function() {
        const lowerFirstLetter = utils.lowerFirstLetter;

        it("should lowercase a capitalized first letter", function() {
            lowerFirstLetter("Foo").should.eql("foo");
        });

        it("should keep a lowercased first letter lowercased", function() {
            lowerFirstLetter("foo").should.eql("foo");
        });

        it("should handle nulls", function() {
            should.equal(lowerFirstLetter(null), null);
        });

        const cases = [
            ["HelloWorld", "helloWorld"],
            ["XAxis", "xAxis"], //  2 Upper case followed by at least one lowercase
            ["EURange", "euRange"],//  3 Upper case followed by at least one lowercase
            ["DATE", "DATE"],  // at least 2, all upper
            ["XYZ", "XYZ"],  // at least 2, all upper
            ["AB", "AB"], // at least 2, all upper
            ["Ab", "ab"],
            ["A", "a"],
            ["T1ABC8", "T1ABC8"],
            ["F_ABC_D", "F_ABC_D"],
            ["ALM_Timeout", "ALM_timeout"],
            ["SV_GasOn", "SV_gasOn"],
            ["DI_VAL_FlowImpl", "DI_VAL_flowImpl"],
        ];
        for (const c of cases) {
            const a = c;
            it("should lowerFirstLetter " + a[0] + " -> " + a[1], () => {
                lowerFirstLetter(a[0]).should.eql(a[1]);
            });

        }
        it("should lowerFirstLetter XRange->xRange", () => {
            lowerFirstLetter("XRange").should.eql("xRange");
        });

    });

});
