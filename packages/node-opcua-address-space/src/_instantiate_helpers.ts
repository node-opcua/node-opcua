/**
 * @module node-opcua-address-space
 */
// tslint:disable:max-classes-per-file
// tslint:disable:no-console
import chalk from "chalk";
import {
    CloneHelper,
    reconstructFunctionalGroupType,
    reconstructNonHierarchicalReferences,
    type UAMethod,
    type UAObject,
    type UAObjectType,
    type UAVariable,
    type UAVariableType
} from "node-opcua-address-space-base";
import { BrowseDirection } from "node-opcua-data-model";
import { checkDebugFlag, make_errorLog, make_warningLog } from "node-opcua-debug";
import { resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { makeOptionalsMap, type OptionalMap } from "../source/helpers/make_optionals_map";
import { MandatoryChildOrRequestedOptionalFilter } from "./_mandatory_child_or_requested_optional_filter";
import { _clone_hierarchical_references } from "./base_node_private";

// const debugLog = make_debugLog("INSTANTIATE");
// const doDebug = checkDebugFlag("INSTANTIATE");
const warningLog = make_warningLog("INSTANTIATE");
const errorLog = make_errorLog("INSTANTIATE");

// eslint-disable-next-line prefer-const
const doTrace = checkDebugFlag("INSTANTIATE");
const traceLog = errorLog;

// install properties and components on a instantiated Object
//
// based on their ModelingRule
//  => Mandatory                 => Installed
//  => Optional                  => Not Installed , unless it appear in optionals array
//  => OptionalPlaceHolder       => Not Installed
//  => null (no modelling rule ) => Not Installed
//

function _initialize_properties_and_components<B extends UAObject | UAVariable | UAMethod, T extends UAObjectType | UAVariableType>(
    instance: B,
    topMostType: T,
    typeDefinitionNode: T,
    copyAlsoModellingRules: boolean,
    copyAlsoAllOptionals: boolean,
    optionalsMap: OptionalMap,
    extraInfo: CloneHelper,
    browseNameMap: Set<string>
) {
    if (doTrace) {
        warningLog("instance browseName =", instance.browseName.toString());
        warningLog("typeNode            =", typeDefinitionNode.browseName.toString());
        warningLog("optionalsMap        =", Object.keys(optionalsMap).join(" "));

        const c = typeDefinitionNode.findReferencesEx("Aggregates");
        warningLog("typeDefinition aggregates      =", c.map((x) => x.node?.browseName.toString()).join(" "));
    }
    optionalsMap = optionalsMap || {};

    if (sameNodeId(topMostType.nodeId, typeDefinitionNode.nodeId)) {
        return; // nothing to do
    }

    const filter = new MandatoryChildOrRequestedOptionalFilter(instance, copyAlsoAllOptionals, optionalsMap);

    doTrace &&
        traceLog(
            chalk.cyan(extraInfo.pad(), "cloning relevant member of typeDefinition class"),
            `${typeDefinitionNode.browseName.toString()}\n optionals${JSON.stringify(optionalsMap)}`
        );

    _clone_hierarchical_references(typeDefinitionNode, instance, copyAlsoModellingRules, filter, extraInfo, browseNameMap);

    // now apply recursion on baseTypeDefinition  to get properties and components from base class

    const baseTypeDefinitionNodeId = typeDefinitionNode.subtypeOf;
    const baseTypeDefinition = typeDefinitionNode.subtypeOfObj;

    doTrace &&
        traceLog(
            chalk.cyan(
                extraInfo.pad(),
                "now apply recursion on baseTypeDefinition  to get properties and components from base class"
            ),
            baseTypeDefinition ? baseTypeDefinition.browseName.toString() : "undefined"
        );

    // c8 ignore next
    if (!baseTypeDefinition) {
        throw new Error(chalk.red("Cannot find object with nodeId ") + baseTypeDefinitionNodeId);
    }
    extraInfo.level++;
    _initialize_properties_and_components(
        instance,
        topMostType,
        baseTypeDefinition,
        copyAlsoModellingRules,
        copyAlsoAllOptionals,
        optionalsMap,
        extraInfo,
        browseNameMap
    );
    extraInfo.level--;
}

export function initialize_properties_and_components<
    B extends UAObject | UAVariable | UAMethod,
    T extends UAVariableType | UAObjectType
>(
    instance: B,
    topMostType: T,
    nodeType: T,
    copyAlsoModellingRules: boolean,
    copyAlsoAllOptionals: boolean,
    optionals?: string[]
): void {
    const extraInfo = new CloneHelper();

    extraInfo.pushContext({
        clonedParent: instance,
        originalParent: nodeType
    });
    extraInfo.registerClonedObject({
        clonedNode: instance,
        originalNode: nodeType
    });

    const optionalsMap = makeOptionalsMap(optionals);

    const browseNameMap = new Set<string>();

    _initialize_properties_and_components(
        instance,
        topMostType,
        nodeType,
        copyAlsoModellingRules,
        copyAlsoAllOptionals,
        optionalsMap,
        extraInfo,
        browseNameMap
    );

    // instantiate optionals from interfaces
    instantiate_interface_children<B>(
        nodeType,
        extraInfo,
        instance,
        copyAlsoModellingRules,
        copyAlsoAllOptionals,
        optionalsMap,
        browseNameMap
    );

    reconstructFunctionalGroupType(extraInfo);

    reconstructNonHierarchicalReferences(extraInfo);
}

function instantiate_interface_children<B extends UAObject | UAVariable | UAMethod>(
    nodeType: UAObjectType | UAVariableType,
    extraInfo: CloneHelper,
    instance: B,
    copyAlsoModellingRules: boolean,
    copyAlsoAllOptionals: boolean,
    optionalsMap: OptionalMap,
    browseNameMap: Set<string>
) {
    const interfaces = nodeType.findReferencesEx(resolveNodeId("HasInterface"), BrowseDirection.Forward);
    if (interfaces.length === 0) {
        return;
    }
    for (const reference of interfaces) {
        const interfaceType = (reference.node as UAObjectType) || nodeType.addressSpace.findObjectType(reference.nodeId);
        if (!interfaceType) {
            warningLog(" cannot find node ", reference.nodeId.toString());
            continue;
        }
        const topMostTypeBaseInterface = nodeType.addressSpace.findObjectType("BaseInterfaceType");
        if (!topMostTypeBaseInterface) {
            throw new Error("cannot find BaseInterfaceType");
        }
        doTrace &&
            traceLog(
                chalk.cyan(extraInfo.pad(), "instantiating optionals from interface"),
                `${interfaceType.browseName.toString()}`
            );
        _initialize_properties_and_components(
            instance,
            topMostTypeBaseInterface,
            interfaceType,
            copyAlsoModellingRules,
            copyAlsoAllOptionals,
            optionalsMap,
            extraInfo,
            browseNameMap
        );
    }
}
