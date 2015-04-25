/*global describe,require,it */
require("requirish")._(module);
var should = require("should");

var NumericRange = require("lib/datamodel/numeric_range").NumericRange;
var NumericRangeType = NumericRange.NumericRangeType;


var factories = require("lib/misc/factories");


var ObjWithNumericRange_Schema = {

    id: factories.next_available_id(),
    name: "ObjWithNumericRange",
    fields: [
        { name: "title", fieldType: "UAString" },
        {
            name: "numericRange",
            fieldType: "NumericRange"
        }
    ]
};
exports.ObjWithNumericRange_Schema = ObjWithNumericRange_Schema;


describe("Testing numerical range", function () {

    it("should construct an empty NumericRange", function () {
        var nr = new NumericRange();
        nr.type.should.eql(NumericRangeType.Empty);
        should(nr.toEncodeableString()).eql(null);
    });

    it("should construct a NumericRange from a integer", function () {
        var nr = new NumericRange(12);
        nr.type.should.eql(NumericRangeType.SingleValue);
        nr.toString().should.eql("12");

    });
    it("should construct a NumericRange from a integer", function () {
        var nr = new NumericRange("-12");
        nr.type.should.eql(NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should construct a NumericRange with low and high bound", function () {
        var nr = new NumericRange(12, 15);
        nr.type.should.eql(NumericRangeType.ArrayRange);
        nr.toString().should.eql("12:15");

    });

    it("should  be an InvalidRange if low bound is greater than high bound", function () {
        var nr = new NumericRange([15, 12]);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange if bound === high bound", function () {
        var nr = new NumericRange(15, 15);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should throw an exception if high bound is crap", function () {
        should(function () {
            new NumericRange(15, "crappy stuff");
        }).throwError();
    });

    it("should construct a NumericRange with a array containing low and high bound", function () {
        var nr = new NumericRange([12, 15]);
        nr.type.should.eql(NumericRangeType.ArrayRange);
        nr.toString().should.eql("12:15");
    });

    it("should construct a NumericRange from a string containing an integer", function () {
        var nr = new NumericRange("12");
        nr.type.should.eql(NumericRangeType.SingleValue);
        nr.toString().should.eql("12");
    });

    it("should construct a NumericRange from a string containing a simple range", function () {
        var nr = new NumericRange("12:15");
        nr.type.should.eql(NumericRangeType.ArrayRange);
        nr.toString().should.eql("12:15");
    });

    it("should be an InvalidRange when constructed with a string with invalid range", function () {
        var nr = new NumericRange("12:ABC");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });
    it("should be an InvalidRange when constructed with a string with 3 values separated with :", function () {
        var nr = new NumericRange("12:13:14");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });
    it("should be an InvalidRange when constructed with two values ( high ,low)", function () {
        var nr = new NumericRange(15, 12);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });
    it("should be an InvalidRange when constructed with two values ( negative ,negative)", function () {
        var nr = new NumericRange(-15, -12);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a string with invalid simple range", function () {
        var nr = new NumericRange("15:12");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });
    it("should be an InvalidRange when constructed with a badly formed string '2-4' ", function () {
        var nr = new NumericRange("2-4");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a badly formed string : '-2:0' ", function () {
        var nr = new NumericRange("-2:0");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });


    describe("extracting ranges from array", function () {

        var array = [ 0, 1, 2, 3, 4, 5];

        it("it should extract a single element with a range defined with a individual integer", function () {
            array.length.should.eql(6);
            var nr = new NumericRange(2);
            nr.extract_values(array).array.should.eql([2]);
            array.length.should.eql(6);
        });

        it("it should extract a sub array with the requested element with a simple array range", function () {

            var nr = new NumericRange(2, 4);
            array.length.should.eql(6);
            nr.extract_values(array).array.should.eql([2, 3, 4]);
            array.length.should.eql(6);
        });


        it("it should extract a sub array with the requested element with a empty NumericRange", function () {
            var nr = new NumericRange();
            nr.extract_values(array).array.should.eql([ 0, 1, 2, 3, 4, 5]);
        });

    });

    describe("setting range of an array", function () {
        var array;
        beforeEach(function() {
            array = [ 0, 1,2,3,4,5,6,7,8,9,10];
        });
        it("S1 - should replace the old array with the provided array when numeric range is empty",function() {
            var nr = new NumericRange();
            nr.set_values(array,[20,30,40]).array.should.eql([20,30,40]);
            array.should.eql([20,30,40]);
        });

        it("S2 - should replace a single element when numeric range is a single value",function() {
            var nr = new NumericRange("4");
            nr.set_values(array,[40]).array.should.eql([0,1,2,3,40,5,6,7,8,9,10]);

            array.should.eql([0,1,2,3,40,5,6,7,8,9,10]);
        });

        it("S3 - should replace a single element when numeric range is a simple range",function() {
            var nr = new NumericRange("4:6");
            nr.set_values(array,[40,50,60]).array.should.eql([0,1,2,3,40,50,60,7,8,9,10]);
            array.should.eql([0,1,2,3,40,50,60,7,8,9,10]);
        });

        it("S4 - should replace a single element when numeric range is a pair of values matching the first two elements",function() {
            var nr = new NumericRange("0:2");
            nr.set_values(array,[-3,-2,-1]).array.should.eql([-3,-2,-1,3,4,5,6,7,8,9,10]);
            array.should.eql([-3,-2,-1,3,4,5,6,7,8,9,10]);
        });
        it("S5 - should replace a single element when numeric range is a single value matching the last element",function() {
            var nr = new NumericRange("10");
            nr.set_values(array,[-100]).array.should.eql([0,1,2,3,4,5,6,7,8,9,-100]);
            array.should.eql([0,1,2,3,4,5,6,7,8,9,-100]);
        });
        it("S6 - should replace a single element when numeric range is a pair of values matching the last two elements",function() {
            var nr = new NumericRange("9:10");
            nr.set_values(array,[-90,-100]).array.should.eql([0,1,2,3,4,5,6,7,8,-90,-100]);
            array.should.eql([0,1,2,3,4,5,6,7,8,-90,-100]);
        });
        it("S7 - should replace a single element when numeric range is a pair of values matching the whole array",function() {
            var nr = new NumericRange("0:10");
            nr.set_values(array,[-1,-2,-3,-4,-5,-6,-7,-8,-9,-10,-11]).array.should.eql([-1,-2,-3,-4,-5,-6,-7,-8,-9,-10,-11]);
            array.should.eql([-1,-2,-3,-4,-5,-6,-7,-8,-9,-10,-11]);
        });
    });



    describe(" encoding / decoding", function () {

        var ObjWithNumericRange;
        before(function(){
            ObjWithNumericRange = factories.registerObject(ObjWithNumericRange_Schema,"tmp");
        });
        after(function(){
            factories.unregisterObject(ObjWithNumericRange_Schema);
        });
        var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
        it("should persist an object with a numeric range - empty", function () {
            var o = new ObjWithNumericRange({});
            should(o.numericRange.toEncodeableString()).eql(null);
            encode_decode_round_trip_test(o);
        });
        it("should persist an object with a numeric range - value pair", function () {
            var o = new ObjWithNumericRange({
                numericRange: "2:3"
            });
            should(o.numericRange.toEncodeableString()).eql("2:3");
            encode_decode_round_trip_test(o);
        });
        it("should persist an object with a numeric range - single value", function () {
            var o = new ObjWithNumericRange({
                numericRange: "100"
            });
            should(o.numericRange.toEncodeableString()).eql("100");
            encode_decode_round_trip_test(o);
        });
        it("should persist an object with a numeric range - Invalid", function () {
            var o = new ObjWithNumericRange({
                numericRange: "-4,-8"
            });
            should(o.numericRange.toEncodeableString()).eql("-1:-3"); // -1 -3 is the default invalid numerical range
            encode_decode_round_trip_test(o);
        });
    });
});
