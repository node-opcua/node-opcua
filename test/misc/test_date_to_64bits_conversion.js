var should = require("should");
var ec = require("../../lib/misc/encode_decode");
var assert = require("assert");
var BinaryStream = require("../../lib/misc/binaryStream").BinaryStream;
var offset_factor_1601 = ec.offset_factor_1601;
var offset = offset_factor_1601[0];
var factor = offset_factor_1601[1];

// deprecated (inaccurate)
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




describe("check OPCUA Date conversion version 2", function () {

    it("should verify that Date.getTime returns the number of millisecond since January, 1st 1970 UTC",function(){

        var january = 1;
        var first_of_jan_1970_UTC = new Date(Date.UTC(1970, january-1, 1, 0, 0, 0));
        console.log("\n UTC Time  ",first_of_jan_1970_UTC.toUTCString());
        console.log(" Local Time",first_of_jan_1970_UTC.toString());

        first_of_jan_1970_UTC.getTime().should.eql(0);
        first_of_jan_1970_UTC.toUTCString().should.eql("Thu, 01 Jan 1970 00:00:00 GMT");

    });

    it("bn_dateToHundredNanoSecondFrom1601 should return n=(number of nanosecond in a single day) for January, 2nd 1601 00:00:00 UTC", function () {

        var date = new Date(Date.UTC(1601, 0, 2, 0, 0, 0 ));
        var nano = ec.bn_dateToHundredNanoSecondFrom1601(date);
        var value = 24 * 60 * 60 * 1000 * 10000; // number of nanosecond in a single day
        nano[0].should.equal(Math.floor(value / 0xFFFFFFFF));
        nano[1].should.equal(value % 0xFFFFFFFF);
    });

    it("bn_dateToHundredNanoSecondFrom1601 should return 0 for January, 1st 1601 00:00:00 UTC", function () {

        var date = new Date(Date.UTC(1601, 0, 1, 0, 0, 0));
        var nano = ec.bn_dateToHundredNanoSecondFrom1601(date);
        nano[0].should.equal(0);
        nano[1].should.equal(0);
    });

    it("should decode 92c253d3 0cf7ce01 DateTime as  Dec 12, 2013 08:36:09.747317000(GMT+1) or 2013-12-12T07:36:06.713Z", function () {

        var buf = new Buffer(8);
        buf.writeUInt32BE(0x92c253d3, 0);
        buf.writeUInt32BE(0x0cf7ce01, 4);
        buf.readUInt8(0).should.equal(0x92);
        buf.readUInt8(1).should.equal(0xc2);
        buf.readUInt8(2).should.equal(0x53);
        buf.readUInt8(7).should.equal(0x01);

        var stream = new BinaryStream(buf);
        var date = ec.decodeDateTime(stream);

        console.log(date.toISOString());

        stream.rewind();
        ec.encodeDateTime(new Date(2013, 11, 12, 9, 36, 9), stream);



    });
    //
    //  =>
});




var BigNumber = require('bignumber.js');

function bn_dateToHundredNanoSecondFrom1601_big_number(date) {
    assert(date instanceof Date);
    var t = date.getTime(); // number of milliseconds since 1/1/70

    var bn_value = new BigNumber(t).plus(offset).times(factor);
    var high = bn_value.div(0xFFFFFFFF).floor();
    var low = bn_value.mod(0xFFFFFFFF);
    return [ parseInt(high.toS(), 10), parseInt(low.toS(), 10)];
}

function bn_hundredNanoSecondFrom1601ToDate_big_number(high, low) {
    var offset = offset_factor_1601[0];
    var factor = offset_factor_1601[1];
    var value = new BigNumber(high).times(0xFFFFFFFF).plus(low).div(factor).minus(offset);
    value = parseInt(value, 10);
    return new Date(value);
}


var Benchmarker = require("../helpers/benchmarker").Benchmarker;

describe("Benchmarking Date conversion routines",function(){

    it("should check that slow and fast method produce same result",function() {

        var date = new Date(2014, 0, 1);
        var nano1 = bn_dateToHundredNanoSecondFrom1601_big_number(date);
        var nano2 = ec.bn_dateToHundredNanoSecondFrom1601(date);
        nano1.should.eql(nano2);
    });

    it("should ensure that fast method (bn_dateToHundredNanoSecondFrom1601) is faster than slow method",function(done) {

        var bench = new Benchmarker();

        bench.add('bn_dateToHundredNanoSecondFrom1601_safe', function() {

            var date = new Date(2014, 0, 1);
            var nano = bn_dateToHundredNanoSecondFrom1601_big_number(date);

        })
        .add('bn_dateToHundredNanoSecondFrom1601_fast', function() {

            var date = new Date(2014, 0, 1);
            var nano = ec.bn_dateToHundredNanoSecondFrom1601(date);

        })
        .on('cycle', function(message) {
            console.log(message);
        })
        .on('complete', function() {

            console.log(' Fastest is ' + this.fastest.name);
            console.log(' Speed Up : x', this.speedUp);
            this.fastest.name.should.eql("bn_dateToHundredNanoSecondFrom1601_fast");
            done();
        })
        .run();
    });

    it("should ensure that fast method (bn_hundredNanoSecondFrom1601ToDate) is faster than slow method",function(done) {


        var date = new Date(2014, 0, 1);
        var nano = ec.bn_dateToHundredNanoSecondFrom1601(date);

        var bench = new Benchmarker();
        bench.add('bn_hundredNanoSecondFrom1601ToDate_safe', function() {
            bn_hundredNanoSecondFrom1601ToDate_big_number(nano[0],nano[1]);

        })
        .add('bn_hundredNanoSecondFrom1601ToDate_fast', function() {
            ec.bn_hundredNanoSecondFrom1601ToDate(nano[0],nano[1]);
        })
        .on('cycle', function(message) {
            console.log(message);
        })
        .on('complete', function() {

            console.log(' Fastest is ' + this.fastest.name);
            console.log(' Speed Up : x', this.speedUp);
            this.fastest.name.should.eql("bn_hundredNanoSecondFrom1601ToDate_fast");
            done();
        })
        .run();

    });

    it("should convert any random date",function(){


        var dates_to_check =[
            new Date(1,1,1601),
            new Date(14,7,1789),
            new Date(14,4,1929),
            new Date(14,4,1968),
            new Date(14,4,1972),
            new Date(14,4,2172)
        ];
        for(var i=0;i<100;i++) {
            dates_to_check.push(ec.randomDateTime());
        }
        var date,check_date;
        var bs = new BinaryStream();
        for(var i=0;i<dates_to_check.length;i++) {
            date = dates_to_check[i];
            var hl  = ec.bn_dateToHundredNanoSecondFrom1601(date);
            var hl_bn = bn_dateToHundredNanoSecondFrom1601_big_number(date);

            check_date    = ec.bn_hundredNanoSecondFrom1601ToDate(hl[0],hl[1]);
            check_date_bn = bn_hundredNanoSecondFrom1601ToDate_big_number(hl[0],hl[1]);

            check_date.should.eql(date);

            ec.isValidUInt32(hl[0]).should.eql(true);
            ec.isValidUInt32(hl[1]).should.eql(true);
            ec.encodeDateTime(date,bs);
            bs.rewind();
        }
    });

});