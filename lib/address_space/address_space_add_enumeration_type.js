"use strict";
/**
 * @module opcua.address_space
 * @class AddressSpace
 */
require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");



exports.install = function (AddressSpace) {

    var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
    //var DataValue = require("lib/datamodel/datavalue").DataValue;
    var Variant = require("lib/datamodel/variant").Variant;
    var DataType = require("lib/datamodel/variant").DataType;
    var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
    var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
    var NodeId = require("lib/datamodel/nodeid").NodeId;
    var UADataType = require("lib/address_space/ua_data_type").UADataType;

    var EnumValueType = require("_generated_/_auto_generated_EnumValueType").EnumValueType;
    var coerceLocalizedText = require("lib/datamodel/localized_text").coerceLocalizedText;
    /**
     *
     * @method addEnumerationType
     * @param options
     * @param options.browseName  {String}
     * @param options.enumeration {Array}
     * @param options.enumeration[].displayName {String|LocalizedText}
     * @param options.enumeration[].value       {Number}
     * @param options.enumeration[].description {String|LocalizedText|null}
     */
    AddressSpace.prototype.addEnumerationType = function (options) {

        // Release 1.03 OPC Unified Architecture, Part 3 - page 34
        // Enumeration DataTypes are DataTypes that represent discrete sets of named values.
        // Enumerations are always encoded as Int32 on the wire as defined in Part 6. Enumeration
        // DataTypes inherit directly or indirectly from the DataType Enumeration defined in 8.14.
        // Enumerations have no encodings exposed in the AddressSpace. To expose the humanreadable
        // representation of an enumerated value the DataType Node may have the EnumString
        // Property that contains an array of LocalizedText. The Integer representation of the enumeration
        // value points to a position within that array. EnumValues Property can be used instead of the
        // EnumStrings to support integer representation of enumerations that are not zero-based or have
        // gaps. It contains an array of a Structured DataType containing the integer representation as
        // well as the human-readable representation. An example of an enumeration DataType containing
        // a sparse list of Integers is NodeClass which is defined in 8.30.

        // OPC Unified Architecture, Part 3  Release 1.03 page 35
        // Table 11 – DataType NodeClass
        // EnumStrings O LocalizedText[] The EnumStrings Property only applies for Enumeration DataTypes.
        //                               It shall not be applied for other DataTypes. If the EnumValues
        //                               Property is provided, the EnumStrings Property shall not be provided.
        //                               Each entry of the array of LocalizedText in this Property represents
        //                               the human-readable representation of an enumerated value. The
        //                               Integer representation of the enumeration value points to a position of the array.
        // EnumValues O EnumValueType[]  The EnumValues Property only applies for Enumeration DataTypes.
        //                               It shall not be applied for other DataTypes. If the EnumStrings
        //                               Property is provided, the EnumValues Property shall not be provided.
        //                               Using the EnumValues Property it is possible to represent.
        //                               Enumerations with integers that are not zero-based or have gaps
        //                               (e.g. 1, 2, 4, 8, 16).
        //                               Each entry of the array of EnumValueType in this Property
        //                               represents one enumeration value with its integer notation, humanreadable
        //                                representation and help information.
        // The Property EnumStrings contains human-readable representations of enumeration values and is
        // only applied to Enumeration DataTypes. Instead of the EnumStrings Property an Enumeration
        // DataType can also use the EnumValues Property to represent Enumerations with integer values that are not
        // zero-based or containing gaps. There are no additional Properties defined for DataTypes in this standard.
        // Additional parts of this series of standards may define additional Properties for DataTypes.

        //8.40 EnumValueType
        // This Structured DataType is used to represent a human-readable representation of an
        // Enumeration. Its elements are described inTable 27. When this type is used in an array representing
        // human-readable representations of an enumeration, each Value shall be unique in that array.
        // Table 27 – EnumValueType Definition
        // Name               Type            Description
        // EnumValueType structure
        // Value              Int64           The Integer representation of an Enumeration.
        // DisplayName        LocalizedText   A human-readable representation of the Value of the Enumeration.
        // Description        LocalizedText   A localized description of the enumeration value. This field can contain an
        //                                    empty string if no description is available.
        // Note that the EnumValueType has been defined with a Int64 Value to meet a variety of usages.
        // When it is used to define the string representation of an Enumeration DataType, the value range
        // is limited to Int32, because the Enumeration DataType is a subtype of Int32. Part 8 specifies
        // other usages where the actual value might be between 8 and 64 Bit.
        var self = this;

        assert(_.isString(options.browseName));
        assert(_.isArray(options.enumeration));

        var definition;
        var enumerationType = self.findDataType("Enumeration");
        assert(enumerationType.nodeId instanceof NodeId);
        assert(enumerationType instanceof UADataType)
        var references = [
            {referenceType: "HasSubtype", isForward: false, nodeId: enumerationType.nodeId}
        ];
        var opts = {
            browseName: options.browseName,
            references: references,
            nodeClass: NodeClass.DataType,
            isAbstract: false,
            displayName: options.displayName || null,
            description: options.description || null,
            definition: definition
        };

        var enumType = self._createNode(opts);

        enumType.propagate_back_references();

        if (_.isString(options.enumeration[0])) {

            // enumeration is a array of string
            definition = options.enumeration.map(function (str, index) {
                return coerceLocalizedText(str);
            });

            var value = new Variant({
                dataType: DataType.LocalizedText,
                arrayType: VariantArrayType.Array,
                value: definition
            });


            var enumStrings = self.addVariable({
                propertyOf: enumType,
                browseName: "EnumStrings",
                modellingRule: "Mandatory",
                description: "",
                dataType: "LocalizedText",
                valueRank: 1,
                value: value
            });
            assert(enumStrings.browseName.toString() === "EnumStrings");

        } else {

            // construct the definition object
            definition = options.enumeration.map(function (enumItem) {
                return  new EnumValueType({
                    displayName: coerceLocalizedText(enumItem.displayName),
                    value:  [ 0, enumItem.value ],
                    description: coerceLocalizedText(enumItem.description)
                });
            });

            var value = new Variant({
                dataType: DataType.ExtensionObject,
                arrayType: VariantArrayType.Array,
                value: definition
            });

            var enumValues = self.addVariable({
                propertyOf: enumType,
                browseName: "EnumValues",
                modellingRule: "Mandatory",
                description: null,
                dataType: "EnumValueType",
                valueRank: 1,
                value: value
            });
            assert(enumValues.browseName.toString() === "EnumValues");
        }
        // now create the string value property
        // <UAVariable NodeId="i=7612" BrowseName="EnumStrings" ParentNodeId="i=852" DataType="LocalizedText" ValueRank="1">
        // <DisplayName>EnumStrings</DisplayName>
        // <References>
        //   <Reference ReferenceType="HasTypeDefinition">i=68</Reference>
        //   <Reference ReferenceType="HasModellingRule">i=78</Reference>
        //    <Reference ReferenceType="HasProperty" IsForward="false">i=852</Reference>
        // </References>
        // <Value>
        //    <ListOfLocalizedText xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
        //      <LocalizedText><Locale></Locale><Text>Running</Text></LocalizedText>
        //      <LocalizedText><Locale></Locale><Text>Failed</Text>
        //    </ListOfLocalizedText>
        // </Value>
        //</UAVariable>

        return enumType;
    };
};

