const should = require("should");

const { StatusCodes } = require("node-opcua-status-code");
const { assert_arrays_are_equal } = require("node-opcua-test-helpers/dist/typedarray_helpers");

const { NumericRange, NumericRangeType } = require("..");

describe("Testing numerical range", () => {
    it("should construct an empty NumericRange", () => {
        const nr = new NumericRange();
        nr.type.should.eql(NumericRangeType.Empty);
        should(nr.toEncodeableString()).eql(null);
    });

    it("should construct a NumericRange from a integer", () => {
        const nr = new NumericRange(12);
        nr.type.should.eql(NumericRangeType.SingleValue);
        nr.toString().should.eql("12");
    });

    it("should construct a NumericRange from a integer (InvalidRange)", () => {
        const nr = new NumericRange("-12");
        nr.type.should.eql(NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should construct a NumericRange with low and high bound", () => {
        const nr = new NumericRange(12, 15);
        nr.type.should.eql(NumericRangeType.ArrayRange);
        nr.toString().should.eql("12:15");
    });

    it("should be an InvalidRange if low bound is greater than high bound", () => {
        const nr = new NumericRange([15, 12]);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an SingleValue if low bound === high bound", () => {
        const nr = new NumericRange(15, 15);
        nr.type.should.equal(NumericRange.NumericRangeType.SingleValue);
        nr.isValid().should.equal(true);
        nr.toString().should.eql("15");
    });

    it("should throw an exception if high bound is crap", () => {
        should(() => {
            const a = new NumericRange(15, "crappy stuff");
        }).throwError();
    });

    it("should construct a NumericRange with a array containing low and high bound", () => {
        const nr = new NumericRange([12, 15]);
        nr.type.should.eql(NumericRangeType.ArrayRange);
        nr.toString().should.eql("12:15");
    });

    it("should construct a NumericRange from a string containing an integer", () => {
        const nr = new NumericRange("12");
        nr.type.should.eql(NumericRangeType.SingleValue);
        nr.toString().should.eql("12");
    });

    it("should construct a NumericRange from a string containing a simple range", () => {
        const nr = new NumericRange("12:15");
        nr.type.should.eql(NumericRangeType.ArrayRange);
        nr.toString().should.eql("12:15");
    });

    it("should be an InvalidRange when constructed with a string with invalid range", () => {
        const nr = new NumericRange("12:ABC");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a string with 3 values separated with :", () => {
        const nr = new NumericRange("12:13:14");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with two values ( high ,low)", () => {
        const nr = new NumericRange(15, 12);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with two values ( negative ,negative)", () => {
        const nr = new NumericRange(-15, -12);
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a single negative numb", () => {
        const nr = new NumericRange("-11000");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a string with invalid array range (low==high) ", () => {
        const nr = new NumericRange("12:12");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a string with invalid array range (low==high) ", () => {
        const nr = new NumericRange([12, 12]);
        nr.type.should.equal(NumericRange.NumericRangeType.SingleValue);
        nr.isValid().should.equal(true);
    });
    it("should be an MatrixRange when constructed with [1, 2], [3, 4]", () => {
        const nr = new NumericRange([1, 2], [3, 4]);
        nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
        nr.isValid().should.equal(true);
        nr.toString().should.eql("1:2,3:4");
    });
    it("should be an MatrixRange when constructed with [1], [3] ", () => {
        const nr = new NumericRange([1, 1], [3, 3]);
        nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
        nr.isValid().should.equal(true);
        nr.toString().should.eql("1,3");
    });
    it("should be an InvalidRange when constructed with a string with invalid array range ( low > high )", () => {
        const nr = new NumericRange("15:12");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a badly formed string '2-4' ", () => {
        const nr = new NumericRange("2-4");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    it("should be an InvalidRange when constructed with a badly formed string : '-2:0' ", () => {
        const nr = new NumericRange("-2:0");
        nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
        nr.isValid().should.equal(false);
    });

    describe("MatrixRange", () => {
        it("should be an MatrixRange when constructed with a string : '1:3,4:5' ", () => {
            const nr = new NumericRange("1:3,4:5");
            nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            nr.isValid().should.equal(true);
        });

        it("should be an InvalidRange when constructed with a matrix form string : '1:1,2:2'", () => {
            const nr = new NumericRange("1:1,2:2");
            nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
            nr.isValid().should.equal(false);
        });

        it("should be an InvalidRange when constructed with a matrix form string : '1,2:2'", () => {
            const nr = new NumericRange("1,2:2");
            nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
            nr.isValid().should.equal(false);
        });

        it("should be an InvalidRange when constructed with a matrix form string : '1:1,2'", () => {
            const nr = new NumericRange("1:1,2");
            nr.type.should.equal(NumericRange.NumericRangeType.InvalidRange);
            nr.isValid().should.equal(false);
        });

        it("should be an MatrixRange when constructed with a matrix form string : '1,2' ", () => {
            const nr = new NumericRange("1,2");
            nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            nr.isValid().should.equal(true);
            nr.value.should.eql([
                [1, 1],
                [2, 2]
            ]);
        });

        it("should be an Matrix when constructed with  string : '1,2:3' ", () => {
            const nr = new NumericRange("1,2:3");
            nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            nr.isValid().should.equal(true);
            nr.value.should.eql([
                [1, 1],
                [2, 3]
            ]);
            nr.toEncodeableString().should.eql("1,2:3");
        });

        it("should be an MatrixRange when constructed with   string : '1:2,2' ", () => {
            const nr = new NumericRange("1:2,3");
            nr.type.should.equal(NumericRange.NumericRangeType.MatrixRange);
            nr.isValid().should.equal(true);
            nr.toString().should.eql("1:2,3");
        });

        it("should return error on -2:0", () => {
            const range = NumericRange.coerce("-2:2");
            range.isValid().should.eql(false);

            const range1 = new NumericRange("-2:2");
            range1.isValid().should.eql(false);

            const range2 = new NumericRange("0:2");
            range2.isValid().should.eql(true);
            range2.value[0] = -2;
            range2.isValid().should.eql(false);
        });

        it("invalid with 3 digits", () => {
            const range = NumericRange.coerce("1,2,3");
            range.isValid().should.eql(false);
        });
        it("invalid with invalid number", () => {
            const range = new NumericRange(-2);
            range.isValid().should.eql(false);
        });

        it("coerce", () => {
            const range = NumericRange.coerce("NumericRange:<Empty>");
            range.isEmpty().should.eql(true);
            range.toString().should.eql("NumericRange:<Empty>");
        });
        it("coerce", () => {
            const range = NumericRange.coerce(new NumericRange("0:2"));
            range.isValid().should.eql(true);
            range.toString().should.eql("0:2");
        });
        it("construct from NumericRange - should raise an exception", () => {
            should.throws(() => {
                const range = new NumericRange(new NumericRange("0:2"));
            });
        });
        it("construct default", () => {
            const nr = NumericRange.schema.defaultValue();

            const r = NumericRange.schema.random();
        });
    });

    describe("extracting ranges from string", () => {
        const referenceString = "Lorem Ipsum";

        it("it should extract a single element with a single value range", () => {
            referenceString.length.should.eql(11);
            const nr = new NumericRange(2);
            const r = nr.extract_values(referenceString);
            r.array.should.eql("r");
            r.statusCode.should.eql(StatusCodes.Good);
            referenceString.length.should.eql(11);
        });

        it("it should extract a sub array with the requested element with a simple array range", () => {
            const nr = new NumericRange(2, 4);
            referenceString.length.should.eql(11);
            const r = nr.extract_values(referenceString);
            r.array.should.eql("rem");
            r.statusCode.should.eql(StatusCodes.Good);
            referenceString.length.should.eql(11);
        });

        it("it should return a statusCode and empty string if numeric range is out of bound - issue #635", () => {
            const nr = new NumericRange(20, 40);
            nr.type.should.eql(NumericRangeType.ArrayRange);
            referenceString.length.should.eql(11);
            const r = nr.extract_values(referenceString);
            r.array.should.eql("");
            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            referenceString.length.should.eql(11);
        });
        it("it should return a statusCode and empty string if numeric range (single element) is out of bound - issue #635", () => {
            const nr = new NumericRange(20);
            referenceString.length.should.eql(11);
            const r = nr.extract_values(referenceString);
            r.array.should.eql("");
            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            referenceString.length.should.eql(11);
        });

        it("it should extract a sub matrix when indexRange is a NumericRange.Matrix", () => {
            /* cSpell:disable */
            const matrixString = [
                "Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam ",
                "nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat ",
                "volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ",
                "ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat.",
                "Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse "
            ];

            const nr = new NumericRange("1:2,3:5");

            const result = nr.extract_values(matrixString);
            result.array.should.be.instanceOf(Array);
            result.array.length.should.eql(2);
            result.array[0].should.eql("umm");
            result.array[1].should.eql("utp");

            const nr2 = new NumericRange("1,3");
            const result2 = nr2.extract_values(matrixString);
            result2.array.should.be.instanceOf(Array);
            result2.array.length.should.eql(1);
            result2.array[0].should.eql("u");
        });
    });
    describe("extracting ranges from ByteString", () => {
        const referenceByteString = Buffer.from("Lorem Ipsum", "ascii");

        it("it should extract a single element with a range defined with a individual integer", () => {
            referenceByteString.length.should.eql(11);
            const nr = new NumericRange(2);
            const r = nr.extract_values(referenceByteString);
            r.array.should.be.instanceOf(Buffer);
            r.array.toString().should.eql("r");
            r.statusCode.should.eql(StatusCodes.Good);
            referenceByteString.length.should.eql(11);
        });

        it("it should extract a sub array with the requested element with a simple array range", () => {
            const nr = new NumericRange(2, 4);
            referenceByteString.length.should.eql(11);
            const r = nr.extract_values(referenceByteString);
            r.array.should.be.instanceOf(Buffer);
            r.array.toString().should.eql("rem");
            r.statusCode.should.eql(StatusCodes.Good);
            referenceByteString.length.should.eql(11);
        });

        it("it should handle the case where the high value of the range is bigger than the array size", () => {
            // what the specs says:
            // When reading a value, the indexes may not specify a range that is within the bounds of the array. The
            // Server shall return a partial result if some elements exist within the range. The Server shall return a
            // Bad_IndexRangeNoData if no elements exist within the range.
            // Bad_IndexRangeInvalid is only used for invalid syntax of the NumericRange. All other invalid requests
            // with a valid syntax shall result in Bad_IndexRangeNoData.

            const nr = new NumericRange("0:16777215"); // very large range outside the bound

            referenceByteString.length.should.eql(11);
            const r = nr.extract_values(referenceByteString);

            r.statusCode.should.eql(StatusCodes.Good);
            r.array.should.be.instanceOf(Buffer);
            r.array.toString().should.eql("Lorem Ipsum");
            referenceByteString.length.should.eql(11);
        });

        it("it should handle the case where both high value and low value range are bigger than the array size", () => {
            const nr = new NumericRange("16777000:16777215"); // very large range outside the bound

            referenceByteString.length.should.eql(11);
            const r = nr.extract_values(referenceByteString);

            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            referenceByteString.length.should.eql(11);
        });
    });
    describe("extracting ranges from array", () => {
        const array = [0, 1, 2, 3, 4, 5];

        it("it should extract a single element with a range defined with a individual integer", () => {
            array.length.should.eql(6);
            const nr = new NumericRange(2);
            const r = nr.extract_values(array);
            r.array.should.eql([2]);
            array.length.should.eql(6);
        });

        it("it should extract a sub array with the requested element with a simple array range", () => {
            const nr = new NumericRange(2, 4);
            array.length.should.eql(6);
            const r = nr.extract_values(array);
            r.array.should.eql([2, 3, 4]);
            r.statusCode.should.eql(StatusCodes.Good);
            array.length.should.eql(6);
        });

        it("it should extract a sub array with the requested element with a empty NumericRange", () => {
            const nr = new NumericRange();
            nr.extract_values(array).array.should.eql([0, 1, 2, 3, 4, 5]);
        });

        it("it should extract the last 3 elements of an array", () => {
            const nr = new NumericRange("3:5");
            const r = nr.extract_values(array);
            r.statusCode.should.eql(StatusCodes.Good);
            assert_arrays_are_equal(r.array, [3, 4, 5]);
        });

        it("it should return BadIndexRangeNoData  if single value Range is outside array boundary", () => {
            const nr = new NumericRange("1000");
            const r = nr.extract_values(array);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
        });

        it("should handle null array", () => {
            const nr = new NumericRange("1000");
            const r = nr.extract_values(null);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
        });

        it("should handle null array", () => {
            const nr = new NumericRange();
            const r = nr.extract_values(null);
            r.array = array;
            r.statusCode.should.eql(StatusCodes.Good);
        });
    });
    describe("extracting ranges from matrix", () => {
        function createMatrix(row, col, flatArray) {
            if (!(flatArray instanceof Array && row * col == flatArray.length)) {
                throw new Error("Invalid Matrix Size");
            }
            return flatArray;

            /*      const array = [];
                  for (let i = 0; i < row; i++) {
                      array[i] = flatarray.slice(i * col, i * col + col);
                  }
                  return array;
              */
        }

        const matrix = createMatrix(3, 3, [11, 12, 13, 21, 22, 23, 31, 32, 33]);
        const dimensions = [3, 3];
        const emptyMatrix = createMatrix(0, 0, []);

        beforeEach(() => {
            matrix.length.should.eql(9);
            matrix.should.eql([11, 12, 13, 21, 22, 23, 31, 32, 33]);
        });
        afterEach(() => {
            matrix.length.should.eql(9, "original array should not be affected");
            matrix.should.eql([11, 12, 13, 21, 22, 23, 31, 32, 33]);
        });

        it("should extract sub matrix of null matrix", () => {
            const nr = new NumericRange("0,0");
            nr.isDefined().should.eql(true);
            const r = nr.extract_values(emptyMatrix);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
        });

        it("should extract sub matrix at 0,0", () => {
            const nr = new NumericRange("0,0");
            const r = nr.extract_values(matrix, dimensions);
            r.statusCode.should.eql(StatusCodes.Good);
            r.dimensions.should.eql([1, 1]);
            r.array.length.should.eql(1);
            r.array[0].should.eql(11);
        });
        it("should extract sub matrix at 1,0", () => {
            const nr = new NumericRange("1,0");
            const r = nr.extract_values(matrix, dimensions);
            r.statusCode.should.eql(StatusCodes.Good);
            r.dimensions.should.eql([1, 1]);
            r.array.length.should.eql(1);
            r.array[0].should.eql(21);
        });
        it("should extract sub matrix at 0,1", () => {
            const nr = new NumericRange("0,1");
            nr.isDefined().should.eql(true);
            const r = nr.extract_values(matrix, dimensions);
            r.statusCode.should.eql(StatusCodes.Good);
            r.dimensions.should.eql([1, 1]);
            r.array.length.should.eql(1);
            r.array[0].should.eql(12);
        });
        it("should extract sub matrix column at 0:2,1 ( a column)", () => {
            const nr = new NumericRange("0:2,0");
            const r = nr.extract_values(matrix, dimensions);
            r.statusCode.should.eql(StatusCodes.Good);
            r.array.length.should.eql(3);
            r.dimensions.should.eql([3, 1]);
            r.array.length.should.eql(3);
            r.array[0].should.eql(11);
            r.array[1].should.eql(21);
            r.array[2].should.eql(31);
        });
        it("should extract sub matrix row at 0:2,1 ( a row)", () => {
            const nr = new NumericRange("0,0:2");
            const r = nr.extract_values(matrix, dimensions);
            r.statusCode.should.eql(StatusCodes.Good);
            r.dimensions.should.eql([1, 3]);
            r.array.length.should.eql(3);
            r.array[0].should.eql(11);
            r.array[1].should.eql(12);
            r.array[2].should.eql(13);
        });
        it("it should extract a sub array with the requested element with a simple array range", () => {
            // cSpell: disable
            const data = ["ABCD", "EFGH", "IJKL"];
            const nr = new NumericRange("2,1");
            nr.type.should.eql(NumericRange.NumericRangeType.MatrixRange);
            const r = nr.extract_values(data);
            r.array.should.eql(["J"]);
            r.statusCode.should.eql(StatusCodes.Good);
        });
    });

    function makeBuffer(values) {
        const buff = Buffer.allocUnsafe(values.length);
        for (let i = 0; i < values.length; i++) {
            buff[i] = values[i];
        }
        return buff;
    }

    describe("extracting ranges from a typed array", () => {
        function test(name, createArray) {
            const array = createArray([0, 1, 2, 3, 4, 5]);

            beforeEach(() => {
                array.length.should.eql(6);
            });
            afterEach(() => {
                array.length.should.eql(6, " original array should not be affected");
            });

            it(name + " Z1 - it should extract a single element with a range defined with a individual integer", () => {
                const nr = new NumericRange(2);
                const r = nr.extract_values(array);

                assert_arrays_are_equal(r.array, createArray([2]));

                should(r.array instanceof array.constructor).equal(true);
            });

            it(name + " Z2 - it should extract a sub array with the requested element with a simple array range", () => {
                const nr = new NumericRange(2, 4);

                const r = nr.extract_values(array);
                assert_arrays_are_equal(r.array, createArray([2, 3, 4]));
            });
            it(name + " Z3 - it should extract a sub array with the requested element with a empty NumericRange", () => {
                const nr = new NumericRange();
                const r = nr.extract_values(array);
                assert_arrays_are_equal(r.array, createArray([0, 1, 2, 3, 4, 5]));
            });

            it(name + " Z4 - it should extract the last 3 elements of an array", () => {
                const nr = new NumericRange("3:5");
                const r = nr.extract_values(array);
                r.statusCode.should.eql(StatusCodes.Good);
                assert_arrays_are_equal(r.array, createArray([3, 4, 5]));
            });

            it(name + " Z5 - it should return BadIndexRangeNoData if range is outside array boundary", () => {
                const nr = new NumericRange("300000:100000000");
                const r = nr.extract_values(array);
                r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
            });
            it(name + " Z6 - it should return BadIndexRangeInvalid if range is invalid", () => {
                const nr = new NumericRange("-3:100000000");
                const r = nr.extract_values(array);
                r.statusCode.should.eql(StatusCodes.BadIndexRangeInvalid);
            });

            it(
                name +
                    " Z7 - it should return BadIndexRangeNoData if range is a MatrixRange and value is an array that contains no ArrayLike Elements",
                () => {
                    const nr = new NumericRange("1,1");
                    nr.type.should.eql(NumericRange.NumericRangeType.MatrixRange);
                    const r = nr.extract_values(array);
                    r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
                }
            );
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
                return { value: v.toString() };
            });
        });
        test("Uint8Array", makeBuffer);
    });

    describe("setting range of an array", () => {
        let array;
        beforeEach(() => {
            array = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        });
        it("S1 - should replace the old array with the provided array when numeric range is empty", () => {
            const nr = new NumericRange();
            nr.set_values(array, [20, 30, 40]).array.should.eql([20, 30, 40]);
            array.should.eql([20, 30, 40]);
        });

        it("S2 - should replace a single element when numeric range is a single value", () => {
            const nr = new NumericRange("4");
            nr.set_values(array, [40]).array.should.eql([0, 1, 2, 3, 40, 5, 6, 7, 8, 9, 10]);

            array.should.eql([0, 1, 2, 3, 40, 5, 6, 7, 8, 9, 10]);
        });

        it("S3 - should replace a single element when numeric range is a simple range", () => {
            const nr = new NumericRange("4:6");
            nr.set_values(array, [40, 50, 60]).array.should.eql([0, 1, 2, 3, 40, 50, 60, 7, 8, 9, 10]);
            array.should.eql([0, 1, 2, 3, 40, 50, 60, 7, 8, 9, 10]);
        });

        it("S4 - should replace a single element when numeric range is a pair of values matching the first two elements", () => {
            const nr = new NumericRange("0:2");
            // prettier-ignore
            nr.set_values(array, [-3, -2, -1]).array.should.eql([-3, -2, -1, 3, 4, 5, 6, 7, 8, 9, 10]);
            // prettier-ignore
            array.should.eql([-3, -2, -1, 3, 4, 5, 6, 7, 8, 9, 10]);
        });
        it("S5 - should replace a single element when numeric range is a single value matching the last element", () => {
            const nr = new NumericRange("10");
            // prettier-ignore
            nr.set_values(array, [-100]).array.should.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -100]);
            // prettier-ignore
            array.should.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -100]);
        });
        it("S6 - should replace a single element when numeric range is a pair of values matching the last two elements", () => {
            const nr = new NumericRange("9:10");
            // prettier-ignore
            nr.set_values(array, [-90, -100]).array.should.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, -90, -100]);
            array.should.eql([0, 1, 2, 3, 4, 5, 6, 7, 8, -90, -100]);
        });
        it("S7 - should replace a single element when numeric range is a pair of values matching the whole array", () => {
            const nr = new NumericRange("0:10");
            // prettier-ignore
            nr.set_values(array, [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]).array.should.eql([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]);
            array.should.eql([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]);
        });
        it("S8 - should write the last 3 elements of an array", () => {
            const nr = new NumericRange("8:10");
            const r = nr.set_values(array, [80, 90, 100]);
            r.statusCode.should.eql(StatusCodes.Good);
            assert_arrays_are_equal(r.array, [0, 1, 2, 3, 4, 5, 6, 7, 80, 90, 100]);
        });
        it("S9 - should return BadIndexRangeNoData  if range is outside array boundary", () => {
            const nr = new NumericRange("1000:1010");
            const r = nr.set_values(array, [80, 90, 100]);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeNoData);
        });
        it("S10 - should return BadIndexRangeInvalid  if range is invalid", () => {
            const nr = new NumericRange("-1000:1010");
            const r = nr.set_values(array, [80, 90, 100]);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeInvalid);
        });
        it("S11 - should return BadIndexRangeInvalid if range doesn't match new array size", () => {
            const nr = new NumericRange("2:2");
            const r = nr.set_values(array, [80, 90, 100]);
            r.statusCode.should.eql(StatusCodes.BadIndexRangeInvalid);
        });
    });

    describe("setting range of a matrix", () => {
        let matrix;
        const dimensions = [4, 10];
        beforeEach(() => {
            // prettier-ignore
            matrix = [
                10, 11, 12, 13, 14, 15, 16, 17, 18, 19, // row 0
                20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 
                30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
                40, 41, 42, 43, 44, 45, 46, 47, 48, 49
            ];
        });
        it("M1 - setting a single element inside a matrix", () => {
            matrix[2 * 10 + 3].should.eql(33);
            const nr = new NumericRange("2,3");
            const r = nr.set_values_matrix({ matrix, dimensions }, [-33]);
            r.statusCode.should.eql(StatusCodes.Good);
            matrix[2 * 10 + 3].should.eql(-33);
        });
        it("M2 - setting a sub matrix inside a matrix", () => {
            matrix[2 * 10 + 3].should.eql(33);
            const nr = new NumericRange("2:3,3:5");
            const r = nr.set_values_matrix(
                { matrix, dimensions },
                // prettier-ignore
                [
                    -33, -34, -35,
                    -43, -44, -45
                   ]
            );
            r.statusCode.should.eql(StatusCodes.Good);
            matrix[2 * 10 + 3].should.eql(-33);
            matrix[2 * 10 + 4].should.eql(-34);
            matrix[2 * 10 + 5].should.eql(-35);

            matrix[3 * 10 + 3].should.eql(-43);
            matrix[3 * 10 + 4].should.eql(-44);
            matrix[3 * 10 + 5].should.eql(-45);
        });
    });
    describe("setting range of a typed  array", () => {
        function test(name, createArray) {
            let array;
            beforeEach(() => {
                array = createArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
            });

            it(name + "-S1 - should replace the old array with the provided array when numeric range is empty", () => {
                const nr = new NumericRange();
                const r = nr.set_values(array, createArray([20, 30, 40]));
                assert_arrays_are_equal(r.array, createArray([20, 30, 40]));
                should(r.array instanceof array.constructor).be.eql(true);
            });

            it(name + "-S2 - should replace a single element when numeric range is a single value", () => {
                const nr = new NumericRange("4");
                nr.set_values(array, createArray([40])).array.should.eql(createArray([0, 1, 2, 3, 40, 5, 6, 7, 8, 9, 10]));
            });

            it(name + "-S3 - should replace a single element when numeric range is a simple range", () => {
                const nr = new NumericRange("4:6");
                nr.set_values(array, createArray([40, 50, 60])).array.should.eql(
                    createArray([0, 1, 2, 3, 40, 50, 60, 7, 8, 9, 10])
                );
            });

            it(
                name +
                    "-S4 - should replace a single element when numeric range is a pair of values matching the first two elements",
                () => {
                    const nr = new NumericRange("0:2");
                    nr.set_values(array, createArray([-3, -2, -1])).array.should.eql(
                        createArray([-3, -2, -1, 3, 4, 5, 6, 7, 8, 9, 10])
                    );
                }
            );
            it(
                name + "-S5 - should replace a single element when numeric range is a single value matching the last element",
                () => {
                    const nr = new NumericRange("10");
                    nr.set_values(array, createArray([-100])).array.should.eql(createArray([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -100]));
                }
            );
            it(
                name +
                    "-S6 - should replace a single element when numeric range is a pair of values matching the last two elements",
                () => {
                    const nr = new NumericRange("9:10");
                    nr.set_values(array, createArray([-90, -100])).array.should.eql(
                        createArray([0, 1, 2, 3, 4, 5, 6, 7, 8, -90, -100])
                    );
                }
            );
            it(
                name + "-S7 - should replace a single element when numeric range is a pair of values matching the whole array",
                () => {
                    const nr = new NumericRange("0:10");
                    const r = nr.set_values(array, createArray([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]));
                    assert_arrays_are_equal(r.array, createArray([-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11]));
                }
            );
            it(name + "-S8 - should write the last 3 elements of an array", () => {
                const nr = new NumericRange("8:10");
                const r = nr.set_values(array, createArray([80, 90, 100]));
                r.statusCode.should.eql(StatusCodes.Good);
                assert_arrays_are_equal(r.array, createArray([0, 1, 2, 3, 4, 5, 6, 7, 80, 90, 100]));
            });

            it(name + "-S9 - should return BadIndexRangeNoData if range is a matrix range and value is an array", () => {
                const nr = new NumericRange("1,1"); // Matrix Range
                const r = nr.set_values(array, createArray([80, 90, 100]));
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
                return { value: v.toString() };
            });
        });

        test("Int8Array", makeBuffer);
    });

    describe("Operations", () => {
        it("'<empty>' '<empty>' should  overlap ", () => {
            NumericRange.overlap(new NumericRange(), new NumericRange()).should.eql(true);
        });
        it("'<empty>' '5:6' should  overlap ", () => {
            NumericRange.overlap(new NumericRange(), new NumericRange("5:6")).should.eql(true);
        });
        it(" '5:6' '<empty>' should  overlap ", () => {
            NumericRange.overlap(new NumericRange("5:6"), new NumericRange()).should.eql(true);
        });
        it(" '5' '8' should not overlap ", () => {
            NumericRange.overlap(new NumericRange("5"), new NumericRange("8")).should.eql(false);
        });
        it(" '5' '5' should not overlap ", () => {
            NumericRange.overlap(new NumericRange("5"), new NumericRange("5")).should.eql(true);
        });
        it("'1:2' '5:6' should not overlap ", () => {
            NumericRange.overlap(new NumericRange("1:2"), new NumericRange("5:6")).should.eql(false);
        });
        // +-----+        +------+     +---+       +------+
        //     +----+       +---+    +--------+  +---+

        it("'1:6' '3:8' should overlap ", () => {
            NumericRange.overlap(new NumericRange("1:6"), new NumericRange("3:8")).should.eql(true);
        });
        it("'1:6' '3:4' should overlap ", () => {
            NumericRange.overlap(new NumericRange("1:6"), new NumericRange("3:4")).should.eql(true);
        });
        it("'3:4' '1:10' should overlap ", () => {
            NumericRange.overlap(new NumericRange("3:4"), new NumericRange("1:10")).should.eql(true);
        });
        it("'1:2' '2:6' should overlap ", () => {
            NumericRange.overlap(new NumericRange("1:2"), new NumericRange("2:6")).should.eql(true);
        });
    });
});
