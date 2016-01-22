"use strict";
/**
 * @module opcua.address_space
 * @class AddressSpace
 */
require("requirish")._(module);
var assert = require("better-assert");
var _ = require("underscore");
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
//var DataValue = require("lib/datamodel/datavalue").DataValue;
var Variant = require("lib/datamodel/variant").Variant;
var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
var NodeId = require("lib/datamodel/nodeid").NodeId;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;

/**
 *
 * @method addEnumeration
 * @param options
 * @param options.browseName  {String}
 * @param options.enumeration {Enum}
 * @param options.enumeration[].name {String}
 * @param options.enumeration[].value {Integer}
 * @param options.enumeration[].description {String}
 */
AddressSpace.prototype.addEnumerationType = function (options) {

    var self = this;

    assert(_.isString(options.browseName));
    assert(_.isArray(options.enumeration));

    // construct the definition object
    var definition = options.enumeration.map(function (enumItem) {
        return {
            name: enumItem.name,
            value: enumItem.value,
            description: enumItem.description
        };
    });


    var enumerationType = self.findDataType("Enumeration");
    assert(enumerationType.nodeId instanceof NodeId);
    var references = [
        {referenceType: "HasSubtype", forward: false, nodeId: enumerationType.nodeId}
    ];
    var opts = {
        browseName:  options.browseName,
        references:  references,
        nodeClass:   NodeClass.DataType,
        isAbstract:  false,
        displayName: options.displayName || null,
        description: options.description || null,
        definition:  definition
    };

    var enumType = self._createNode(opts);

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

    var value = new Variant({
        dataType: DataType.LocalizedText,
        arrayType: VariantArrayType.Array,
        value: definition.map(function (defItem) {
            return new LocalizedText({text: defItem.name});
        })
    });


    var enumStrings = self.addVariable({
        propertyOf:     enumType,
        browseName:    "EnumStrings",
        modellingRule: "Mandatory",
        description:   "",
        dataType:      "LocalizedText",
        valueRank:     1,
        value:         value
    });

    return enumType;
};
