"use strict";
const should = require("should");

const { Benchmarker } = require("node-opcua-benchmarker");
const { getCurrentClock } = require("..");


describe("Benchmarking javascript clock", function () {
    this.timeout(Math.max(40000, this.timeout()));
    it("should check which of  new Date() or process high is faster", function (done) {
        const bench = new Benchmarker();

        bench
            .add("newDate", function () {
                const a = Date.now();
            })
            .add("process.hrtime", function () {
                const b = process.hrtime();
            })
            .add("getCurrentClock", function () {
                const c = getCurrentClock();
            })
            .on("cycle", function (message) {
                console.log(message);
            })
            .on("complete", function () {
                console.log(" Fastest is " + this.fastest.name);
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

    it("Math.floor alternative", function (done) {
        const bench = new Benchmarker();

        const value = Math.random();
        bench
            .add("Math.floor", function () {
                let a = 0;
                for (let i = 0; i < 100000; i++) a += Math.floor(value);
            })
            .add("~~", function () {
                let a = 0;
                for (let i = 0; i < 100000; i++) a += ~~value;
            })
            .add(">>0", function () {
                let a = 0;
                for (let i = 0; i < 100000; i++) a += value >> 0;
            })
            .on("cycle", function (message) {
                console.log(message);
            })
            .on("complete", function () {
                console.log(" Fastest is " + this.fastest.name);
                console.log(" Speed Up : x", this.speedUp);
                done();
            })
            .run();
    });
});

describe("testing clock getCurrentClock", function () {
    it("should be strictly increasing", function () {
        const clockTicks = [];
        const N = 10000;
        for (let i = 0; i < N; i++) {
            const clock = getCurrentClock();
            clockTicks.push({
                timestamp: new Date(clock.timestamp.getTime()),
                picoseconds: clock.picoseconds,
                milliseconds: clock.milliseconds
                //xx tick: [clock.tick[0], clock.tick[1]]
            });
        }

        let cur = clockTicks[0];
        for (let i = 1; i < N; i++) {
            let next = clockTicks[i];

            next.timestamp.getTime().should.be.greaterThanOrEqual(cur.timestamp.getTime());

            if (next.timestamp.getTime() === cur.timestamp.getTime()) {
                if (next.picoseconds === 0 || next.picoseconds <= cur.picoseconds) {
                    console.log("PROBLEM ", i);
                    console.log("c      ", cur.timestamp.getTime(), cur.milliseconds, cur.picoseconds, cur.tick);
                    console.log("n      ", next.timestamp.getTime(), next.milliseconds, next.picoseconds, next.tick);

                    next.picoseconds.should.eql((next.tick[1] % 1000000) * 1000);
                    cur.picoseconds.should.eql((cur.tick[1] % 1000000) * 1000);
                    cur.timestamp.getTime().should.eql((cur.tick[1] / 1000000) >> 0);
                    next.timestamp.getTime().should.eql((next.tick[1] / 1000000) >> 0);

                    console.log(clockTicks);
                }
                next.picoseconds.should.be.greaterThan(0);
                next.picoseconds.should.be.greaterThanOrEqual(cur.picoseconds);
            }
            cur = next;
        }
    });
    it("should return a timestamp Date inline with new Date() ", function () {
        for (let i = 1; i < 10000; i++) {
            const d = new Date();
            const c = getCurrentClock();
            // let's allow for a 20 millisecond drift max
            (c.timestamp.getTime() + 20).should.be.greaterThanOrEqual(d.getTime());
        }
    });
});
