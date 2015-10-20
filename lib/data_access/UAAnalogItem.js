"use strict";
// HasProperty  Variable  InstrumentRange  Range  PropertyType  Optional
// HasProperty  Variable  EURange  Range  PropertyType  Mandatory
// HasProperty  Variable  EngineeringUnits  EUInformation  PropertyType  Optional

require("requirish")._(module);
var assert = require("better-assert");
var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var EUInformation = require("lib/data_access/EUInformation").EUInformation;
var Range = require("lib/data_access/Range").Range;

var add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;

/**
 * @method addDataItem
 * @param parentObject
 * @param options
 * @param options.browseName {String}
 * @param options.definition {String}
 * @param [options.valuePrecision {Double |null} =null]
 * @param options.dataType {NodeId} // todo :check
 * @param options.value
 */
function addDataItem(parentObject, options) {

    var address_space = parentObject.__address_space;
    assert(address_space instanceof AddressSpace);
    var dataType = options.dataType || "Number";

    var dataItemType = address_space.findVariableType("DataItemType");

    var variable = address_space.addVariable(parentObject, {
        browseName: options.browseName,
        nodeId: options.nodeId,
        typeDefinition: dataItemType.nodeId,
        dataType: dataType,
        value: options.value
    });

    add_dataItem_stuff(variable, options);

    variable.install_extra_properties();
    return variable;
}
exports.addDataItem = addDataItem;

/**
 *
 * @method addAnalogDataItem
 *
 * AnalogDataItem DataItems that represent continuously-variable physical quantities ( e.g., length, temperature) , in
 * contrast to the digital representation of data in discrete  items
 * NOTE Typical examples are the values provided by temperature sensors or pressure sensors. OPC UA defines a specific
 * UAVariableType to identify an AnalogItem. Properties describe the possible ranges of  AnalogItems.
 *
 *
 * @example:
 *
 *
 *   add_analog_dataItem(address_space,{
 *      browseName: "TemperatureSensor",
 *
 *      definition: "(tempA -25) + tempB",
 *      valuePrecision: 0.5,
 *      //-
 *      instrumentRange: { low: 100 , high: 200}, // optional
 *      engineeringUnitsRange: { low: 100 , high: 200}, // mandatory
 *      engineeringUnits: standardUnits.degree_celsius,, // optional
 *
 *      // access level
 *      accessLevel: 1
 *      minimumSamplingInterval: 10,
 *
 *   });
 *
 * @param parentObject
 * @param options
 * @param options.browseName {String}
 * @param options.definition {String}
 * @param [options.valuePrecision {Double |null} =null]
 * @param options.instrumentRange
 * @param options.instrumentRange.low {Double}
 * @param options.instrumentRange.high {Double}
 * @param options.engineeringUnitsRange.low {Double}
 * @param options.engineeringUnitsRange.high {Double}
 * @param options.engineeringUnits {String}
 * @param options.dataType {NodeId} // todo :check
 * @param [options.accessLevel {AccessLevelFlag} = "CurrentRead | CurrentWrite"]
 * @param [options.userAccessLevel {AccessLevelFlag} = "CurrentRead | CurrentWrite"]
 * @param options.value
 */

function addAnalogDataItem(parentObject, options) {

    var address_space = parentObject.__address_space;
    assert(address_space instanceof AddressSpace);

    assert(options.hasOwnProperty("engineeringUnitsRange"),"expecting engineeringUnitsRange");

    var dataType = options.dataType || "Number";

    var analogItemType = address_space.findVariableType("AnalogItemType");
    assert(analogItemType, "expecting AnalogItemType to be defined , check nodeset xml file");

    var variable = address_space.addVariable(parentObject, {
        browseName: options.browseName,
        nodeId: options.nodeId,
        typeDefinition: analogItemType.nodeId,
        dataType: dataType,
        accessLevel: options.accessLevel,
        userAccessLevel: options.userAccessLevel,
        value: options.value
    });

    add_dataItem_stuff(variable, options);

    // mandatory (EURange in the specs)
    // OPC Unified Architecture, Part 8  6  Release 1.02
    // EURange  defines the value range likely to be obtained in normal operation. It is intended for such
    // use as automatically scaling a bar graph display
    // Sensor or instrument failure or deactivation can result in a return ed item value which is actually
    // outside  of  this range. Client software must be prepared to deal with this   possibility. Similarly a client
    // may attempt to write a value that is outside  of  this range back to the server. The exact behavio ur
    // (accept, reject, cl amp, etc.) in this case is server - dependent. However ,   in general servers  shall  be
    // prepared to handle this.
    //     Example:    EURange ::= {-200.0,1400.0}

    address_space.addProperty(variable, {
        browseName: "EURange",
        typeDefinition: "PropertyType",
        dataType: "Range",
        minimumSamplingInterval: 0,
        value:  new Variant({
                    dataType: DataType.ExtensionObject, value: new Range(options.engineeringUnitsRange)
                })
    });

    if (options.hasOwnProperty("instrumentRange")) {


        address_space.addProperty(variable, {
            browseName: "InstrumentRange",
            typeDefinition: "PropertyType",
            dataType: "Range",
            minimumSamplingInterval: 0,
            accessLevel: "CurrentRead",
            value: new Variant({
                dataType: DataType.ExtensionObject, value: new Range(options.instrumentRange)
            })
        });
    }

    if (options.hasOwnProperty("engineeringUnits")) {

        var engineeringUnits = new EUInformation(options.engineeringUnits);
        assert(engineeringUnits instanceof EUInformation, "expecting engineering units");

        // EngineeringUnits  specifies the units for the   DataItem‟s value (e.g., DEGC, hertz, seconds).   The
        // EUInformation   type is specified in   5.6.3.

        address_space.addProperty(variable, {
            browseName: "EngineeringUnits",
            typeDefinition: "PropertyType",
            dataType: "EUInformation",
            minimumSamplingInterval: 0,
            accessLevel: "CurrentRead",
            value:  new Variant({
                        dataType: DataType.ExtensionObject, value: engineeringUnits
                    })
        });
    }

    variable.install_extra_properties();

    return variable;

}
exports.addAnalogDataItem = addAnalogDataItem;

