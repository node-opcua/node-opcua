"use strict";
const should = require("should");

const _ = require("underscore");
const BinaryStream = require("node-opcua-binary-stream").BinaryStream;

const date_time = require("..");
const ec = require("../src/encode_decode");

const offset_factor_1601 = date_time.offset_factor_1601;
const offset = offset_factor_1601[0];
const factor = offset_factor_1601[1];

function isValidUInt32(value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= 0 && value <= 0xFFFFFFFF;
}


// deprecated (inaccurate)
const assert = require("node-opcua-assert").assert;
function deprecated_dateToHundredNanoSecondFrom1601(date) {

    assert(date instanceof Date);
    const t = date.getTime(); // number of milliseconds since 1/1/70
    assert(new Date(t).getTime() === t);

    return (t + offset) * factor;
}

// deprecated (inaccurate)
function deprecated_hundredNanoSecondFrom1601ToDate(value) {
    value = value / factor - offset;
    return new Date(value);
}


describe("check OPCUA Date conversion version 0", function () {

    it("should convert date in 2014 ", function () {

        const date = new Date(2014, 0, 1);
        const nano = deprecated_dateToHundredNanoSecondFrom1601(date);
        const date2 = deprecated_hundredNanoSecondFrom1601ToDate(nano);
        date2.toString().should.equal(date.toString());

    });
    it("dateToHundredNanoSecondFrom1601 should return 0 for 1st of January 1601", function () {

        const date = new Date(Date.UTC(1601, 0, 1, 0, 0));
        const nano = deprecated_dateToHundredNanoSecondFrom1601(date);
        nano.should.equal(0);
    });

    it("dateToHundredNanoSecondFrom1601 should return xx nanos for 2st of January 1601", function () {

        const date = new Date(Date.UTC(1601, 0, 2, 0, 0));
        const nano = deprecated_dateToHundredNanoSecondFrom1601(date);
        nano.should.equal(24 * 60 * 60 * 1000 * 10000);
        const date2 = deprecated_hundredNanoSecondFrom1601ToDate(nano);
        date2.toString().should.equal(date.toString());
    });

    it("hundredNanoSecondFrom1601ToDate and dateToHundredNanoSecondFrom1601 ", function () {

        const date = new Date(1789, 6, 14, 19, 47);
        const nano = deprecated_dateToHundredNanoSecondFrom1601(date);
        const date2 = deprecated_hundredNanoSecondFrom1601ToDate(nano);

        date2.toString().should.equal(date.toString());

    });
});


// reference:
// http://stackoverflow.com/questions/10849717/what-is-the-significance-of-january-1-1601

describe("check OPCUA Date conversion version 2", function () {

    it("should verify that Date.getTime returns the number of millisecond since January, 1st 1970 UTC", function () {

        const january = 1;
        const first_of_jan_1970_UTC = new Date(Date.UTC(1970, january - 1, 1, 0, 0, 0));

        //xx console.log("\n UTC Time  ",first_of_jan_1970_UTC.toUTCString());
        //xx console.log(" Local Time",first_of_jan_1970_UTC.toString());
        //xx console.log(" Iso Date",first_of_jan_1970_UTC.toISOString());

        first_of_jan_1970_UTC.getTime().should.eql(0);
        first_of_jan_1970_UTC.toUTCString().should.eql("Thu, 01 Jan 1970 00:00:00 GMT");

    });

    it("bn_dateToHundredNanoSecondFrom1601 should return n=(number of nanosecond in a single day) for January, 2nd 1601 00:00:00 UTC", function () {
        const date = new Date(Date.UTC(1601, 0, 2, 0, 0, 0));
        const nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);
        const value = 24 * 60 * 60 * 1000 * 10000; // number of nanosecond in a single day
        nano[0].should.equal(Math.floor(value / 0x100000000));
        nano[1].should.equal(value % 0x100000000);
    });

    it("should decode 0xd353c292 0x01cef70c DateTime as 2013-12-12T07:36:09.747Z", function () {

        const buf = new Buffer(8);
        buf.writeUInt32LE(0xd353c292, 0);
        buf.writeUInt32LE(0x01cef70c, 4);

        buf.readUInt8(0).should.equal(0x92);
        buf.readUInt8(1).should.equal(0xc2);
        buf.readUInt8(2).should.equal(0x53);
        buf.readUInt8(7).should.equal(0x01);

        const stream = new BinaryStream(buf);
        const date = ec.decodeDateTime(stream);
        //xx console.log("DDD = ",date.toUTCString(), " ms=", date.getMilliseconds());
        date.toISOString().should.eql("2013-12-12T07:36:09.747Z");
    });

    it("should handle 100 nanoseconds", function () {

        const date1 = new Date(Date.UTC(2013, 11, 12, 7, 36, 6));
        date1.toISOString().should.eql("2013-12-12T07:36:06.000Z");
        const t1 = date1.getTime();
        const q1 = date_time.bn_dateToHundredNanoSecondFrom1601(date1);

        // construct the same date with 713 millisecond more ...
        const date2 = new Date(Date.UTC(2013, 11, 12, 7, 36, 6));
        date2.setMilliseconds(713);
        date2.toISOString().should.eql("2013-12-12T07:36:06.713Z");
        const t2 = date2.getTime();
        const q2 = date_time.bn_dateToHundredNanoSecondFrom1601(date2);

        (t2 - t1).should.eql(713, " there must be a difference of 713 milliseconds");

        (q2[1] - q1[1]).should.eql(7130000, "there must be a difference of 7130000 nanseconds");

    });
    //
    //  =>
});


const BigNumber = require("bignumber.js");

function bn_dateToHundredNanoSecondFrom1601_big_number(date) {
    assert(date instanceof Date);
    const t = date.getTime(); // number of milliseconds since 1/1/70

    const bn_value = new BigNumber(t).plus(offset).times(factor);
    const high = bn_value.div(0x100000000);
    const low = bn_value.mod(0x100000000);
    return [parseInt(high.toString(), 10), parseInt(low.toString(), 10)];
}

function bn_hundredNanoSecondFrom1601ToDate_big_number(high, low) {
    const offset = offset_factor_1601[0];
    const factor = offset_factor_1601[1];
    let value = new BigNumber(high).times(0x100000000).plus(low).div(factor).minus(offset);
    value = parseInt(value, 10);
    return new Date(value);
}


const Benchmarker = require("node-opcua-benchmarker").Benchmarker;

describe("Benchmarking Date conversion routines", function () {

    it("should check that slow and fast method produce same result", function () {

        const date = new Date(2014, 0, 1);
        const nano1 = bn_dateToHundredNanoSecondFrom1601_big_number(date);
        const nano2 = date_time.bn_dateToHundredNanoSecondFrom1601(date);
        nano1.should.eql(nano2);
    });

    it("should ensure that fast method (bn_dateToHundredNanoSecondFrom1601) is faster than slow method", function (done) {

        const bench = new Benchmarker();

        bench.add('bn_dateToHundredNanoSecondFrom1601_safe', function () {

            const date = new Date(2014, 0, 1);
            const nano = bn_dateToHundredNanoSecondFrom1601_big_number(date);

        })
            .add('bn_dateToHundredNanoSecondFrom1601_fast', function () {

                const date = new Date(2014, 0, 1);
                const nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);

            })
            .on('cycle', function (message) {
                console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                this.fastest.name.should.eql("bn_dateToHundredNanoSecondFrom1601_fast");
                done();
            })
            .run();
    });

    it("should ensure that fast method (bn_hundredNanoSecondFrom1601ToDate) is faster than slow method", function (done) {


        const date = new Date(2014, 0, 1);
        const nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);

        const bench = new Benchmarker();
        bench.add('bn_hundredNanoSecondFrom1601ToDate_safe', function () {
            bn_hundredNanoSecondFrom1601ToDate_big_number(nano[0], nano[1]);

        })
            .add('bn_hundredNanoSecondFrom1601ToDate_fast', function () {
                date_time.bn_hundredNanoSecondFrom1601ToDate(nano[0], nano[1]);
            })
            .on('cycle', function (message) {
                console.log(message);
            })
            .on('complete', function () {

                console.log(' Fastest is ' + this.fastest.name);
                console.log(' Speed Up : x', this.speedUp);
                this.fastest.name.should.eql("bn_hundredNanoSecondFrom1601ToDate_fast");
                done();
            })
            .run();

    });

    it("should convert any random date", function () {

        const dates_to_check = [
            new Date(1, 1, 1601),
            new Date(14, 7, 1789),
            new Date(14, 4, 1929),
            new Date(14, 4, 1968),
            new Date(14, 4, 1972),
            new Date(14, 4, 2172)
        ];
        let i;
        for (i = 0; i < 100; i++) {
            dates_to_check.push(ec.randomDateTime());
        }
        let date, check_date, check_date_bn;
        const bs = new BinaryStream();
        for (i = 0; i < dates_to_check.length; i++) {
            date = dates_to_check[i];
            const hl = date_time.bn_dateToHundredNanoSecondFrom1601(date);
            const hl_bn = bn_dateToHundredNanoSecondFrom1601_big_number(date);

            check_date = date_time.bn_hundredNanoSecondFrom1601ToDate(hl[0], hl[1]);
            check_date_bn = bn_hundredNanoSecondFrom1601ToDate_big_number(hl[0], hl[1]);

            check_date.toString().should.eql(date.toString());

            isValidUInt32(hl[0]).should.eql(true);
            isValidUInt32(hl[1]).should.eql(true);
            ec.encodeDateTime(date, bs);
            bs.rewind();
        }
    });

    it("bn_dateToHundredNanoSecondFrom1601 should return 0 for January, 1st 1601 00:00:00 UTC", function () {
        const date = new Date(Date.UTC(1601, 0, 1, 0, 0, 0));
        const nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);
        nano[0].should.equal(0);
        nano[1].should.equal(0);
    });

    it("bn_dateToHundredNanoSecondFrom1601 should return 0x019DB1DE-D53E8000 = 116444736000000000 for January, 1st 1970 00:00:00 UTC", function () {

        const date = new Date(Date.UTC(1970, 0, 1, 0, 0, 0));
        const nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);
        const verif = bn_dateToHundredNanoSecondFrom1601_big_number(date);
        //xx console.log(date.toUTCString(), "0x0"+nano[0].toString(16),"0x"+nano[1].toString(16),nano,verif[0].toString(16),verif[1].toString(16));
        nano[0].should.equal(0x019DB1DE); // hi
        nano[1].should.equal(0xD53E8000); // lo

    });


});

describe("understanding Javascript date", function () {

    it("should check that javascript doesn't deal with leap seconds.", function () {

        // http://en.wikipedia.org/wiki/Leap_second
        // http://blog.synyx.de/2012/11/properly-calculating-time-differences-in-javascript/
        // https://news.ycombinator.com/item?id=4744595
        // http://www.csgnetwork.com/timetaidispcalc.html
        //
        // http://www.ucolick.org/~sla/leapsecs/epochtime.html

        // http://stackoverflow.com/questions/130573/does-the-windows-filetime-structure-include-leap-seconds
        // http://stackoverflow.com/a/1518159/406458

        // http://stackoverflow.com/questions/6161776/convert-windows-filetime-to-second-in-unix-linux

        // ** http://www.codeproject.com/Articles/144159/Time-Format-Conversion-Made-Easy

        // http://mcturra2000.wordpress.com/2012/05/05/for-linux-lovers-microsoft-file-time-utter-bilge/

        // http://en.wikipedia.org/wiki/Unix_time:
        // Unix time (a.k.a. POSIX time or Epoch time) is a system for describing instants in time, defined as the
        // number of seconds that have elapsed since 00:00:00 Coordinated Universal Time (UTC), Thursday, 1 January 1970,
        // not counting leap seconds.

        const date1 = new Date(Date.UTC(2010, 2, 25));
        const date2 = new Date(Date.UTC(2011, 2, 25));

        // number of millisecond , not adjusted
        const nms = 1000 * 60 * 60 * 24 * 365;

        const diff1 = date2.getTime() - date1.getTime();

        // according to http://en.wikipedia.org/wiki/Leap_second
        // a leap second should have been introduced on 2012, June the 30th,
        // causing this year to be (1000*60*60*24*365 + 1000) milliseconds long
        const date3 = new Date(Date.UTC(2012, 2, 25));
        const date4 = new Date(Date.UTC(2013, 2, 25));
        const diff2 = date4.getTime() - date3.getTime();
        (diff2 - nms).should.eql(0, "I though Javascript used a simplified version of UTC time , that ignore leap seconds");

    });
    it("should have a expected number of millisecond in a year span (without leap seconds)", function () {

        const n_leap = 366 * 24 * 60 * 60;
        const n_no_leap = 365 * 24 * 60 * 60;

        function inner_test(year) {

            const date1 = new Date(Date.UTC(year, 1, 25)); // year February 25th
            const date2 = new Date(Date.UTC(year + 1, 1, 25)); // year February 25th

            const n = ((year % 4 ) === 0) ? n_leap : n_no_leap;

            const d = (date2.getTime() - date1.getTime()) / 1000;
            (d - n).should.eql(0);
            // console.log("year = ", year, date1.toUTCString(), " => ",d,n,d -n);
        }

        for (let y = 1970; y < 2020; y++) {
            inner_test(y);
        }
    });
});
