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

/**
 * True when the process runs under istanbul/nyc instrumentation.
 *
 * `__coverage__` is a *global* injected into instrumented code (not an env var), and nyc exports
 * NYC_CONFIG / NYC_PROCESS_ID / NYC_CWD — the previous check looked for `process.env.__coverage__`
 * and a non-existent `nyc_output_dir`, so it never fired and the benchmark below ran instrumented,
 * where the counter calls inserted into the tight loop dominate the measurement.
 */
function isInstrumented() {
    return (
        typeof global.__coverage__ !== "undefined" ||
        !!process.env.NYC_CONFIG ||
        !!process.env.NYC_PROCESS_ID ||
        !!process.env.NYC_CWD
    );
}

describe("benchmark", () => {
    it("countUpperCase should be faster than countUpperCaseSlow", function () {
        // A wall-clock comparison is meaningless under instrumentation: istanbul adds a counter
        // increment per branch, which penalises the two implementations by different factors and has
        // been observed to invert the result entirely (965ms vs 175ms).
        if (isInstrumented()) {
            this.skip();
        }

        const LONG = "qkldjqsld lqskdjql skdjlqksd azoirjapzoeazpx oqskQPDKQSD¨QSDPQS¨D kLAEAZJ EL121232";
        const SHORT = "qkldjqsld";
        const ITERATIONS = 200000;

        // elapsed milliseconds — hrtime() returns [seconds, nanoseconds] and the seconds field must be
        // folded in: the previous version used only [1], so any run longer than 1s was reported modulo
        // 1000ms, which on a slow machine silently corrupted the comparison.
        function measure(fn) {
            const t0 = process.hrtime.bigint();
            for (let n = 0; n < ITERATIONS; n++) {
                fn(LONG);
                fn(SHORT);
                fn(SHORT);
            }
            return Number(process.hrtime.bigint() - t0) / 1e6;
        }

        // Warm up so neither function pays for JIT tiering in the measured run, then take the best of
        // three passes each: a scheduler hiccup or a GC pause can only make a sample slower, so the
        // minimum is far more stable than a single shot on a loaded CI machine.
        measure(countUpperCaseSlow);
        measure(countUpperCase);

        let d1 = Infinity;
        let d2 = Infinity;
        for (let pass = 0; pass < 3; pass++) {
            d1 = Math.min(d1, measure(countUpperCaseSlow));
            d2 = Math.min(d2, measure(countUpperCase));
        }
        console.log(`countUpperCaseSlow: ${d1.toFixed(3)} ms, countUpperCase: ${d2.toFixed(3)} ms`);

        
        // should not be more than 50% slower than the optimized version
        d2.should.be.lessThan(d1 * 1.5);

    });
});
