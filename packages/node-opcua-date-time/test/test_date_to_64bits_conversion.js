"use strict";
var should = require("should");

var _ = require("underscore");
var BinaryStream = require("node-opcua-binary-stream").BinaryStream;

var date_time = require("..");
var ec = require("../src/encode_decode");

var offset_factor_1601 = date_time.offset_factor_1601;
var offset = offset_factor_1601[0];
var factor = offset_factor_1601[1];

function isValidUInt32(value) {
    if (!_.isFinite(value)) {
        return false;
    }
    return value >= 0 && value <= 0xFFFFFFFF;
}


// deprecated (inaccurate)
var assert = require("node-opcua-assert");
function deprecated_dateToHundredNanoSecondFrom1601(date) {

    assert(date instanceof Date);
    var t = date.getTime(); // number of milliseconds since 1/1/70
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

        var date = new Date(2014, 0, 1);
        var nano = deprecated_dateToHundredNanoSecondFrom1601(date);
        var date2 = deprecated_hundredNanoSecondFrom1601ToDate(nano);
        date2.toString().should.equal(date.toString());

    });
    it("dateToHundredNanoSecondFrom1601 should return 0 for 1st of January 1601", function () {

        var date = new Date(Date.UTC(1601, 0, 1, 0, 0));
        var nano = deprecated_dateToHundredNanoSecondFrom1601(date);
        nano.should.equal(0);
    });

    it("dateToHundredNanoSecondFrom1601 should return xx nanos for 2st of January 1601", function () {

        var date = new Date(Date.UTC(1601, 0, 2, 0, 0));
        var nano = deprecated_dateToHundredNanoSecondFrom1601(date);
        nano.should.equal(24 * 60 * 60 * 1000 * 10000);
        var date2 = deprecated_hundredNanoSecondFrom1601ToDate(nano);
        date2.toString().should.equal(date.toString());
    });

    it("hundredNanoSecondFrom1601ToDate and dateToHundredNanoSecondFrom1601 ", function () {

        var date = new Date(1789, 6, 14, 19, 47);
        var nano = deprecated_dateToHundredNanoSecondFrom1601(date);
        var date2 = deprecated_hundredNanoSecondFrom1601ToDate(nano);

        date2.toString().should.equal(date.toString());

    });
});


// reference:
// http://stackoverflow.com/questions/10849717/what-is-the-significance-of-january-1-1601

describe("check OPCUA Date conversion version 2", function () {

    it("should verify that Date.getTime returns the number of millisecond since January, 1st 1970 UTC", function () {

        var january = 1;
        var first_of_jan_1970_UTC = new Date(Date.UTC(1970, january - 1, 1, 0, 0, 0));

        //xx console.log("\n UTC Time  ",first_of_jan_1970_UTC.toUTCString());
        //xx console.log(" Local Time",first_of_jan_1970_UTC.toString());
        //xx console.log(" Iso Date",first_of_jan_1970_UTC.toISOString());

        first_of_jan_1970_UTC.getTime().should.eql(0);
        first_of_jan_1970_UTC.toUTCString().should.eql("Thu, 01 Jan 1970 00:00:00 GMT");

    });

    it("bn_dateToHundredNanoSecondFrom1601 should return n=(number of nanosecond in a single day) for January, 2nd 1601 00:00:00 UTC", function () {
        var date = new Date(Date.UTC(1601, 0, 2, 0, 0, 0));
        var nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);
        var value = 24 * 60 * 60 * 1000 * 10000; // number of nanosecond in a single day
        nano[0].should.equal(Math.floor(value / 0x100000000));
        nano[1].should.equal(value % 0x100000000);
    });

    it("should decode 0xd353c292 0x01cef70c DateTime as 2013-12-12T07:36:09.747Z", function () {

        var buf = new Buffer(8);
        buf.writeUInt32LE(0xd353c292, 0);
        buf.writeUInt32LE(0x01cef70c, 4);

        buf.readUInt8(0).should.equal(0x92);
        buf.readUInt8(1).should.equal(0xc2);
        buf.readUInt8(2).should.equal(0x53);
        buf.readUInt8(7).should.equal(0x01);

        var stream = new BinaryStream(buf);
        var date = ec.decodeDateTime(stream);
        //xx console.log("DDD = ",date.toUTCString(), " ms=", date.getMilliseconds());
        date.toISOString().should.eql("2013-12-12T07:36:09.747Z");
    });

    it("should handle 100 nanoseconds", function () {

        var date1 = new Date(Date.UTC(2013, 11, 12, 7, 36, 6));
        date1.toISOString().should.eql("2013-12-12T07:36:06.000Z");
        var t1 = date1.getTime();
        var q1 = date_time.bn_dateToHundredNanoSecondFrom1601(date1);

        // construct the same date with 713 millisecond more ...
        var date2 = new Date(Date.UTC(2013, 11, 12, 7, 36, 6));
        date2.setMilliseconds(713);
        date2.toISOString().should.eql("2013-12-12T07:36:06.713Z");
        var t2 = date2.getTime();
        var q2 = date_time.bn_dateToHundredNanoSecondFrom1601(date2);

        (t2 - t1).should.eql(713, " there must be a difference of 713 milliseconds");

        (q2[1] - q1[1]).should.eql(7130000, "there must be a difference of 7130000 nanseconds");

    });
    //
    //  =>
});


var BigNumber = require("bignumber.js");

function bn_dateToHundredNanoSecondFrom1601_big_number(date) {
    assert(date instanceof Date);
    var t = date.getTime(); // number of milliseconds since 1/1/70

    var bn_value = new BigNumber(t).plus(offset).times(factor);
    var high = bn_value.div(0x100000000).floor();
    var low = bn_value.mod(0x100000000);
    return [parseInt(high.toString(), 10), parseInt(low.toString(), 10)];
}

function bn_hundredNanoSecondFrom1601ToDate_big_number(high, low) {
    var offset = offset_factor_1601[0];
    var factor = offset_factor_1601[1];
    var value = new BigNumber(high).times(0x100000000).plus(low).div(factor).minus(offset);
    value = parseInt(value, 10);
    return new Date(value);
}


var Benchmarker = require("node-opcua-benchmarker").Benchmarker;

describe("Benchmarking Date conversion routines", function () {

    it("should check that slow and fast method produce same result", function () {

        var date = new Date(2014, 0, 1);
        var nano1 = bn_dateToHundredNanoSecondFrom1601_big_number(date);
        var nano2 = date_time.bn_dateToHundredNanoSecondFrom1601(date);
        nano1.should.eql(nano2);
    });

    it("should ensure that fast method (bn_dateToHundredNanoSecondFrom1601) is faster than slow method", function (done) {

        var bench = new Benchmarker();

        bench.add('bn_dateToHundredNanoSecondFrom1601_safe', function () {

            var date = new Date(2014, 0, 1);
            var nano = bn_dateToHundredNanoSecondFrom1601_big_number(date);

        })
            .add('bn_dateToHundredNanoSecondFrom1601_fast', function () {

                var date = new Date(2014, 0, 1);
                var nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);

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


        var date = new Date(2014, 0, 1);
        var nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);

        var bench = new Benchmarker();
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

        var dates_to_check = [
            new Date(1, 1, 1601),
            new Date(14, 7, 1789),
            new Date(14, 4, 1929),
            new Date(14, 4, 1968),
            new Date(14, 4, 1972),
            new Date(14, 4, 2172)
        ];
        var i;
        for (i = 0; i < 100; i++) {
            dates_to_check.push(ec.randomDateTime());
        }
        var date, check_date, check_date_bn;
        var bs = new BinaryStream();
        for (i = 0; i < dates_to_check.length; i++) {
            date = dates_to_check[i];
            var hl = date_time.bn_dateToHundredNanoSecondFrom1601(date);
            var hl_bn = bn_dateToHundredNanoSecondFrom1601_big_number(date);

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
        var date = new Date(Date.UTC(1601, 0, 1, 0, 0, 0));
        var nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);
        nano[0].should.equal(0);
        nano[1].should.equal(0);
    });

    it("bn_dateToHundredNanoSecondFrom1601 should return 0x019DB1DE-D53E8000 = 116444736000000000 for January, 1st 1970 00:00:00 UTC", function () {

        var date = new Date(Date.UTC(1970, 0, 1, 0, 0, 0));
        var nano = date_time.bn_dateToHundredNanoSecondFrom1601(date);
        var verif = bn_dateToHundredNanoSecondFrom1601_big_number(date);
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

        var date1 = new Date(Date.UTC(2010, 2, 25));
        var date2 = new Date(Date.UTC(2011, 2, 25));

        // number of millisecond , not adjusted
        var nms = 1000 * 60 * 60 * 24 * 365;

        var diff1 = date2.getTime() - date1.getTime();

        // according to http://en.wikipedia.org/wiki/Leap_second
        // a leap second should have been introduced on 2012, June the 30th,
        // causing this year to be (1000*60*60*24*365 + 1000) milliseconds long
        var date3 = new Date(Date.UTC(2012, 2, 25));
        var date4 = new Date(Date.UTC(2013, 2, 25));
        var diff2 = date4.getTime() - date3.getTime();
        (diff2 - nms).should.eql(0, "I though Javascript used a simplified version of UTC time , that ignore leap seconds");

    });
    it("should have a expected number of millisecond in a year span (without leap seconds)", function () {

        var n_leap = 366 * 24 * 60 * 60;
        var n_no_leap = 365 * 24 * 60 * 60;

        function inner_test(year) {

            var date1 = new Date(Date.UTC(year, 1, 25)); // year February 25th
            var date2 = new Date(Date.UTC(year + 1, 1, 25)); // year February 25th

            var n = ((year % 4 ) === 0) ? n_leap : n_no_leap;

            var d = (date2.getTime() - date1.getTime()) / 1000;
            (d - n).should.eql(0);
            // console.log("year = ", year, date1.toUTCString(), " => ",d,n,d -n);
        }

        for (var y = 1970; y < 2020; y++) {
            inner_test(y);
        }
    });
});
