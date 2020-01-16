import {
    BaseNode,
    UAObjectType,
    UAVariableType,
    UAVariable,
    UAMethod,
    UAObject,
    UAReference
} from "node-opcua-address-space";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { displayNodeElement } from ".";


// find the reference that links node1 to node2
function findReferenceToNode(node1: BaseNode, node2: BaseNode): UAReference {
    const references = node1.allReferences();
    const r = references.filter((ref: UAReference) => {
        //xx console.log(ref.nodeId.toString(), node2.nodeId.toString());
        return ref.nodeId.toString() === node2.nodeId.toString()
    });
    const ref = r ? r[0] : null;
    if (!ref) {
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
    namespaceIndex: number) {
    // get base node

    const addressSpace = node.addressSpace;

    const superType = node.subtypeOfObj!;
    if (!superType) {
        throw new Error("Expecting a super type");
    }

    const browseResult = addressSpace.browsePath(makeBrowsePath(superType.nodeId,
        `.${namespaceIndex}:${propertyName}`));
    const propNodeId = (!browseResult.targets || !browseResult.targets[0]) ? null : browseResult.targets[0].targetId!;
    if (!propNodeId) {
        displayNodeElement(superType);
        throw new Error("property " + propertyName + " do not exists on " + superType.browseName.toString());
    }
    const propInSuperType = addressSpace.findNode(propNodeId)! as UAVariable | UAMethod | UAObject;
    if (!propInSuperType) {
        throw new Error("cannot find " + propNodeId.toString());
    }
    // check mandatory
    if (propInSuperType.modellingRule == "Mandatory") {
        console.log("Warning property " + propertyName + " is already Mandatory in super type");
        return;
    }
    // replicate property
    const ref = findReferenceToNode(superType, propInSuperType);
    if (!ref) {
        throw new Error("Ref");
    }
    console.log(ref.toString());

    const newRef: UAReference = { isForward: false, nodeId: node.nodeId, referenceType: ref.referenceType };

    const newProp = (propInSuperType as UAVariable).clone({
        references: [newRef],
        modellingRule: "Mandatory"
    });
    console.log(node.toString());
    console.log(newProp.toString());
}
