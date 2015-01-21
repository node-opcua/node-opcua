
// HasProperty  Variable  InstrumentRange  Range  PropertyType  Optional
// HasProperty  Variable  EURange  Range  PropertyType  Mandatory
// HasProperty  Variable  EngineeringUnits  EUInformation  PropertyType  Optional

require("requirish")._(module);
var assert = require("assert");
var address_space = require("lib/address_space/address_space");
var AddressSpace = address_space.AddressSpace;
var DataType = require("lib/datamodel/variant").DataType;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var Variant = require("lib/datamodel/variant").Variant;
var _ = require("underscore");

var definition_Description = "Definition  is a vendor - specific, human readable string that specifies how the value of this  DataItem  is calculated.";
var valuePrecision_Description = "";

var EUInformation = require("lib/data_access/EUInformation").EUInformation;
var Range = require("lib/data_access/Range").Range;

var add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;

/**
 *
 * @method addAnalogDataItem
 *
 * AnalogDataItem DataItems  that represent  continuously- variable physical quantities  ( e.g., length, temperature) , in
 * contrast to the digital representation of data in discrete  items
 * NOTE  Typical examples are the values provided by temperature sensors or pressure sensors. OPC UA defines a specific
 * VariableType  to id entify an AnalogItem.  Properties   describe the possible ranges of  AnalogItems.
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
 *      engineeringUnits: "Celsius", // optional
 *
 *      // access level
 *      accessLevel: 1
 *      minimumSamplingInterval: 10,
 *
 *   });
 *
 * @param address_space
 * @param options.browseName {String}
 * @param options.definition {String}
 * @param [options.valuePrecision {Double |null} =null]
 * @param options.instrumentRange
 * @param options.instrumentRange.low {Double}
 * @param options.instrumentRange.high {Double}
 * @param options.engineeringUnitsRange.low {Double}
 * @param options.engineeringUnitsRange.high {Double}
 * @param options.engineeringUnits {String}
 */
function addAnalogDataItem(parentObject,options) {

    var address_space = parentObject.__address_space;
    assert(address_space instanceof AddressSpace);

    var analogItemType = address_space.findVariableType("AnalogItemType");

    var variable = address_space.addVariable(parentObject,{
        browseName: options.browseName,
        //xx typeDefinition: analogItemType.nodeId
        dataType: analogItemType.nodeId,
        value: { get: function(){ return new Variant({dataType: DataType.ExtensionObject, value:null}); } }
    });

    add_dataItem_stuff(variable,options);


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
    assert(options.hasOwnProperty("engineeringUnitsRange"));

    variable.$engineeringUnitsRange = new Range(options.engineeringUnitsRange);

    address_space.addVariable(variable,{
        browseName: "EURange",
        typeDefinition: "PropertyType",
        dataType:"Range",
        value: { get: function() {
            return new Variant({
                dataType: DataType.ExtensionObject, value: variable.$engineeringUnitsRange
            });
        }}
    });

    if(options.hasOwnProperty("instrumentRange")) {
        variable.$instrumentRange = new Range(options.instrumentRange);

        address_space.addVariable(variable,{
            browseName: "InstrumentRange",
            typeDefinition: "PropertyType",
            dataType:"Range",
            value: { get: function() {
                return new Variant({
                    dataType: DataType.ExtensionObject, value: variable.$instrumentRange
                });
            }}
        });
    }


    if (options.hasOwnProperty("engineeringUnits")) {

        // EngineeringUnits  specifies the units for the   DataItem‟s value (e.g., DEGC, hertz, seconds).   The
        // EUInformation   type is specified in   5.6.3.

        variable.$engineeringUnits = options.engineeringUnits;

        address_space.addVariable(variable,{
            browseName: "EngineeringUnits",
            typeDefinition: "PropertyType",
            dataType:"Range",
            value: { get: function() {
                return new Variant({
                    dataType: DataType.ExtensionObject, value: variable.$engineeringUnitsRange
                });
            }}
        });
    }

    variable.install_extra_properties();

    return variable;

}
exports.addAnalogDataItem = addAnalogDataItem;