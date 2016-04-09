"use strict";
// Release 1.02  5  OPC Unified Architecture, Part 8

// HasProperty  Variable  Definition  String  PropertyType  Optional
// HasProperty  Variable  ValuePrecision  Double  PropertyType  Optional

// Clients may read or write  DataItems, or monitor them for value changes. The services needed for
// these  operations are specified in  Part  4. Changes are defined as a change in status (quality) or a
// change in value that exceeds a client - defined range called a  Deadband. To detect the value change,
// the difference between the current value and   the last reported value is compared to the  Deadband.


// Definition   is a vendor - specific, human readable string that specifies how the value of this  DataItem  is
// calculated.  Definition  is non - localized and will often contain an equation that can be parsed by
// certain clients.
//    Example:    Definition ::= “(TempA – 25) + TempB”


// ValuePrecision  specifies  the maximum precision that the server can maintain for the item   based on
// restrictions in the target environment.
// ValuePrecision  can be used for the following  DataTypes:
//   * For Float and Double values  it specifies   the number of   digits after the decimal place.
//   * For DateTime values it indicates the minimum time difference in nanoseconds. For example,
//     a ValuePrecision of 20   000  000 defines a precision of 20 ms.
//     The  ValuePrecision  Property  is an approximation that is intended to prov ide guidance to a  Client. A
//     Server  is expected to silently round any value with more precision that it supports. This implies that
//     a  Client  may encounter cases where the value read back from a  Server  differs from the value that it
//    wrote to the Server. This   difference shall be no more than the difference suggested by this  Property
require("requirish")._(module);
var assert = require("better-assert");
var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var _ = require("underscore");

var definition_Description = "Definition  is a vendor - specific, human readable string that specifies how the value of this  DataItem  is calculated.";
var valuePrecision_Description = "";


/**
 * @method add_dataItem_stuff
 * @param variable
 * @param options  {Object}
 * @param options.definition [Optional]
 * @param options.valuePrecision [Optional]
 * @param options.modellingRule [Optional]
 * @private
 */
function add_dataItem_stuff(variable, options) {

    var addressSpace = variable.__address_space;
    assert(addressSpace instanceof AddressSpace);

    if (options.hasOwnProperty("definition")) {

        addressSpace.addVariable({
            modellingRule: options.modellingRule ? "Mandatory" : undefined,
            propertyOf: variable,
            browseName: "Definition",
            typeDefinition: "PropertyType",
            description: definition_Description,
            dataType: "String",
            value: new Variant({dataType: DataType.String, value: options.definition}),
            minimumSamplingInterval: 0
        });
    }

    if (options.hasOwnProperty("valuePrecision")) {

        assert(_.isNumber(options.valuePrecision));

        addressSpace.addVariable({
            modellingRule: options.modellingRule ? "Mandatory" : undefined,
            propertyOf: variable,
            browseName: "ValuePrecision",
            typeDefinition: "PropertyType",
            description: valuePrecision_Description,
            dataType: "Number",
            value: new Variant({dataType: DataType.Double, value: options.valuePrecision}),
            minimumSamplingInterval: 0
        });
    }
}
exports.add_dataItem_stuff = add_dataItem_stuff;

