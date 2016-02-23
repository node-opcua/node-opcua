"use strict";
/*
 <UADataType NodeId="i=296" BrowseName="Argument">
     <DisplayName>Argument</DisplayName>
     <Description>An argument for a method.</Description>
     <References>
        <Reference ReferenceType="HasSubtype" IsForward="false">i=22</Reference>
     </References>
     <Definition Name="Argument">
         <Field Name="Name" DataType="i=12">
             <Description>The name of the argument.</Description>
         </Field>
         <Field Name="DataType" DataType="i=17">
             <Description>The data type of the argument.</Description>
         </Field>
         <Field Name="ValueRank" DataType="i=6">
             <Description>Whether the argument is an array type and the rank of the array if it is.</Description>
         </Field>
         <Field Name="ArrayDimensions" DataType="i=7" ValueRank="1">
             <Description>The number of dimensions if the argument is an array type and one or more dimensions have a fixed length.</Description>
         </Field>
         <Field Name="Description" DataType="i=21">
             <Description>The description for the argument.</Description>
         </Field>
     </Definition>
 </UADataType>
 */
require("requirish")._(module);
var _ = require("underscore");
var assert = require("better-assert");

var factories = require("lib/misc/factories");
var NodeId = require("lib/datamodel/nodeid").NodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var coerceNodeId = require("lib/datamodel/nodeid").coerceNodeId;

var DataType = require("lib/datamodel/variant").DataType;

// OPC Unified Architecture, Part 4 $7.1 page 106
var Argument_Schema = {
    name: "Argument",
    documentation: "An argument for a method.",
    construct_hook: function(options) {

        var dataType = options.dataType;
        if (dataType) {
            if (typeof dataType === "string") {
                dataType = makeNodeId(dataType.value, 0);
                //dataType = coerceNodeId(DataType[dataType].value);
            } else {
                dataType = coerceNodeId(dataType.value);
            }
           options.dataType = dataType;
        }
        return options;
    },
    fields: [
        {name: "name", fieldType: "String", documentation: "The name of the argument."},
        {name: "dataType", fieldType: "NodeId", documentation: "The nodeId of the Data type of the argument."},

    /**
     * @class Argument
     *
     * @property valueRank {Integer}
     *
     * valueRank (5.6.2 Variable NodeClass part 3)
     * This Attribute indicates whether the Value Attribute of the Variable is
     * an array and how many dimensions the array has.
     * It may have the following values:
     *    n > 1: the Value is an array with the specified number of dimensions.
     *    OneDimension        (1): The value is an array with one dimension.
     *    OneOrMoreDimensions (0): The value is an array with one or more dimensions.
     *    Scalar             (-1): The value is not an array.
     *    Any                (-2): The value can be a scalar or an array with any number of
     *                             dimensions.
     *   ScalarOrOneDimension(-3): The value can be a scalar or a one dimensional array.
     *
     *   NOTE: All DataTypes are considered to be scalar, even if they have
     *   array-like semantics like ByteString and String.
     */
        {
            name: "valueRank",
            fieldType: "Int32",
            documentation: "Whether the argument is an array type and the rank of the array if it is.",
            defaultValue: -1 /* Scalar is the default value */
        },

    /**
     * @property arrayDimensions {UInt32}
     * This Attribute specifies the length of each dimension for an array
     * value. The Attribute is intended to describe the capability of the
     * Variable, not the current size.
     * The number of elements shall be equal to the value of the ValueRank
     * Attribute. Shall be null if ValueRank ≤0.
     * A value of 0 for an individual dimension indicates that the dimension
     * has a variable length.
     * For example, if a Variable is defined by the following C array:
     * Int32 myArray[346];
     * then this Variable’s DataType would point to an Int32, the Variable’s
     * ValueRank has the value 1 and the one entry having the value 346.
     */

        {
            name: "arrayDimensions",
            fieldType: "UInt32",
            isArray: true,
            defaultValue: null,
            documentation: "The number of dimensions if the argument is an array type and one or more dimensions have a fixed length."
        },
        {name: "description", fieldType: "LocalizedText", documentation: "The description for the argument."}

    ]
};
exports.Argument_Schema = Argument_Schema;