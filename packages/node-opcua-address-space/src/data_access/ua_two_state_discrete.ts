import assert from "node-opcua-assert";
import { coerceLocalizedText, LocalizedText, LocalizedTextLike } from "node-opcua-data-model";
import { DataType, Variant, VariantLike } from "node-opcua-variant";
import { UATwoStateDiscrete as UATwoStateDiscretePublic } from "../../source/interfaces/data_access/ua_two_state_discrete";
import { UAVariable } from "../ua_variable";

import {
    AddTwoStateDiscreteOptions,
    Namespace,
    Property,
    UAVariable as UAVariablePublic,
    UAVariableT,
    BindVariableOptions
} from "../../source/address_space_ts";
import { VariableTypeIds } from "node-opcua-constants";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";
import { add_dataItem_stuff } from "./ua_data_item";

export interface UATwoStateDiscrete {
    falseState: UAVariableT<LocalizedText, DataType.LocalizedText>;
    trueState: UAVariableT<LocalizedText, DataType.LocalizedText>;
}
export class UATwoStateDiscrete extends UAVariable implements UATwoStateDiscretePublic {
    /*
     * @private
     */
    _post_initialize() {
        // The StatusCode SemanticsChanged bit shall be set if any of the FalseState or TrueState
        // (changes can cause misinterpretation by users or (scripting) programs) Properties are changed
        // (see section 5.2 for additional information).
        const handler = this.handle_semantic_changed.bind(this);
        this.falseState.on("value_changed", handler);
        this.trueState.on("value_changed", handler);
    }
    setValue(value: boolean | LocalizedTextLike) {
        if (typeof value === "boolean") {
            this.setValueFromSource({ dataType: DataType.Boolean, value });
        } else {
            const text: string = (typeof value === "string" ? value : value.text) || "";
            if (text === this.getTrueStateAsString()) {
                this.setValue(true);
            } else if (text === this.getFalseStateAsString()) {
                this.setValue(false);
            } else {
                throw new Error("setValue invalid value " + value);
            }
        }
    }
    getValue(): boolean {
        return this.readValue().value.value as boolean;
    }
    getValueAsString(): string {
        if (this.getValue()) {
            return this.getTrueStateAsString();
        } else {
            return this.getFalseStateAsString();
        }
    }
    getTrueStateAsString(): string {
        return (this.trueState.readValue().value.value as LocalizedText).text || "";
    }
    getFalseStateAsString(): string {
        return (this.falseState.readValue().value.value as LocalizedText).text || "";
    }

    public clone(options1: any, optionalFilter: any, extraInfo: any): UAVariable {
        const variable1 = UAVariable.prototype.clone.call(this, options1, optionalFilter, extraInfo);
        promoteToTwoStateDiscrete(variable1);
        return variable1;
    }
}
export function promoteToTwoStateDiscrete(node: UAVariablePublic): UATwoStateDiscretePublic {
    if (node instanceof UATwoStateDiscrete) {
        return node; // already promoted
    }
    Object.setPrototypeOf(node, UATwoStateDiscrete.prototype);
    assert(node instanceof UATwoStateDiscrete, "should now  be a UATwoStateDiscrete");
    const _node = node as UATwoStateDiscrete;
    _node._post_initialize();
    return _node;
}
registerNodePromoter(VariableTypeIds.TwoStateDiscreteType, promoteToTwoStateDiscrete);

export function _addTwoStateDiscrete(namespace: Namespace, options: AddTwoStateDiscreteOptions) {
    const addressSpace = namespace.addressSpace;

    assert(!options.hasOwnProperty("ValuePrecision"));

    const twoStateDiscreteType = addressSpace.findVariableType("TwoStateDiscreteType");
    if (!twoStateDiscreteType) {
        throw new Error("expecting TwoStateDiscreteType to be defined , check nodeset xml file");
    }

    let value: undefined | VariantLike | BindVariableOptions;
    if (typeof options.value === "boolean") {
        value = new Variant({ dataType: DataType.Boolean, value: !!options.value });
    } else {
        value = options.value;
    }
    // todo : if options.typeDefinition is specified,
    // todo : refactor to use twoStateDiscreteType.instantiate

    const variable = namespace.addVariable({
        accessLevel: options.accessLevel,
        browseName: options.browseName,
        componentOf: options.componentOf,
        dataType: DataType.Boolean,
        nodeId: options.nodeId,
        typeDefinition: twoStateDiscreteType.nodeId,
        userAccessLevel: options.userAccessLevel,
        modellingRule: options.modellingRule,
        minimumSamplingInterval: options.minimumSamplingInterval,
        value
    }) as UAVariable;

    /*
    const dataValueVerif = variable.readValue();
    assert(dataValueVerif.value.dataType === DataType.Boolean);
    */
    const handler = variable.handle_semantic_changed.bind(variable);

    add_dataItem_stuff(variable, options);

    const trueStateNode = namespace.addVariable({
        browseName: { name: "TrueState", namespaceIndex: 0 },
        dataType: "LocalizedText",
        minimumSamplingInterval: 0,
        propertyOf: variable,
        typeDefinition: "PropertyType",
        modellingRule: options.modellingRule ? "Mandatory" : undefined,
        value: new Variant({
            dataType: DataType.LocalizedText,
            value: coerceLocalizedText(options.trueState || "ON")
        })
    });

    trueStateNode.on("value_changed", handler);

    const falseStateNode = namespace.addVariable({
        browseName: { name: "FalseState", namespaceIndex: 0 },
        dataType: "LocalizedText",
        minimumSamplingInterval: 0,
        propertyOf: variable,
        typeDefinition: "PropertyType",
        modellingRule: options.modellingRule ? "Mandatory" : undefined,

        value: new Variant({
            dataType: DataType.LocalizedText,
            value: coerceLocalizedText(options.falseState || "OFF")
        })
    });

    falseStateNode.on("value_changed", handler);

    variable.install_extra_properties();

    return promoteToTwoStateDiscrete(variable);
}
