/**
 * @module node-opcua-address-space
 *
 * OPC 10000-8 (Data Access) 5.2: some Properties of a DataItem carry the *meaning* of its
 * value rather than the value itself. When one of them changes, a client that has cached the
 * old meaning would misinterpret every subsequent value, so the Server has to say so: the
 * next data change notification of the DataItem carries the SemanticsChanged bit of
 * OPC 10000-4 7.39.
 *
 * The address space side of that is `UAVariable#handle_semantic_changed()`, which bumps
 * `semantic_version`; the MonitoredItem watches that counter. What was missing is the wiring
 * between a Property and its DataItem: the `addAnalogDataItem` / `addTwoStateDiscrete` /
 * `addMultiStateDiscrete` helpers each attached a "value_changed" listener by hand, so only a
 * node built through one of those helpers was covered. A DataItem instantiated from its
 * VariableType, loaded from a NodeSet, or assembled property by property (which is the only
 * way to build the ArrayItemType subtypes) had none, and its EURange could be written without
 * any notification ever carrying the bit.
 *
 * So the relation is resolved from the Property instead, at the moment its value changes:
 * a Property named after one of the semantics-bearing Properties below, whose parent is a
 * DataItem, notifies that parent. That covers every way a DataItem can come into existence,
 * and needs no bookkeeping at construction time - which is what defeated a creation-time hook,
 * since a hand-built DataItem gets its Properties *after* the Variable itself.
 */
import type { UAVariable, UAVariableType } from "node-opcua-address-space-base";
import { VariableTypeIds } from "node-opcua-constants";
import { NodeClass } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";

/**
 * the Properties whose value carries the semantics of the DataItem they belong to.
 *
 * DataItemType             : Definition, ValuePrecision
 * AnalogItemType/UnitType  : EURange, InstrumentRange, EngineeringUnits
 * ArrayItemType (+subtypes): Title, AxisScaleType, XAxisDefinition, YAxisDefinition, ZAxisDefinition
 * TwoStateDiscreteType     : TrueState, FalseState
 * MultiStateDiscreteType   : EnumStrings
 * MultiStateValueDiscrete  : EnumValues
 */
const semanticsBearingProperties = new Set<string>([
    "AxisScaleType",
    "Definition",
    "EngineeringUnits",
    "EURange",
    "EnumStrings",
    "EnumValues",
    "FalseState",
    "InstrumentRange",
    "Title",
    "TrueState",
    "ValuePrecision",
    "XAxisDefinition",
    "YAxisDefinition",
    "ZAxisDefinition"
]);

const dataItemTypeNodeId = resolveNodeId(VariableTypeIds.DataItemType);

/**
 * the DataItem whose semantics `property` carries, or null when `property` is not one of them.
 *
 * A positive answer is memoized on the Property; a negative one is not, because the name test
 * that gates the lookup is a single Set hit and because a Property can be attached to its
 * DataItem after its first value change.
 */
function semanticsOwnerOf(property: UAVariable): UAVariable | null {
    const name = property.browseName.name;
    if (!name || !semanticsBearingProperties.has(name)) {
        return null;
    }
    const cache = property as UAVariable & { $$semanticsOwner?: UAVariable };
    if (cache.$$semanticsOwner) {
        return cache.$$semanticsOwner;
    }
    const parent = property.parent;
    if (!parent || parent.nodeClass !== NodeClass.Variable) {
        return null;
    }
    const dataItem = parent as UAVariable;
    const typeDefinition = dataItem.typeDefinitionObj;
    if (!typeDefinition || typeDefinition.nodeClass !== NodeClass.VariableType) {
        return null;
    }
    const dataItemType = dataItem.addressSpace.findNode(dataItemTypeNodeId) as UAVariableType | null;
    if (!dataItemType || !typeDefinition.isSubtypeOf(dataItemType)) {
        return null;
    }
    cache.$$semanticsOwner = dataItem;
    return dataItem;
}

/**
 * called whenever a Variable's value really changed: if that Variable is a semantics-bearing
 * Property of a DataItem, the DataItem's semantic_version is bumped so that the next data
 * change notification of the DataItem carries the SemanticsChanged bit.
 */
export function notifySemanticsChangedIfNeeded(property: UAVariable): void {
    const dataItem = semanticsOwnerOf(property);
    if (dataItem) {
        (dataItem as UAVariable & { handle_semantic_changed: (dataValue?: unknown) => void }).handle_semantic_changed();
    }
}
