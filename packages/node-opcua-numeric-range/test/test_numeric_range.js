/*global describe,require,it */

var should = require("should");

var NumericRange = require("..").NumericRange;
var NumericRangeType = NumericRange.NumericRangeType;
var StatusCodes = require("node-opcua-status-code").StatusCodes;
var assert_arrays_are_equal = require("node-opcua-test-helpers/src/typedarray_helpers").assert_arrays_are_equal;



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

    xit("should be an ArrayRange if low bound === high bound", function () {
        var nr = new NumericRange(15, 15);
        nr.type.should.equal(NumericRange.NumericRangeType.ArrayRange);
        nr.isValid().should.equal(true);
        nr.toString().should.eql("15");
    });

    it("should throw an exception if high bound is crap", function () {
        should(function () {
            var a = new NumericRange(15, "crappy stuff");
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

    it("should be an InvalidRange when constructed with a single negative numb", function () {
        var nr = new NumericRange("-11000");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a string with invalid array range (low==high) ", function () {
        var nr = new NumericRange("12:12");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a string with invalid array range ( low > high )", function () {
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

    describe("MatrixRange", function () {

        it("should be an MatrixRange when constructed with a matrix formed string : '1:3,4:5' ", function () {
            var nr = new NumericRange("1:3,4:5");
            nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            nr.isValid().should.equal(true);
        });

        it("should be an MatrixRange when constructed with a matrix formed string : '1,2' ", function () {
            var nr = new NumericRange("1,2");
            nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            nr.isValid().should.equal(true);
            nr.value.should.eql([[1, 1], [2, 2]]);
        });

        it("should be an Matrix when constructed with  string : '1,2:3' ", function () {
            var nr = new NumericRange("1,2:3");
            nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            nr.isValid().should.equal(true);
            nr.value.should.eql([[1, 1], [2, 3]]);
            nr.toEncodeableString().should.eql("1,2:3");
        });

        it("should be an MatrixRange when constructed with   string : '1:2,2' ", function () {
            var nr = new NumericRange("1:2,3");
            nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            nr.isValid().should.equal(true);
            nr.toString().should.eql("1:2,3");
        });

    });

    describe("extracting ranges from string", function () {

        var referenceString = "Lorem Ipsum";

        it("it should extract a single element with a single value range", function () {
            referenceString.length.should.eql(11);
            var nr = new NumericRange(2);
            var r = nr.extract_values(referenceString);
            r.array.should.eql("r");
            r.statusCode.should.eql(StatusCodes.Good);
            referenceString.length.should.eql(11);
        });

        it("it should extract a sub array with the requested element with a simple array range", function () {
            var nr = new NumericRange(2, 4);
            referenceString.length.should.eql(11);
            var r = nr.extract_values(referenceString);
            r.array.should.eql("rem");
            r.statusCode.should.eql(StatusCodes.Good);
            referenceString.length.should.eql(11);
        });

        it("it should extract a sub matrix when indexRange is a NumericRange.Matrix", function () {

            var matrixString = [
                "Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam ",
                "nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat ",
                "volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ",
                "ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat.",
                "Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse ",
            ];

            var nr = new NumericRange("1:2,3:5");

            var result = nr.extract_values(matrixString);
            result.array.should.be.instanceOf(Array);
            result.array.length.should.eql(2);
            result.array[0].should.eql("umm");
            result.array[1].should.eql("utp");

            var nr2 = new NumericRange("1,3");
            var result2 = nr2.extract_values(matrixString);
            result2.array.should.be.instanceOf(Array);
            result2.array.length.should.eql(1);
            result2.array[0].should.eql("u");

        });

    });
    describe("extracting ranges from ByteString", function () {

        var referenceByteString = new Buffer("Lorem Ipsum", "ascii");

        it("it should extract a single element with a range defined with a individual integer", function () {
            referenceByteString.length.should.eql(11);
            var nr = new NumericRange(2);
            var r = nr.extract_values(referenceByteString);
            r.array.should.be.instanceOf(Buffer);
            r.array.toString().should.eql("r");
            r.statusCode.should.eql(StatusCodes.Good);
            referenceByteString.length.should.eql(11);
        });

        it("it should extract a sub array with the requested element with a simple array range", function () {
            var nr = new NumericRange(2, 4);
            referenceByteString.length.should.eql(11);
            var r = nr.extract_values(referenceByteString);
            r.array.should.be.instanceOf(Buffer);
            r.array.toString().should.eql("rem");
            r.statusCode.should.eql(StatusCodes.Good);
            referenceByteString.length.should.eql(11);
        });

        it("it should handle the case where the high value of the range is bigger than the array size", function () {

            // what the specs says:
            // When reading a value, the indexes may not specify a range that is within the bounds of the array. The
            // Server shall return a partial result if some elements exist within the range. The Server shall return a
            // Bad_IndexRangeNoData if no elements exist within the range.
            // Bad_IndexRangeInvalid is only used for invalid syntax of the NumericRange. All other invalid requests
            // with a valid syntax shall result in Bad_IndexRangeNoData.

            var nr = new NumericRange("0:16777215"); // very large range outside the bound

            referenceByteString.length.should.eql(11);
            var r = nr.extract_values(referenceByteString);

            r.statusCode.should.eql(StatusCodes.Good);
            r.array.should.be.instanceOf(Buffer);
            r.array.toString().should.eql("Lorem Ipsum");
            referenceByteString.length.should.eql(11);

        });

        it("it should handle the case where both high value and low value range are bigger than the array size", function () {

            var nr = new NumericRange("16777000:16777215"); // very large range outside the bound

            referenceByteString.length.should.eql(11);
            var r = nr.extract_values(referenceByteString);

            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            referenceByteString.length.should.eql(11);

        });


    });
    describe("extracting ranges from array", function () {

        var array = [0, 1, 2, 3, 4, 5];

        it("it should extract a single element with a range defined with a individual integer", function () {
            array.length.should.eql(6);
            var nr = new NumericRange(2);
            var r = nr.extract_values(array);
            r.array.should.eql([2]);
            array.length.should.eql(6);
        });

        it("it should extract a sub array with the requested element with a simple array range", function () {

            var nr = new NumericRange(2, 4);
            array.length.should.eql(6);
            var r = nr.extract_values(array);
            r.array.should.eql([2, 3, 4]);
            r.statusCode.should.eql(StatusCodes.Good);
            array.length.should.eql(6);
        });


        it("it should extract a sub array with the requested element with a empty NumericRange", function () {
            var nr = new NumericRange();
            nr.extract_values(array).array.should.eql([0, 1, 2, 3, 4, 5]);
        });

        it("it should extract the last 3 elements of an array", function () {
            var nr = new NumericRange("3:5");
            var r = nr.extract_values(array);
            r.statusCode.should.eql(StatusCodes.Good);
            assert_arrays_are_equal(r.array, [3, 4, 5]);
        });

        it("it should return BadIndexRangeNoData  if single value Range is outside array boundary", function () {
            var nr = new NumericRange("1000");
            var r = nr.extract_values(array);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
        });

        it("should handle null array", function () {
            var nr = new NumericRange("1000");
            var r = nr.extract_values(null);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
        });

        it("should handle null array", function () {
            var nr = new NumericRange();
            var r = nr.extract_values(null);
            r.array = array;
            r.statusCode.should.eql(StatusCodes.Good);
        });

    });

    function makeBuffer(values) {
        var buff = new Buffer(values.length);
        for (var i = 0; i < values.length; i++) {
            buff[i] = values[i];
        }
        return buff;
    }

    describe("extracting ranges from a typed array", function () {


        function test(name, createArray) {

            var array = createArray([0, 1, 2, 3, 4, 5]);

            beforeEach(function () {
                array.length.should.eql(6);
            });
            afterEach(function () {
                array.length.should.eql(6, " original array should not be affected");
            });

            it(name + " Z1 - it should extract a single element with a range defined with a individual integer", function () {

                var nr = new NumericRange(2);
                var r = nr.extract_values(array);

                assert_arrays_are_equal(r.array, createArray([2]));

                should(r.array instanceof array.constructor).equal(true);
            });

            it(name + " Z2 - it should extract a sub array with the requested element with a simple array range", function () {

                var nr = new NumericRange(2, 4);

                var r = nr.extract_values(array);
                assert_arrays_are_equal(r.array, createArray([2, 3, 4]));
            });
            it(name + " Z3 - it should extract a sub array with the requested element with a empty NumericRange", function () {
                var nr = new NumericRange();
                var r = nr.extract_values(array);
                assert_arrays_are_equal(r.array, createArray([0, 1, 2, 3, 4, 5]));
            });

            it(name + " Z4 - it should extract the last 3 elements of an array", function () {
                var nr = new NumericRange("3:5");
                var r = nr.extract_values(array);
                r.statusCode.should.eql(StatusCodes.Good);
                assert_arrays_are_equal(r.array, createArray([3, 4, 5]));
            });

            it(name + " Z5 - it should return BadIndexRangeNoData if range is outside array boundary", function () {
                var nr = new NumericRange("300000:100000000");
                var r = nr.extract_values(array);
                r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            });
            it(name + " Z6 - it should return BadIndexRangeInvalid if range is invalid", function () {
                var nr = new NumericRange("-3:100000000");
                var r = nr.extract_values(array);
                r.statusCode.should.eql(StatusCodes.BadIndexRangeInvalid);
            });

            it(name + " Z7 - it should return BadIndexRangeNoData if range is a MatrixRange and value is an array", function () {
                var nr = new NumericRange("1,1");
                nr.type.should.eql(NumericRange.NumericRangeType.MatrixRange);
                var r = nr.extract_values(array);
                r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            });
        }

        test("Float32Array", function (values) {
            return new Float32Array(values);
        });
        test("Float64Array", function (values) {
            return new Float64Array(values);
        });
        test("Uint32Array", function (values) {
            return new Uint32Array(values);
        });
        test("Uint16Array", function (values) {
            return new Uint16Array(values);
        });
        test("Int16Array", function (values) {
            return new Int16Array(values);
        });
        test("Int32Array", function (values) {
            return new Int32Array(values);
        });
        test("Uint8Array", function (values) {
            return new Uint8Array(values);
        });
        test("Int8Array", function (values) {
            return new Int8Array(values);
        });

        test("BLOB", function (values) {
            return values.map(function (v) {
                return {value: v.toString()};
            });
        });
        test("Uint8Array", makeBuffer);
    });

    describe("setting range of an array", function () {
        var array;
        beforeEach(function () {
            array = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        });
        it("S1 - should replace the old array with the provided array when numeric range is empty", function () {
            var nr = new NumericRange();
            nr.set_values(array, [20, 30, 40]).array.should.eql([20, 30, 40]);
            array.should.eql([20, 30, 40]);
        });

        it("S2 - should replace a single element when numeric range is a single value", function () {
            var nr = new NumericRange("4");
            nr.set_values(array, [40]).array.should.eql([0, 1, 2, 3, 40, 5, 6, 7, 8, 9, 10]);

            array.should.eql([0, 1, 2, 3, 40, 5, 6, 7, 8, 9, 10]);
        });

        it("S3 - should replace a single element when numeric range is a simple range", function () {
            var nr = new NumericRange("4:6");
            nr.set_values(array, [40, 50, 60]).array.should.eql([0, 1, 2, 3, 40, 50, 60, 7, 8, 9, 10]);
            array.should.eql([0, 1, 2, 3, 40, 50, 60, 7, 8, 9, 10]);
        });

        it("S4 - should replace a single element when numeric range is a pair of values matching the first two elements", function () {
            var nr = new NumericRange("0:2");
            nr.set_values(array, [-3, -2, -1]).array.should.eql([-3, -2, -1, 3, 4, 5, 6, 7, 8, 9, 10]);
            array.should.eql([-3, -2, -1, 3, 4, 5, 6, 7, 8, 9, 10]);
        });
        it("S5 - should replace a single element when numeric range is a single value matching the last element", function () {
            var nr = new NumericRange("10");
            nr.set_values(array, [-100]).array.should.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -100]);
            array.should.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -100]);
        });
        it("S6 - should replace a single element when numeric range is a pair of values matching the last two elements", function () {
            var nr = new NumericRange("9:10");
            nr.set_values(array, [-90, -100]).array.should.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, -90, -100]);
            array.should.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, -90, -100]);
        });
        it("S7 - should replace a single element when numeric range is a pair of values matching the whole array", function () {
            var nr = new NumericRange("0:10");
            nr.set_values(array, [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]).array.should.eql([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]);
            array.should.eql([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]);
        });
        it("S8 - should write the last 3 elements of an array", function () {
            var nr = new NumericRange("8:10");
            var r = nr.set_values(array, [80, 90, 100]);
            r.statusCode.should.eql(StatusCodes.Good);
            assert_arrays_are_equal(r.array, [0, 1, 2, 3, 4, 5, 6, 7, 80, 90, 100]);
        });
        it("S9 - should return BadIndexRangeNoData  if range is outside array boundary", function () {
            var nr = new NumericRange("1000:1010");
            var r = nr.set_values(array, [80, 90, 100]);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
        });
        it("S10 - should return BadIndexRangeInvalid  if range is invalid", function () {
            var nr = new NumericRange("-1000:1010");
            var r = nr.set_values(array, [80, 90, 100]);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeInvalid);
        });
        it("S11 - should return BadIndexRangeInvalid if range does'nt match new array size", function () {
            var nr = new NumericRange("2:2");
            var r = nr.set_values(array, [80, 90, 100]);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeInvalid);
        });

    });

    describe("setting range of a typed  array", function () {

        function test(name, createArray) {
            var array;
            beforeEach(function () {
                array = createArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            });

            it(name + "-S1 - should replace the old array with the provided array when numeric range is empty", function () {
                var nr = new NumericRange();
                var r = nr.set_values(array, createArray([20, 30, 40]));
                assert_arrays_are_equal(r.array, createArray([20, 30, 40]));
                should(r.array instanceof array.constructor).be.eql(true);
            });

            it(name + "-S2 - should replace a single element when numeric range is a single value", function () {
                var nr = new NumericRange("4");
                nr.set_values(array, createArray([40])).array.should.eql(createArray([0, 1, 2, 3, 40, 5, 6, 7, 8, 9, 10]));
            });

            it(name + "-S3 - should replace a single element when numeric range is a simple range", function () {
                var nr = new NumericRange("4:6");
                nr.set_values(array, createArray([40, 50, 60])).array.should.eql(createArray([0, 1, 2, 3, 40, 50, 60, 7, 8, 9, 10]));
            });

            it(name + "-S4 - should replace a single element when numeric range is a pair of values matching the first two elements", function () {
                var nr = new NumericRange("0:2");
                nr.set_values(array, createArray([-3, -2, -1])).array.should.eql(createArray([-3, -2, -1, 3, 4, 5, 6, 7, 8, 9, 10]));
            });
            it(name + "-S5 - should replace a single element when numeric range is a single value matching the last element", function () {
                var nr = new NumericRange("10");
                nr.set_values(array, createArray([-100])).array.should.eql(createArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -100]));
            });
            it(name + "-S6 - should replace a single element when numeric range is a pair of values matching the last two elements", function () {
                var nr = new NumericRange("9:10");
                nr.set_values(array, createArray([-90, -100])).array.should.eql(createArray([0, 1, 2, 3, 4, 5, 6, 7, 8, -90, -100]));
            });
            it(name + "-S7 - should replace a single element when numeric range is a pair of values matching the whole array", function () {
                var nr = new NumericRange("0:10");
                var r = nr.set_values(array, createArray([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]));
                assert_arrays_are_equal(r.array, createArray([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]));
            });
            it(name + "-S8 - should write the last 3 elements of an array", function () {
                var nr = new NumericRange("8:10");
                var r = nr.set_values(array, createArray([80, 90, 100]));
                r.statusCode.should.eql(StatusCodes.Good);
                assert_arrays_are_equal(r.array, createArray([0, 1, 2, 3, 4, 5, 6, 7, 80, 90, 100]));
            });

            it(name + "-S9 - should return BadIndexRangeNoData if range is a matrix range and value is an array", function () {
                var nr = new NumericRange("1,1"); // Matrix Range
                var r = nr.set_values(array, createArray([80, 90, 100]));
                r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
                assert_arrays_are_equal(r.array, createArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
            });

        }

        test("Float32Array", function (values) {
            return new Float32Array(values);
        });
        test("Float64Array", function (values) {
            return new Float64Array(values);
        });
        test("Uint32Array", function (values) {
            return new Uint32Array(values);
        });
        test("Uint16Array", function (values) {
            return new Uint16Array(values);
        });
        test("Int16Array", function (values) {
            return new Int16Array(values);
        });
        test("Int32Array", function (values) {
            return new Int32Array(values);
        });
        test("Uint8Array", function (values) {
            return new Uint8Array(values);
        });
        test("Int8Array", function (values) {
            return new Int8Array(values);
        });

        test("BLOB", function (values) {
            return values.map(function (v) {
                return {value: v.toString()};
            });
        });

        test("Int8Array", makeBuffer);

    });



    describe("Operations", function () {

        it("'<empty>' '<empty>' should  overlap ", function () {
            NumericRange.overlap(new NumericRange(), new NumericRange()).should.eql(true);
        });
        it("'<empty>' '5:6' should  overlap ", function () {
            NumericRange.overlap(new NumericRange(), new NumericRange("5:6")).should.eql(true);
        });
        it(" '5:6' '<empty>' should  overlap ", function () {
            NumericRange.overlap(new NumericRange("5:6"), new NumericRange()).should.eql(true);
        });
        it(" '5' '8' should not overlap ", function () {
            NumericRange.overlap(new NumericRange("5"), new NumericRange("8")).should.eql(false);
        });
        it(" '5' '5' should not overlap ", function () {
            NumericRange.overlap(new NumericRange("5"), new NumericRange("5")).should.eql(true
            );
        });
        it("'1:2' '5:6' should not overlap ", function () {

            NumericRange.overlap(new NumericRange("1:2"), new NumericRange("5:6")).should.eql(false);
        });
        // +-----+        +------+     +---+       +------+
        //     +----+       +---+    +--------+  +---+

        it("'1:6' '3:8' should overlap ", function () {
            NumericRange.overlap(new NumericRange("1:6"), new NumericRange("3:8")).should.eql(true);
        });
        it("'1:6' '3:4' should overlap ", function () {
            NumericRange.overlap(new NumericRange("1:6"), new NumericRange("3:4")).should.eql(true);
        });
        it("'3:4' '1:10' should overlap ", function () {
            NumericRange.overlap(new NumericRange("3:4"), new NumericRange("1:10")).should.eql(true);
        });
        it("'1:2' '2:6' should overlap ", function () {
            NumericRange.overlap(new NumericRange("1:2"), new NumericRange("2:6")).should.eql(true);
        });

    });


});



