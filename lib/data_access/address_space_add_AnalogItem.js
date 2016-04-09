"use strict";
// HasProperty  Variable  InstrumentRange  Range  PropertyType  Optional
// HasProperty  Variable  EURange  Range  PropertyType  Mandatory
// HasProperty  Variable  EngineeringUnits  EUInformation  PropertyType  Optional

require("requirish")._(module);
var assert = require("better-assert");
var DataType = require("lib/datamodel/variant").DataType;
var Variant = require("lib/datamodel/variant").Variant;
var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;
var EUInformation = require("lib/data_access/EUInformation").EUInformation;
var Range = require("lib/data_access/Range").Range;

var add_dataItem_stuff = require("./UADataItem").add_dataItem_stuff;
var _ = require("underscore");


exports.install = function (AddressSpace) {

    /**
     * @method addDataItem
     * @param options
     * @param options.browseName {String}
     * @param options.definition {String}
     * @param [options.valuePrecision {Double |null} =null]
     * @param options.dataType {NodeId} // todo :check
     * @param options.value
     * @param options.componentOf
     * @return {UAVariable}
     */
    AddressSpace.prototype.addDataItem = function(options) {

        var addressSpace = this;
        assert(addressSpace instanceof AddressSpace);
        var dataType = options.dataType || "Number";

        var dataItemType = addressSpace.findVariableType("DataItemType");

        var variable = addressSpace.addVariable(_.extend(options, {
            typeDefinition: dataItemType.nodeId,
            dataType:       dataType
        }));

        add_dataItem_stuff(variable, options);

        variable.install_extra_properties();
        return variable;
    };


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
     *   addressSpace.add_analog_dataItem({
     *      componentOf: parentObject,
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
     * @return {UAVariable}
     */
    AddressSpace.prototype.addAnalogDataItem = function (options) {

        var addressSpace = this;

        assert(options.hasOwnProperty("engineeringUnitsRange"), "expecting engineeringUnitsRange");

        var dataType = options.dataType || "Number";

        var analogItemType = addressSpace.findVariableType("AnalogItemType");
        assert(analogItemType, "expecting AnalogItemType to be defined , check nodeset xml file");


        var clone_options = _.clone(options);

        clone_options = _.extend(clone_options, {
            typeDefinition: analogItemType.nodeId,
            dataType:       dataType
        });
        var variable = addressSpace.addVariable(clone_options);

        //var variable = addressSpace.addVariable({
        //    componentOf:     options.componentOf,
        //    organizedBy:     options.organizedBy,
        //    browseName:      options.browseName,
        //    nodeId:          options.nodeId,
        //    value:           options.value,
        //    accessLevel:     options.accessLevel,
        //    userAccessLevel: options.userAccessLevel,
        //    modellingRule:   options.modellingRule
        //
        //    typeDefinition: analogItemType.nodeId,
        //    dataType:       dataType,
        //});


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

        addressSpace.addVariable({
            propertyOf: variable,
            typeDefinition: "PropertyType",
            browseName: "EURange",
            dataType: "Range",
            minimumSamplingInterval: 0,
            value: new Variant({
                dataType: DataType.ExtensionObject, value: new Range(options.engineeringUnitsRange)
            }),
            modellingRule: options.modellingRule
        });

        if (options.hasOwnProperty("instrumentRange")) {

            addressSpace.addVariable({
                propertyOf: variable,
                typeDefinition: "PropertyType",
                browseName: "InstrumentRange",
                dataType: "Range",
                minimumSamplingInterval: 0,
                accessLevel: "CurrentRead",
                value: new Variant({
                    dataType: DataType.ExtensionObject, value: new Range(options.instrumentRange)
                }),
                modellingRule: options.modellingRule ? "Mandatory" : undefined
            });
        }

        if (options.hasOwnProperty("engineeringUnits")) {

            var engineeringUnits = new EUInformation(options.engineeringUnits);
            assert(engineeringUnits instanceof EUInformation, "expecting engineering units");

            // EngineeringUnits  specifies the units for the   DataItem‟s value (e.g., DEGC, hertz, seconds).   The
            // EUInformation   type is specified in   5.6.3.

            addressSpace.addVariable({
                propertyOf: variable,
                typeDefinition: "PropertyType",
                browseName: "EngineeringUnits",
                dataType: "EUInformation",
                minimumSamplingInterval: 0,
                accessLevel: "CurrentRead",
                value: new Variant({
                    dataType: DataType.ExtensionObject, value: engineeringUnits
                }),
                modellingRule: options.modellingRule ? "Mandatory" : undefined
            });
        }

        variable.install_extra_properties();

        return variable;

    };
};


