/**
 * Simulation (dynamic) variables that change randomly on a timer.
 */
import type { Namespace, UAObject, UAVariable } from "node-opcua-address-space";
import { assert } from "node-opcua-assert";
import { isValidBoolean, isValidUInt16 } from "node-opcua-basic-types";
import { DataType, Variant, VariantArrayType } from "node-opcua-variant";

import { addVariable, findDataType, getRandomFuncForType } from "./helpers";
import { typeAndDefaultValue } from "./type_defaults";

export function addSimulationVariables(namespace: Namespace, scalarFolder: UAObject): void {
    let values_to_change: { dataType: DataType; randomFunc: () => unknown; variable: UAVariable }[] = [];

    function add_simulation_variable(parent: UAObject, dataTypeName: string, defaultValue: unknown, realTypeName: string): UAVariable {
        realTypeName = realTypeName || dataTypeName;
        const dataType = findDataType(realTypeName);
        const randomFunc = getRandomFuncForType(dataType);

        // c8 ignore next
        if (typeof randomFunc !== "function") {
            throw new Error(`a random function must exist for basicType ${dataTypeName}`);
        }

        const variable = addVariable(namespace, parent, dataTypeName, realTypeName, defaultValue, -1, null, "");
        values_to_change.push({ dataType, randomFunc, variable });
        return variable;
    }

    const simulation = namespace.addObject({
        browseName: "Scalar_Simulation",
        description: "This folder will contain one item per supported data-type.",
        nodeId: "s=Scalar_Simulation",
        organizedBy: scalarFolder
    });

    for (const e of typeAndDefaultValue) {
        const dataType = e.type;
        const defaultValue = typeof e.defaultValue === "function" ? e.defaultValue() : e.defaultValue;
        const realType = e.realType || dataType;
        add_simulation_variable(simulation, dataType, defaultValue, realType);
    }

    // Management nodes
    let interval = 2000;
    let enabled = true;
    let timer: NodeJS.Timeout | undefined;

    function change_randomly() {
        for (const element of values_to_change) {
            const variant = (element.variable as unknown as Record<string, { variant: Variant }>)._backdoor_placeholder.variant;
            variant.value = element.randomFunc();
            element.variable.setValueFromSource(variant);
        }
    }

    function delete_Timer() {
        if (timer) {
            try {
                clearInterval(timer);
            } catch (_err) {
                /* c8 ignore next */
                // the leak detector may throw if the timer handle is already disposed
            }
            timer = undefined;
        }
    }

    function install_Timer() {
        delete_Timer();
        assert(!timer);
        if (enabled) {
            timer = setInterval(() => {
                change_randomly();
            }, interval);
        }
    }

    function tearDown_Timer() {
        delete_Timer();
        values_to_change = [];
    }

    const intervalVariable = namespace.addVariable({
        browseName: "Interval",
        componentOf: simulation,
        dataType: "UInt16",
        description: { locale: "en", text: "The rate (in msec) of change for all Simulated items." },
        nodeId: "s=Scalar_Simulation_Interval",
        value: new Variant({
            arrayType: VariantArrayType.Scalar,
            dataType: DataType.UInt16,
            value: interval
        })
    });

    intervalVariable.on("value_changed", (dataValue /*,indexRange*/) => {
        const variant = dataValue.value;
        assert(variant instanceof Variant);
        assert(isValidUInt16(variant.value), " value must be valid for dataType");
        interval = variant.value;
        install_Timer();
    });

    const enabledVariable = namespace.addVariable({
        componentOf: simulation,
        browseName: "Enabled",
        description: { locale: "en", text: "Enabled" },
        nodeId: "s=Scalar_Simulation_Enabled",
        dataType: "Boolean",
        value: new Variant({
            dataType: DataType.Boolean,
            arrayType: VariantArrayType.Scalar,
            value: enabled
        })
    });

    enabledVariable.on("value_changed", (dataValue /*,indexRange*/) => {
        const variant = dataValue.value;
        assert(variant instanceof Variant);
        assert(isValidBoolean(variant.value), " value must be valid for dataType");
        enabled = variant.value;
        install_Timer();
    });
    install_Timer();

    const addressSpace = namespace.addressSpace;
    addressSpace.registerShutdownTask(tearDown_Timer);
}
