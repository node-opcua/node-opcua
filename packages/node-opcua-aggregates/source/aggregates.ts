/**
 * @module node-opcua-aggregates
 */
import { AggregateFunction, ObjectIds, ObjectTypeIds, ReferenceTypeIds } from "node-opcua-constants";
import { coerceNodeId, makeNodeId, NodeId, NodeIdLike, resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import * as utils from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import {
    AddressSpace,
    BaseNode,
    IAddressSpace,
    UAHistoricalDataConfiguration,
    UAHistoryServerCapabilities,
    UAObject,
    UAServerCapabilities,
    UAVariable
} from "node-opcua-address-space";
import { AddressSpacePrivate } from "node-opcua-address-space/src/address_space_private";
import { BrowseDirection, coerceQualifiedName, NodeClass, NodeClassMask } from "node-opcua-data-model";
import { assert } from "node-opcua-assert";

import { AggregateConfigurationOptionsEx } from "./interval";
import { readProcessedDetails } from "./read_processed_details";

// import { HistoryServerCapabilities } from "node-opcua-server";

/*
HasProperty Variable AccessHistoryDataCapability Boolean PropertyType Mandatory
HasProperty Variable AccessHistoryEventsCapability Boolean PropertyType Mandatory
HasProperty Variable MaxReturnDataValues UInt32 PropertyType Mandatory
HasProperty Variable MaxReturnEventValues UInt32 PropertyType Mandatory
HasProperty Variable InsertDataCapability Boolean PropertyType Mandatory
HasProperty Variable ReplaceDataCapability Boolean PropertyType Mandatory
HasProperty Variable UpdateDataCapability Boolean PropertyType Mandatory
HasProperty Variable DeleteRawCapability Boolean PropertyType Mandatory
HasProperty Variable DeleteAtTimeCapability Boolean PropertyType Mandatory
HasProperty Variable InsertEventCapability Boolean PropertyType Mandatory
HasProperty Variable ReplaceEventCapability Boolean PropertyType Mandatory
HasProperty Variable UpdateEventCapability Boolean PropertyType Mandatory
HasProperty Variable DeleteEventCapability Boolean PropertyType Mandatory
HasProperty Variable InsertAnnotationsCapability Boolean PropertyType Mandatory
 */
const historicalCapabilitiesDefaultProperties /*: HistoryServerCapabilities */ = {
    accessHistoryDataCapability: true, // Boolean PropertyType Mandatory
    accessHistoryEventsCapability: true, // Boolean PropertyType Mandatory
    deleteAtTimeCapability: false, // Boolean PropertyType Mandatory
    deleteEventCapability: false, // Boolean PropertyType Mandatory
    deleteRawCapability: false, // Boolean PropertyType Mandatory
    insertAnnotationCapability: false, // Boolean PropertyType Mandatory
    insertDataCapability: false, // Boolean PropertyType Mandatory
    insertEventCapability: false, // Boolean PropertyType Mandatory
    maxReturnDataValues: 0,
    maxReturnEventValues: 0, // UInt32 PropertyType Mandatory
    replaceDataCapability: false, // Boolean PropertyType Mandatory
    replaceEventCapability: false, // Boolean PropertyType Mandatory
    updateDataCapability: false, // Boolean PropertyType Mandatory
    updateEventCapability: false // Boolean PropertyType Mandatory
};

export function createHistoryServerCapabilities(addressSpace: AddressSpace, serverCapabilities: UAServerCapabilities): UAObject {
    /* istanbul ignore next */
    if (serverCapabilities.browseName.toString() !== "ServerCapabilities") {
        throw new Error("Expecting server Capabilities");
    }

    const historyServerCapabilitiesType = addressSpace.getNamespace(0).findObjectType("HistoryServerCapabilitiesType")!;

    /* istanbul ignore next */
    if (!historyServerCapabilitiesType) {
        throw new Error("Cannot find HistoryServerCapabilitiesType");
    }
    return historyServerCapabilitiesType.instantiate({
        browseName: "HistoryServerCapabilities",
        componentOf: serverCapabilities
    });
}

function setHistoricalServerCapabilities(historyServerCapabilities: any, defaultProperties: any) {
    function setBoolean(propName: string) {
        const lowerCase = utils.lowerFirstLetter(propName);

        /* istanbul ignore next */
        if (!Object.prototype.hasOwnProperty.call(defaultProperties, lowerCase)) {
            throw new Error("cannot find " + lowerCase);
        }
        const value = defaultProperties[lowerCase];
        const prop = historyServerCapabilities.getChildByName(propName);

        /* istanbul ignore next */
        if (!prop) {
            throw new Error(" Cannot find property " + propName);
        }
        prop.setValueFromSource({ dataType: DataType.Boolean, value });
    }

    function setUInt32(propName: string) {
        const lowerCase = utils.lowerFirstLetter(propName);
        /* istanbul ignore next */
        if (!Object.prototype.hasOwnProperty.call(historyServerCapabilities, lowerCase)) {
            throw new Error("cannot find " + lowerCase);
        }
        const value = defaultProperties[lowerCase];
        const prop = historyServerCapabilities.getChildByName(propName);
        prop.setValueFromSource({ dataType: DataType.UInt32, value });
    }

    setBoolean("AccessHistoryDataCapability");
    setBoolean("AccessHistoryEventsCapability");

    setUInt32("MaxReturnDataValues");
    setUInt32("MaxReturnEventValues");

    setBoolean("InsertDataCapability");
    setBoolean("ReplaceDataCapability");
    setBoolean("UpdateDataCapability");
    setBoolean("DeleteRawCapability");
    setBoolean("DeleteAtTimeCapability");
    setBoolean("InsertEventCapability");
    setBoolean("ReplaceEventCapability");
    setBoolean("UpdateEventCapability");
    setBoolean("DeleteEventCapability");

    /// FOUND A BUG HERE spec says InsertAnnotationsCapability
    /// Standard nodeset2 says InsertAnnotationCapability ( without s )
    // xx setBoolean("InsertAnnotationsCapability");
}

interface UAHistoryServerCapabilitiesWithH extends UAServerCapabilities {
    historyServerCapabilities: UAHistoryServerCapabilities;
}

export function addAggregateFunctionSupport(addressSpace: AddressSpace, aggregateFunctionNodeId: NodeIdLike): void {
    const serverCapabilities = addressSpace.rootFolder.objects.server.serverCapabilities as UAHistoryServerCapabilitiesWithH;

    /* istanbul ignore next */
    if (!serverCapabilities.historyServerCapabilities) {
        throw new Error("missing serverCapabilities.historyServerCapabilities");
    }

    const aggregateFunctions = serverCapabilities.aggregateFunctions;

    const aggregateFunctionsInHist = serverCapabilities.historyServerCapabilities.aggregateFunctions;

    const functionNode = addressSpace.findNode(aggregateFunctionNodeId);

    /* istanbul ignore next */
    if (!functionNode) {
        throw new Error("Cannot find node " + aggregateFunctionNodeId.toString() + " in addressSpace");
    }
    /* istanbul ignore next */
    if (functionNode.nodeClass !== NodeClass.Object) {
        throw new Error("Expecting an object Node");
    }
    /* istanbul ignore next */
    if (!sameNodeId((functionNode as UAObject).typeDefinition, coerceNodeId(ObjectTypeIds.AggregateFunctionType))) {
        throw new Error("Expecting an object with TypeDefinition AggregateFunctionType");
    }

    aggregateFunctions.addReference({
        nodeId: functionNode.nodeId,
        referenceType: "Organizes"
    });
    aggregateFunctionsInHist.addReference({
        nodeId: functionNode.nodeId,
        referenceType: "Organizes"
    });
}

export function addAggregateStandardFunctionSupport(addressSpace: AddressSpace, functionName: AggregateFunction): void {
    /* istanbul ignore next */
    if (!functionName) {
        throw new Error("Invalid function name");
    }
    const functionNodeId = makeNodeId(functionName);
    addAggregateFunctionSupport(addressSpace, functionNodeId);
}

export function addAggregateSupport(addressSpace: AddressSpace, aggregatedFunctions?: AggregateFunction[]): void {
    aggregatedFunctions = aggregatedFunctions || [
        AggregateFunction.Interpolative,
        AggregateFunction.Minimum,
        AggregateFunction.Maximum,
        AggregateFunction.Average
    ];

    const aggregateConfigurationType = addressSpace.getNamespace(0).findObjectType("AggregateConfigurationType");

    /* istanbul ignore next */
    if (!aggregateConfigurationType) {
        throw new Error("addressSpace do not expose AggregateConfigurationType");
    }

    const aggregateFunctionType = addressSpace.getNamespace(0).findObjectType("AggregateFunctionType");

    /* istanbul ignore next */
    if (!aggregateFunctionType) {
        throw new Error("addressSpace do not expose AggregateFunctionType");
    }

    const serverObject = addressSpace.rootFolder.objects.getFolderElementByName("Server");

    /* istanbul ignore next */
    if (!serverObject) {
        throw new Error("addressSpace do not expose a ServerObject");
    }
    // xx serverObject.

    const serverCapabilities = serverObject.getChildByName("ServerCapabilities")! as UAServerCapabilities;

    // Let see if HistoryServer Capabilities object exists
    let historyServerCapabilities = serverCapabilities.getChildByName("HistoryServerCapabilities");

    /* istanbul ignore next */
    if (!historyServerCapabilities) {
        historyServerCapabilities = createHistoryServerCapabilities(addressSpace, serverCapabilities);
    }

    setHistoricalServerCapabilities(historyServerCapabilities, historicalCapabilitiesDefaultProperties);

    for (const f of aggregatedFunctions) {
        addAggregateStandardFunctionSupport(addressSpace, f);
    }
    const addressSpaceInternal = addressSpace as unknown as AddressSpacePrivate;
    addressSpaceInternal._readProcessedDetails = readProcessedDetails;
}

interface BaseNodeWithHistoricalDataConfiguration extends UAVariable {
    $historicalDataConfiguration: UAHistoricalDataConfiguration;
}

export function getAggregateFunctions(addressSpace: IAddressSpace): NodeId[] {
    const aggregateFunctionTypeNodeId = resolveNodeId(ObjectTypeIds.AggregateFunctionType);
    const aggregateFunctions = addressSpace.findNode(ObjectIds.Server_ServerCapabilities_AggregateFunctions) as UAObject;
    if (!aggregateFunctions) {
        return [];
    }
    const referenceDescripitions = aggregateFunctions.browseNode({
        referenceTypeId: ReferenceTypeIds.HierarchicalReferences,
        resultMask: 63,
        nodeClassMask: NodeClassMask.Object,
        browseDirection: BrowseDirection.Forward,
        includeSubtypes: true
    });
    const aggregateFunctionsNodeIds = referenceDescripitions
        .filter((a) => sameNodeId(a.typeDefinition, aggregateFunctionTypeNodeId))
        .map((a) => a.nodeId);
    return aggregateFunctionsNodeIds;
}

/**
 * Install aggregateConfiguration on an historizing variable
 * 
 * @param node the variable on which to add the aggregateConfiguration.
 * @param options the default AggregateConfigurationOptions.
 * @param aggregateFunctions the aggregatedFunctions, if not specified the aggregatedFunction of ServerCapabilities.AggregatedFunction will be used.

 */
export function installAggregateConfigurationOptions(
    node: UAVariable,
    options: AggregateConfigurationOptionsEx,
    aggregateFunctions?: NodeIdLike[]
): void {
    const nodePriv = node as BaseNodeWithHistoricalDataConfiguration;

    // istanbul ignore next
    if (!nodePriv.historizing) {
        throw new Error(
            "variable.historizing is not set\n make sure addressSpace.installHistoricalDataNode(variable) has been called"
        );
    }

    const aggregateConfiguration = nodePriv.$historicalDataConfiguration.aggregateConfiguration;

    const f = (a: number | boolean | undefined, defaultValue: number | boolean): number | boolean =>
        a === undefined ? defaultValue : a;

    aggregateConfiguration.percentDataBad.setValueFromSource({ dataType: "Byte", value: f(options.percentDataBad, 100) });
    aggregateConfiguration.percentDataGood.setValueFromSource({ dataType: "Byte", value: f(options.percentDataGood, 100) });
    aggregateConfiguration.treatUncertainAsBad.setValueFromSource({
        dataType: "Boolean",
        value: f(options.treatUncertainAsBad, false)
    });
    aggregateConfiguration.useSlopedExtrapolation.setValueFromSource({
        dataType: "Boolean",
        value: f(options.useSlopedExtrapolation, false)
    });

    nodePriv.$historicalDataConfiguration.stepped.setValueFromSource({
        dataType: "Boolean",
        value: f(options.stepped, false)
    });
    // https://reference.opcfoundation.org/v104/Core/docs/Part13/4.4/
    // Exposing Supported Functions and Capabilities
    if (!aggregateFunctions) {
        aggregateFunctions = getAggregateFunctions(node.addressSpace);
    }

    let uaAggregateFunctions = nodePriv.$historicalDataConfiguration.aggregateFunctions;
    if (!uaAggregateFunctions) {
        const namespace = nodePriv.namespace;
        uaAggregateFunctions = namespace.addObject({
            browseName: coerceQualifiedName({ name: "AggregateFunctions", namespaceIndex: 0 }),
            componentOf: nodePriv.$historicalDataConfiguration
        });
        uaAggregateFunctions = nodePriv.$historicalDataConfiguration.aggregateFunctions;
    }
    // verify that all aggregateFunctions are of type AggregateFunctionType
    // ... to do

    const referenceType = resolveNodeId(ReferenceTypeIds.Organizes);
    for (const nodeId of aggregateFunctions) {
        uaAggregateFunctions!.addReference({
            nodeId,
            referenceType,
            isForward: true
        });
    }
}

export function getAggregateConfiguration(node: BaseNode): AggregateConfigurationOptionsEx {
    const nodePriv = node as BaseNodeWithHistoricalDataConfiguration;

    /* istanbul ignore next */
    if (!nodePriv.$historicalDataConfiguration) {
        throw new Error("internal error");
    }
    const aggregateConfiguration = nodePriv.$historicalDataConfiguration.aggregateConfiguration;

    // Beware ! Stepped value comes from Historical Configuration !
    const stepped = nodePriv.$historicalDataConfiguration.stepped.readValue().value.value;

    return {
        percentDataBad: aggregateConfiguration.percentDataBad.readValue().value.value,
        percentDataGood: aggregateConfiguration.percentDataGood.readValue().value.value,
        stepped,
        treatUncertainAsBad: aggregateConfiguration.treatUncertainAsBad.readValue().value.value,
        // xx stepped:                aggregateConfiguration.stepped.readValue().value,
        useSlopedExtrapolation: aggregateConfiguration.useSlopedExtrapolation.readValue().value.value
    };
}
