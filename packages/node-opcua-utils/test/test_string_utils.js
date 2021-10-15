const { performance, PerformanceObserver } = require("perf_hooks");
const should = require("should");
const { countUpperCase, countUpperCaseSlow } = require("../dist/string_utils");
const utils = require("..");

describe("string_utils", function () {
    describe("capitalizeFirstLetter", function () {
        const capitalizeFirstLetter = utils.capitalizeFirstLetter;

        it("should capitalize a lowercased first letter", function () {
            capitalizeFirstLetter("foo").should.eql("Foo");
        });

        it("should keep a capitalized first letter capitalized", function () {
            capitalizeFirstLetter("Foo").should.eql("Foo");
        });

        it("should handle nulls", function () {
            should.equal(capitalizeFirstLetter(null), null);
        });
    });

    describe("lowerFirstLetter", function () {
        const lowerFirstLetter = utils.lowerFirstLetter;

        it("should lowercase a capitalized first letter", function () {
            lowerFirstLetter("Foo").should.eql("foo");
        });

        it("should keep a lower-cased first letter lower-cased", function () {
            lowerFirstLetter("foo").should.eql("foo");
        });

        it("should handle nulls", function () {
            should.equal(lowerFirstLetter(null), null);
        });

        const cases = [
            ["HelloWorld", "helloWorld"],
            ["XAxis", "xAxis"], //  2 Upper case followed by at least one lowercase
            ["EURange", "euRange"], //  3 Upper case followed by at least one lowercase
            ["DATE", "DATE"], // at least 2, all upper
            ["XYZ", "XYZ"], // at least 2, all upper
            ["AB", "AB"], // at least 2, all upper
            ["Ab", "ab"],
            ["A", "a"],
            ["T1ABC8", "T1ABC8"],
            ["F_ABC_D", "F_ABC_D"],
            ["ALM_Timeout", "ALM_timeout"],
            ["SV_GasOn", "SV_gasOn"],
            ["DI_VAL_FlowImpl", "DI_VAL_flowImpl"]
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

describe("benchmark", () => {
    it("countUpperCase should be faster than countUpperCaseSlow", () => {
        let start = process.hrtime();

        function elapsed_time(note) {
            let precision = 3; // 3 decimal places
            let elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
            console.log(process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
            start = process.hrtime(); // reset the timer
            return elapsed;
        }

        start = process.hrtime();
        for (let n = 0; n < 200000; n++) {
            countUpperCaseSlow("qkldjqsld lqskdjql skdjlqksd azoirjapzoeazpx oqskQPDKQSD¨QSDPQS¨D kLAEAZJ EL121232");
            countUpperCaseSlow("qkldjqsld");
            countUpperCaseSlow("qkldjqsld");
        }
        const d1 = elapsed_time("countUpperCaseSlow");
        for (let n = 0; n < 200000; n++) {
            countUpperCase("qkldjqsld lqskdjql skdjlqksd azoirjapzoeazpx oqskQPDKQSD¨QSDPQS¨D kLAEAZJ EL121232");
            countUpperCase("qkldjqsld");
            countUpperCase("qkldjqsld");
        }
        const d2 = elapsed_time("countUpperCase");

        d2.should.be.lessThan(d1);
    });
});
