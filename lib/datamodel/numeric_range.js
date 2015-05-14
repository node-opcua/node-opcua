/* global NumericRange*/
"use strict";
/**
 * @module opcua.datamodel
 */
require("requirish")._(module);
var factories = require("lib/misc/factories");
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

var ec = require("lib/misc/encode_decode");
var _ = require("underscore");
var Enum = require("lib/misc/enum");
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
        assert(value === null || value instanceof NumericRange);
        value = (value === null) ? null :   value.toEncodeableString();
        ec.encodeString(value, stream);
    },
    decode: function (stream) {
        var str = ec.decodeString(stream);
        return new NumericRange(str);
    },
    coerce: function (value) {
        if (value instanceof NumericRange)  {
            return value;
        }
        if (value === null || value === undefined) {
            return new NumericRange();
        }
        assert(typeof value === "string" || _.isArray(value));
        return new NumericRange(value);
    },
    random: function() {
        function r() { return Math.ceil(Math.random()*100); }
        var start = r();
        var end = start +r();
        return new NumericRange(start,end);
    }
};
exports.NumericRange_Schema =NumericRange_Schema;
factories.registerBasicType(NumericRange_Schema);


var NumericRangeType = new Enum(["Empty", "SingleValue", "ArrayRange", "MatrixRange", "InvalidRange"]);

var regexNumericRange = /^[0-9:;]*$/;

function construct_numeric_range_from_string(str) {

    if (!regexNumericRange.test(str)) {
        return {
            type: NumericRangeType.InvalidRange,
            value: str
        };
    }

    var values = str.split(":");

    if (values.length === 1) {
        return {
            type: NumericRangeType.SingleValue,
            value: parseInt(values[0], 10)
        };
    } else if (values.length === 2) {

        var array =  values.map(function (a) { return parseInt(a, 10); });
        return {
            type: NumericRangeType.ArrayRange,
            value: array
        };
    } else {
        return {
            type: NumericRangeType.InvalidRange,
            value: str
        };
    }

}


function NumericRange(value, second_value) {

    assert (!value || !(value instanceof NumericRange),"use coerce to create a NumerciRange");
    if (typeof value  === "string") {

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
            this._set_range_value(value, second_value);
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

    assert(!this.type !== NumericRangeType.ArrayRange || _.isArray(this.value) );
}

NumericRange.coerce = NumericRange_Schema.coerce;

NumericRange.prototype._set_single_value = function (value) {
    assert(_.isFinite(value));
    this.value = value;
    this.type = NumericRangeType.SingleValue;
    if(this.value<0) {
        this.type = NumericRangeType.InvalidRange;
    }
};

NumericRange.prototype._set_range_value = function (low, high) {
    assert(_.isFinite(low));
    assert(_.isFinite(high));
    this.value = [ low, high ];
    this.type = NumericRangeType.ArrayRange;

    if (!this._check_range()) {
        this.type = NumericRangeType.InvalidRange;
    }
};

NumericRange.prototype.isValid = function () {
    return this.type !== NumericRange.NumericRangeType.InvalidRange;
};
NumericRange.prototype.isEmpty = function () {
    return this.type === NumericRange.NumericRangeType.Empty;
};

NumericRange.prototype._check_range = function () {

    if (this.type === NumericRangeType.ArrayRange) {
        if (this.value[0] >= this.value[1]) {
            return false;// throw new Error(" Range : Invalid range specified low >= bound");
        }
        if (this.value[0]< 0 || this.value[1]<0) {
            return false;
        }
    }
    return true;
};

NumericRange.NumericRangeType = NumericRangeType;

NumericRange.prototype.toEncodeableString = function()
{
    switch (this.type.key) {
        case NumericRangeType.SingleValue.key:
        case NumericRangeType.ArrayRange.key:
        case NumericRangeType.MatrixRange.key:
            return this.toString();
        case NumericRangeType.InvalidRange.key:
            return "-1:-3"; // simulate an invalid Item
        default:
            return null;
    }
};

NumericRange.prototype.toString = function () {

    function array_range_to_string(values) {
        //xx console.log(" ------------------------------".red,values);
        assert(_.isArray(values));
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
        return "NumericRange:<Empty>";

    case NumericRangeType.MatrixRange:
        return matrix_range_to_string(this.value);
    case NumericRangeType.Invalid:
        return "NumericRange:<Invalid>";
    default:
        return null;
    }
};

NumericRange.prototype.toJSON = function () {
    return this.toString();
};

NumericRange.prototype.isDefined = function () {
    return this.type !== NumericRangeType.Empty && this.type !== NumericRangeType.InvalidRange;
};


NumericRange.prototype.extract_values = function (array) {


    function slice(arr,start, end) {
        if (arr.buffer instanceof ArrayBuffer) {
            return arr.subarray(start,end);
        } else {
            return array.slice(start,end);
        }
    }
    switch (this.type.key) {
    case NumericRangeType.Empty.key:
        return {
            array: slice(array,0,array.length),
            statusCode: StatusCodes.Good
        };

    case NumericRangeType.SingleValue.key:

        var index = this.value;
        if (index >= array.length) {
            return { array: [],  statusCode: StatusCodes.BadIndexRangeNoData  };
        }
        return {
                array: slice(array,index,index+1),
                statusCode: StatusCodes.Good
        };

    case NumericRangeType.ArrayRange.key:

        var low_index  = this.value[0];
        var high_index = this.value[1];

        assert(low_index < high_index);
        if ( high_index >= array.length) {
            return { array: [], statusCode: StatusCodes.BadIndexRangeNoData };
        }
        return {
            array: slice(array,low_index, high_index+1),
            statusCode: StatusCodes.Good
        };

    case NumericRangeType.MatrixRange.key:
        return this.matrix_range_to_string(this.value);

    default:
        return { array: [], statusCode: StatusCodes.BadIndexRangeInvalid};
    }
};

function assert_array_or_buffer(array) {
    assert(_.isArray(array) || (array.buffer instanceof ArrayBuffer )  || array instanceof Buffer);
}

function insertInPlaceStandardArray(arrayToAlter,low,high,newValues) {
    var args = [low,high-low+1].concat(newValues);
    arrayToAlter.splice.apply(arrayToAlter,args);
    return arrayToAlter;
}

function insertInPlaceTypedArray(arrayToAlter,low,high,newValues) {

    if (low===0 && high === arrayToAlter.length - 1) {
        return new arrayToAlter.constructor(newValues);
    }
    assert(newValues.length === high-low+1);
    arrayToAlter.subarray(low,high+1).set(newValues);
    return arrayToAlter;
}

function insertInPlaceBuffer(bufferToAlter,low,high,newValues) {
    if (low===0 && high === bufferToAlter.length - 1) {
        return new Buffer(newValues);
    }
    assert(newValues.length === high-low+1);
    for (var i=0;i<newValues.length;i++) {
        bufferToAlter[i+low] = newValues[i];
    }
    return bufferToAlter;
}


NumericRange.prototype.set_values = function (arrayToAlter,newValues) {

    assert_array_or_buffer(arrayToAlter);
    assert_array_or_buffer(newValues);

    var low_index,high_index;

    switch (this.type) {
        case NumericRangeType.Empty:
            low_index = 0; high_index = arrayToAlter.length - 1;
            break;
        case NumericRangeType.SingleValue:
            low_index = this.value; high_index =this.value;
            break;
        case NumericRangeType.ArrayRange:
            low_index = this.value[0];
            high_index = this.value[1];
            break;
        case NumericRangeType.MatrixRange:
            return this.matrix_range_to_string(this.value);
        default:
            return { array: [], statusCode: StatusCodes.BadIndexRangeInvalid};
    }
    if (high_index >= arrayToAlter.length || low_index >= arrayToAlter.length ) {
        return { array: [], statusCode: StatusCodes.BadIndexRangeNoData };
    }
    var insertInPlace = (_.isArray(arrayToAlter) ? insertInPlaceStandardArray: (arrayToAlter instanceof Buffer ? insertInPlaceBuffer:insertInPlaceTypedArray));
    return {
        array: insertInPlace(arrayToAlter,low_index,high_index,newValues),
        statusCode: StatusCodes.Good
    };

};

exports.NumericRange = NumericRange;

