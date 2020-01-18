import {
    BaseNode,
    UADataType,
    UAMethod,
    UAObject,
    UAObjectType,
    UAReference,
    UAReferenceType,
    UAVariable,
    UAVariableType,
} from "node-opcua-address-space";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { displayNodeElement } from ".";
import { NodeClass } from "node-opcua-data-model";


type UAType = UAObjectType | UAVariableType | UAReferenceType | UADataType;

type UAConcrete = UAVariable | UAObject | UAMethod;

// find the reference that links node1 to node2
function findReferenceToNode(node1: BaseNode, node2: BaseNode): UAReference {
    const references = node1.allReferences();
    const r = references.filter((ref: UAReference) => {
        //xx console.log(ref.nodeId.toString(), node2.nodeId.toString());
        return ref.nodeId.toString() === node2.nodeId.toString()
    });
    const ref = r ? r[0] : null;
    /* instanbul ignore next */
    if (!ref) {
        // may be from subtype
        if (node1.nodeClass === NodeClass.ObjectType ||
            node1.nodeClass == NodeClass.ReferenceType ||
            node1.nodeClass === NodeClass.VariableType) {

            const uaType = node1 as UAType;
            if (uaType.subtypeOfObj) {
                return findReferenceToNode(uaType.subtypeOfObj, node2);
            }
        }

        console.log(node1.toString());
        console.log(node2.toString());
        throw new Error("Internal Error cannot find ref from node "
            + node1.nodeId.toString() + " " + node2.nodeId.toString());
    }
    return ref;
}


export function promoteToMandatory(
    node: UAObjectType | UAVariableType,
    propertyName: string,
    namespaceIndex: number): UAConcrete {
    // get base node

    const addressSpace = node.addressSpace;

    const superType = node.subtypeOfObj!;
    /* istanbul ignore next */
    if (!superType) {
        throw new Error("Expecting a super type");
    }

    const browseResult = addressSpace.browsePath(makeBrowsePath(superType.nodeId,
        `.${namespaceIndex}:${propertyName}`));
    const propNodeId = (!browseResult.targets || !browseResult.targets[0]) ? null : browseResult.targets[0].targetId!;

    /* istanbul ignore next */
    if (!propNodeId) {
        displayNodeElement(superType);
        throw new Error("property " + propertyName + " do not exists on " + superType.browseName.toString() + " or any superType");
    }

    const propInSuperType = addressSpace.findNode(propNodeId)! as UAVariable | UAMethod | UAObject;

    /* istanbul ignore next */
    if (!propInSuperType) {
        throw new Error("cannot find " + propNodeId.toString());
    }

    // check mandatory
    /* istanbul ignore next */
    if (propInSuperType.modellingRule == "Mandatory") {
        console.log("Warning property " + propertyName + " is already Mandatory in super type");
        return propInSuperType;
    }
    // replicate property
    const ref = findReferenceToNode(superType, propInSuperType);

    /* istanbul ignore next */
    if (!ref) {
        throw new Error("Ref");
    }
    console.log(ref.toString());

    const newRef: UAReference = { isForward: false, nodeId: node.nodeId, referenceType: ref.referenceType };

    const newProp = (propInSuperType as UAConcrete).clone({
        references: [newRef],
        modellingRule: "Mandatory"
    }, null, null);
    //xx console.log(node.toString());
    //xxconsole.log(newProp.toString());
    return newProp;
}
