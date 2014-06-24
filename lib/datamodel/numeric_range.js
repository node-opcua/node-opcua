/**
 * @module opcua.datamodel
 */
var factories = require("./../misc/factories");
var StatusCodes = require("../datamodel/opcua_status_code").StatusCodes;
var _ = require("underscore");
var Enum = require("enum");
var assert = require("better-assert");

// OPC.UA Part 4 7.21 Numerical Range
// The syntax for the string contains one of the following two constructs. The first construct is the string
// representation of an individual integer. For example, '6' is   valid, but '6.0' and '3.2' are not. The
// minimum and maximum values that can be expressed are defined by the use of this parameter and
// not by this parameter type definition. The second construct is a range represented by two integers
// separated by the colon   (':') character. The first integer shall always have a lower value than the
// second. For example, '5:7' is valid, while '7:5' and '5:5' are not. The minimum and maximum values
// that can be expressed by these integers are defined by the use of this parameter , and not by this
// parameter type definition. No other characters, including white - space characters, are permitted.
// Multi- dimensional arrays can be indexed by specifying a range for each dimension separated by a ','.
//
// For example, a 2x2 block in a 4x4 matrix   could be selected with the range '1:2,0:1'. A single element
// in a multi - dimensional array can be selected by specifying a single number instead of a range.
// For example, '1,1' specifies selects the [1,1] element in a two dimensional array.
// Dimensions are specified in the order that they appear in the  ArrayDimensions Attribute.
// All dimensions shall be specified for a  NumericRange  to be valid.
//
// All indexes start with 0. The maximum value for any index is one less than the length of the
// dimension.


var ec = require("../misc/encode_decode");
// BNF of NumericRange
// The following BNF describes the syntax of the NumericRange parameter type.
// <numeric-range>    ::= <dimension> [',' <dimension>]
//     <dimension>    ::= <index> [':' <index>]
//         <index>    ::= <digit> [<digit>]
//         <digit>    ::= '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' |9'
var NumericRange_Schema = {
    name: "NumericRange",
    subtype: "UAString",
    defaultValue: function () {
        return new NumericRange();
    },
    encode: function (value, stream) {
        assert(value instanceof NumericRange);
        ec.encodeString(value.toString(), stream);
    },
    decode: function (stream) {
        var str = ec.decodeString(stream);
        return new NumericRange(str);
    },
    coerce: function (value) {
        return new NumericRange(value);
    }
};


factories.registerBasicType(NumericRange_Schema);



var NumericRangeType = new Enum(["Empty", "SingleValue", "ArrayRange", "MatrixRange" ,"InvalidRange"]);

var regexNumericRange = /^[0-9\:\;]*$/;

function construct_numeric_range_from_string(str) {

    if (! regexNumericRange.test(str)) {
        return {
            type: NumericRangeType.InvalidRange,
            value: str
        };
    }
    // split with ","
    var lines = str.split(",");

    if (lines.length === 1) {

        var l = lines[0];
        var values = l.split(":");

        if (values.length === 1) {
            return {
                type: NumericRangeType.SingleValue,
                value: parseInt(values[0],10)
            };
        } else if (values.length === 2) {

            return {
                type: NumericRangeType.ArrayRange,
                value: values.map(function(a) { return parseInt(a,10);} )
            };
        }
    } else if (lines.length === 2) {
        return {
            type: NumericRangeType.SingleValue,
            value: values
        };
    }
    throw new Error("Invalid NumericRange string " + str);
}

function NumericRange(value, second_value) {


    if (typeof(value) === "string") {

        var nr = construct_numeric_range_from_string(value);
        this.type = nr.type;
        this.value = nr.value;
        if (!this._check_range()) {
            this.type = NumericRangeType.InvalidRange;
        }

    } else if (_.isFinite(value) && !_.isUndefined(value)) {

        if (_.isUndefined(second_value)) {
            this._set_single_value(value);

        } else {

            if (!_.isFinite(second_value)) {
                throw new Error(" invalid second argument, expecting a number");
            }
            this._set_range_value(value,second_value);
        }

    } else if (_.isArray(value)) {
        assert(value.length === 2);
        if (_.isFinite(value[0])) {
            if (!_.isFinite(value[1])) {
                throw new Error(" invalid range in " + value);
            }
            this._set_range_value(value[0], value[1]);
        }
    } else if (value instanceof NumericRange) {
        this.value = _.clone(value);
        this.type = value.type;

    } else {
        this.value = "<invalid>";
        this.type = NumericRangeType.Empty;
    }
}

NumericRange.prototype._set_single_value = function (value) {
    assert(_.isFinite(value) && value >=0);
    this.value = value;
    this.type = NumericRangeType.SingleValue;
}
NumericRange.prototype._set_range_value = function (low,high) {
    assert(_.isFinite(low) && low >=0);
    assert(_.isFinite(high) && high >=0);
    this.value = [ low, high ];
    this.type = NumericRangeType.ArrayRange;

    if (!this._check_range()) {
        this.type = NumericRangeType.InvalidRange;
    }

}


NumericRange.prototype._check_range = function () {

    if (this.type === NumericRangeType.ArrayRange) {
        if (this.value[0] >= this.value[1]) {
            return false;// throw new Error(" Range : Invalid range specified low >= bound");
        }
    }
    return true;
};

NumericRange.NumericRangeType = NumericRangeType;

NumericRange.prototype.toString = function () {


    function array_range_to_string(values) {
        return values.map(function (value) {
            return value.toString(10);
        }).join(":");
    }

    function matrix_range_to_string(values) {
        return values.map(function (value) {
            return array_range_to_string(value);
        }).join(",");
    }

    switch (this.type) {
        case NumericRangeType.SingleValue:
            return this.value.toString(10);

        case NumericRangeType.ArrayRange:
            return array_range_to_string(this.value);

        case NumericRangeType.Empty:
            return null;

        case NumericRangeType.MatrixRange:
            return matrix_range_to_string(this.value);
        default:
            return null;
    }
};

NumericRange.prototype.isDefined= function() {
    return this.type != NumericRangeType.Empty && this.type != NumericRangeType.InvalidRange;
}

NumericRange.prototype.extract_values = function (array) {

    switch (this.type) {
        case NumericRangeType.Empty:
            return {
                array: array,
                statusCode : StatusCodes.Good
            };

        case NumericRangeType.SingleValue:
            var index = this.value;

            if (index >= array.length) {
                return {
                    array: [],
                    statusCode :  StatusCodes.BadIndexRangeNoData
                };
            } else {
                return {
                    array:[array[index]],
                    statusCode : StatusCodes.Good
                };

            }
            break;
        case NumericRangeType.ArrayRange:

            var low_index =  parseInt(this.value[0] ,10);
            var high_index = parseInt(this.value[1] ,10) + 1;
            assert(low_index < high_index);
            if ((high_index-1) >= array.length) {
                return {
                    array: [],
                    statusCode :  StatusCodes.BadIndexRangeNoData
                };
            } else {
                return {
                    array: array.slice(low_index, high_index),
                    statusCode: StatusCodes.Good
                };
            }
            break;
        case NumericRangeType.MatrixRange:
            return matrix_range_to_string(this.value);
        default:
            return { array:[],statusCode: StatusCodes.BadIndexRangeInvalid};
    }
};
exports.NumericRange = NumericRange;

