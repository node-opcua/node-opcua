var should = require("should");

var NumericRange = require("../../lib/datamodel/numeric_range").NumericRange;
var NumericRangeType = NumericRange.NumericRangeType;

describe("Testing numerical range",function () {

    it("should construct an empty NumericRange", function (){

        var nr = new NumericRange();
        nr.type.should.eql(NumericRangeType.Empty);
        should(nr.toString()).eql(null);
    });

    it("should construct a NumericRange from a integer", function () {
        var nr = new NumericRange(12);
        nr.type.should.eql(NumericRangeType.SingleValue);
        nr.toString().should.eql("12");

    });

    it("should construct a NumericRange with low and high bound", function () {
        var nr = new NumericRange(12, 15);
        nr.type.should.eql(NumericRangeType.ArrayRange);
        nr.toString().should.eql("12:15");

    });

    it("should  be an InvalidRange if low bound is greater than high bound", function() {
        var nr =  new NumericRange([15, 12]);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
    });

    it("should be an InvalidRange if bound === high bound", function() {
        var nr = new NumericRange(15, 15);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
    });

    it("should throw an exception if high bound is crap", function() {
        should(function () {
            new NumericRange(15, "crappy stuff");
        }).throwError();
    });

    it("should construct a NumericRange with a array containing low and high bound",function() {
        var nr = new NumericRange([12,15]);
        nr.type.should.eql(NumericRangeType.ArrayRange);
        nr.toString().should.eql("12:15");
    });

    it("should construct a NumericRange from a string containing an integer", function (){
        var nr = new NumericRange("12");
        nr.type.should.eql(NumericRangeType.SingleValue);
        nr.toString().should.eql("12");
    });

    it("should construct a NumericRange from a string containing a simple range", function (){
        var nr = new NumericRange("12:15");
        nr.type.should.eql(NumericRangeType.ArrayRange);
        nr.toString().should.eql("12:15");
    });

    it("should be an InvalidRange when constructed with a string with invalid simple range", function (){
        var nr = new NumericRange(15,12);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
    });

    it("should be an InvalidRange when constructed with a string with invalid simple range", function (){
        var nr = new NumericRange("15:12");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
    });
    it("should be an InvalidRange when constructed with a badly formed string", function (){
        var nr = new NumericRange( "2-4");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
    });

   ;

    describe("extracting ranges from array", function() {

        var array = [ 0, 1, 2, 3, 4, 5];

        it("it should extract a single element with a range defined with a individual integer", function () {
            var nr = new NumericRange(2);
            nr.extract_values(array).array.should.eql([2]);
        });

        it("it should extract a sub array with the requested element with a simple array range", function () {
            var nr = new NumericRange(2, 4);
            nr.extract_values(array).array.should.eql([2, 3, 4]);
        });


        it("it should extract a sub array with the requested element with a empty NumericRange", function () {
            var nr = new NumericRange();
            nr.extract_values(array).array.should.eql( [ 0, 1, 2, 3, 4, 5]);
        });

    });

    var factories = require("../../lib/misc/factories");
    var ObjWithNumericRange_Schema = {

        id: factories.next_available_id(),
        name: "ObjWithNumericRange",
        fields: [
            { name: "title", fieldType: "UAString" },
            {
                name: "numericRange", fieldType: "NumericRange"
            }
        ]
    };

    var ObjWithNumericRange  = factories.registerObject(ObjWithNumericRange_Schema);

    describe(" encoding / decoding",function() {

        it("should persist an object with a numeric range",function() {

            var o = new ObjWithNumericRange({

            });

            should(o.numericRange.toString()).eql(null);

            var encode_decode_round_trip_test = require("../helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;
            encode_decode_round_trip_test(o);
        })
    })
});
