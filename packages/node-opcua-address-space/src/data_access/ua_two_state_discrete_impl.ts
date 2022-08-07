import assert from "node-opcua-assert";
import { coerceLocalizedText, LocalizedText, LocalizedTextLike, QualifiedNameLike } from "node-opcua-data-model";
import { DataType, Variant, VariantLike } from "node-opcua-variant";
import { VariableTypeIds } from "node-opcua-constants";
import { INamespace, UAVariable, BindVariableOptions, UAProperty, ISessionContext } from "node-opcua-address-space-base";
import { DataValueT } from "node-opcua-data-value";
import { NumericRange } from "node-opcua-numeric-range";

import { UAVariableImpl } from "../ua_variable_impl";
import { registerNodePromoter } from "../../source/loader/register_node_promoter";
import { AddTwoStateDiscreteOptions } from "../../source/address_space_ts";
import { UATwoStateDiscreteEx } from "../../source/interfaces/data_access/ua_two_state_discrete_ex";

import { add_dataItem_stuff } from "./add_dataItem_stuff";

export interface UATwoStateDiscreteImpl {
    falseState: UAProperty<LocalizedText, /*c*/ DataType.LocalizedText>;
    trueState: UAProperty<LocalizedText, /*c*/ DataType.LocalizedText>;

    readValue(
        context?: ISessionContext | null,
        indexRange?: NumericRange,
        dataEncoding?: QualifiedNameLike | null
    ): DataValueT<boolean, DataType.Boolean>;

    readValueAsync(context: ISessionContext | null, callback?: any): any;
}
export class UATwoStateDiscreteImpl extends UAVariableImpl implements UATwoStateDiscreteEx {
    /*
     * @private
     */
    _post_initialize(): void {
        // The StatusCode SemanticsChanged bit shall be set if any of the FalseState or TrueState
        // (changes can cause misinterpretation by users or (scripting) programs) Properties are changed
        // (see section 5.2 for additional information).
        const handler = this.handle_semantic_changed.bind(this);

        const falseState = this.getPropertyByName("FalseState");
        /* istanbul ignore else */
        if (falseState) {
            falseState.on("value_changed", handler);
        } else {
            console.warn(
                "warning: UATwoStateDiscrete -> a FalseState property is mandatory ",
                this.browseName.toString(),
                this.nodeId.toString()
            );
        }
        const trueState = this.getPropertyByName("TrueState");
        /* istanbul ignore else */
        if (trueState) {
            trueState.on("value_changed", handler);
        } else {
            console.warn(
                "waring: UATwoStateDiscrete -> a TrueState property is mandatory",
                this.browseName.toString(),
                this.nodeId.toString()
            );
        }
    }
    setValue(value: boolean | LocalizedTextLike): void {
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
        const variable1 = UAVariableImpl.prototype.clone.call(this, options1, optionalFilter, extraInfo);
        promoteToTwoStateDiscrete(variable1);
        return variable1;
    }
}

export function promoteToTwoStateDiscrete(node: UAVariable): UATwoStateDiscreteEx {
    if (node instanceof UATwoStateDiscreteImpl) {
        return node as unknown as UATwoStateDiscreteEx; // already promoted
    }
    Object.setPrototypeOf(node, UATwoStateDiscreteImpl.prototype);
    assert(node instanceof UATwoStateDiscreteImpl, "should now  be a UATwoStateDiscrete");
    const _node = node as UATwoStateDiscreteImpl;
    _node._post_initialize();
    return _node as unknown as UATwoStateDiscreteEx;
}
registerNodePromoter(VariableTypeIds.TwoStateDiscreteType, promoteToTwoStateDiscrete);

export function _addTwoStateDiscrete(namespace: INamespace, options: AddTwoStateDiscreteOptions): UATwoStateDiscreteEx {
    const addressSpace = namespace.addressSpace;

    assert(!Object.prototype.hasOwnProperty.call(options, "ValuePrecision"));

    const twoStateDiscreteType = addressSpace.findVariableType("TwoStateDiscreteType");
    if (!twoStateDiscreteType) {
        throw new Error("expecting TwoStateDiscreteType to be defined , check nodeset xml file");
    }

    let value: undefined | BindVariableOptions;
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
    const handler = (variable as UAVariableImpl).handle_semantic_changed.bind(variable);

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
