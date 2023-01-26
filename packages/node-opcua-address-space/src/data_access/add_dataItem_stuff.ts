/**
 * @module node-opcua-address-space.DataAccess
 */
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
//     wrote to the Server. This   difference shall be no more than the difference suggested by this  Property

import { assert } from "node-opcua-assert";
import { DataType, Variant } from "node-opcua-variant";

import { UAVariable, ModellingRuleType } from "node-opcua-address-space-base";

const definition_Description =
    "Definition  is a vendor - specific," + " human readable string that specifies how the value of this  DataItem  is calculated.";
const valuePrecision_Description = "";

interface add_dataItem_stuffOptions {
    definition?: string;
    valuePrecision?: number;
    modellingRule?: ModellingRuleType;
}
export function add_dataItem_stuff(variable: UAVariable, options: add_dataItem_stuffOptions): void {
    const addressSpace = variable.addressSpace;
    const namespace = addressSpace.getNamespace(variable.nodeId.namespace);

    if (Object.prototype.hasOwnProperty.call(options, "definition") && options.definition !== undefined) {
        namespace.addVariable({
            browseName: { name: "Definition", namespaceIndex: 0 },
            dataType: "String",
            description: definition_Description,
            minimumSamplingInterval: 0,
            modellingRule: options.modellingRule ? "Mandatory" : undefined,
            propertyOf: variable,
            typeDefinition: "PropertyType",
            value: new Variant({ dataType: DataType.String, value: options.definition })
        });
    }

    if (Object.prototype.hasOwnProperty.call(options, "valuePrecision") && options.valuePrecision !== undefined) {
        assert(typeof options.valuePrecision === "number");

        namespace.addVariable({
            browseName: { name: "ValuePrecision", namespaceIndex: 0 },
            dataType: "Double",
            description: valuePrecision_Description,
            minimumSamplingInterval: 0,
            modellingRule: options.modellingRule ? "Mandatory" : undefined,
            propertyOf: variable,
            typeDefinition: "PropertyType",
            value: new Variant({ dataType: DataType.Double, value: options.valuePrecision })
        });
    }
}
