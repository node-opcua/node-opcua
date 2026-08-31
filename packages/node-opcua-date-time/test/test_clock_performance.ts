import "should";

import { Benchmarker } from "node-opcua-benchmarker";
import { getCurrentClock } from "../dist/index.js";

describe("Benchmarking javascript clock", function (this: Mocha.Suite) {
    this.timeout(Math.max(40000, this.timeout()));
    it("should check which of  new Date() or process high is faster", (done) => {
        const bench = new Benchmarker();

        bench
            .add("newDate", function (this: Mocha.Context) {
                const _a = Date.now();
            })
            .add("process.hrtime", function (this: Mocha.Context) {
                const _b = process.hrtime();
            })
            .add("getCurrentClock", function (this: Mocha.Context) {
                const _c = getCurrentClock();
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: Mocha.Context) {
                console.log(` Fastest is ${this.fastest.name}`);
                console.log(" Speed Up : x", this.speedUp);
                //
                // note : we cannot make any assumption here
                //        on travis for instance process.hrtime could be slower than new Date()
                //        on windows bare bone this could be the opposite
                //
                // this.fastest.name.should.eql("process.hrtime");
                done();
            })
            .run();
    });

    it("Math.floor alternative", (done) => {
        const bench = new Benchmarker();

        const value = Math.random();
        bench
            .add("Math.floor", function (this: Mocha.Context) {
                let _a = 0;
                for (let i = 0; i < 100000; i++) _a += Math.floor(value);
            })
            .add("~~", function (this: Mocha.Context) {
                let _a = 0;
                for (let i = 0; i < 100000; i++) _a += ~~value;
            })
            .add(">>0", function (this: Mocha.Context) {
                let _a = 0;
                for (let i = 0; i < 100000; i++) _a += value >> 0;
            })
            .on("cycle", (message) => {
                console.log(message);
            })
            .on("complete", function (this: Mocha.Context) {
                console.log(` Fastest is ${this.fastest.name}`);
                console.log(" Speed Up : x", this.speedUp);
                done();
            })
            .run();
    });
});

describe("testing clock getCurrentClock", function (this: Mocha.Suite) {
    it("should be strictly increasing", function (this: Mocha.Context) {
        const clockTicks = [];
        const N = 10000;
        for (let i = 0; i < N; i++) {
            const clock = getCurrentClock();
            clockTicks.push({
                timestamp: new Date(clock.timestamp.getTime()),
                picoseconds: clock.picoseconds
            });
        }

        let cur = clockTicks[0];
        for (let i = 1; i < N; i++) {
            const next = clockTicks[i];

            next.timestamp.getTime().should.be.greaterThanOrEqual(cur.timestamp.getTime());

            if (next.timestamp.getTime() === cur.timestamp.getTime()) {
                if (next.picoseconds === 0 || next.picoseconds <= cur.picoseconds) {
                    console.log("PROBLEM ", i);
                    console.log("c      ", cur.timestamp.getTime(), cur.picoseconds);
                    console.log("n      ", next.timestamp.getTime(), next.picoseconds);
                    console.log(clockTicks);
                }
                next.picoseconds.should.be.greaterThan(0);
                next.picoseconds.should.be.greaterThanOrEqual(cur.picoseconds);
            }
            cur = next;
        }
    });
    it("should return a timestamp Date inline with new Date() ", function (this: Mocha.Context) {
        for (let i = 1; i < 10000; i++) {
            const d = new Date();
            const c = getCurrentClock();
            // let's allow for a 100 millisecond drift max
            // (this could happen in some containerize environment)
            (c.timestamp.getTime() + 100).should.be.greaterThanOrEqual(d.getTime());
        }
    });
});
