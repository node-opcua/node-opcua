import { assert } from "node-opcua-assert";
import { BaseNode, UAMethod, UAObject, UAReference, UAVariable, CloneFilter, fullPath2 } from "node-opcua-address-space-base";
import { checkDebugFlag, make_debugLog, make_warningLog, make_errorLog } from "node-opcua-debug";
import { BrowseDirection } from "node-opcua-data-model";

import { _clone_hierarchical_references } from "./base_node_private";

// const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);
const errorLog = make_errorLog(__filename);
const doTrace = checkDebugFlag("INSTANTIATE");
const traceLog = errorLog;

export type OptionalMap = Record<string, string | Record<string, any>>;
export class MandatoryChildOrRequestedOptionalFilter implements CloneFilter {
    private readonly instance: BaseNode;
    private readonly optionalsMap: OptionalMap;
    private readonly references: UAReference[];
    private readonly copyAlsoAllOptionals: boolean = false;

    constructor(instance: BaseNode, copyAlsoAllOptionals: boolean, optionalsMap: OptionalMap) {
        this.copyAlsoAllOptionals = copyAlsoAllOptionals;
        // should we clone the node to be a component or propertyOf of a instance
        assert(null !== instance);
        this.optionalsMap = optionalsMap;
        this.instance = instance;
        this.references = instance.findReferencesEx("Aggregates", BrowseDirection.Forward);
    }

    public shouldKeep(node: BaseNode): boolean {
        const addressSpace = node.addressSpace;

        const alreadyIn = this.references.filter((r: UAReference) => {
            const n = addressSpace.findNode(r.nodeId)!;
            // istanbul ignore next
            if (!n) {
                warningLog(" cannot find node ", r.nodeId.toString());
                return false;
            }
            return n.browseName!.name!.toString() === node.browseName!.name!.toString();
        });

        if (alreadyIn.length > 0) {
            assert(alreadyIn.length === 1, "Duplication found ?");
            // a child with the same browse name has already been install
            // probably from a SuperClass, we should ignore this.
            return false; // ignore
        }

        const modellingRule = node.modellingRule;

        switch (modellingRule) {
            case null:
            case undefined:
                // istanbul ignore next
                doTrace &&
                    traceLog(
                        "node ",
                        fullPath2(node),
                        " has no modellingRule ",
                        node ? fullPath2(node) : ""
                    );
                /**
                 * in some badly generated NodeSet2.xml file, the modellingRule is not specified
                 *
                 * but in some other NodeSet2.xml, this means that the data are only attached to the Type node and shall not be
                 * instantiate in the corresponding instance (example is the state variable of a finite state machine that are only
                 * defined in the Type node)
                 *
                 * we should not consider it as an error, and treat it as not present
                 */
                return false;

            case "Mandatory":
                return true; // keep;
            case "Optional":
                // only if in requested optionals
                return this.copyAlsoAllOptionals || (node.browseName!.name! in this.optionalsMap);
            case "OptionalPlaceholder":
                return false; // ignored
            default:
                return false; // ignored
        }
    }

    public filterFor(childInstance: UAVariable | UAObject | UAMethod): CloneFilter {
        const browseName: string = childInstance.browseName.name!;

        let map: OptionalMap = Object.create(null);

        if (browseName in this.optionalsMap) {
            map = this.optionalsMap[browseName] as any;
        }
        // istanbul ignore next
        doTrace && traceLog("filterFor ", browseName, map);
        const newFilter = new MandatoryChildOrRequestedOptionalFilter(childInstance, false, map);
        return newFilter;
    }
}
