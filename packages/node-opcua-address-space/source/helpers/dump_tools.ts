/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-console
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { BrowseDirection } from "node-opcua-data-model";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { BrowseDescription, BrowseDescriptionOptions, ReferenceDescription } from "node-opcua-types";

import { IAddressSpace, BaseNode, UAReference, UAReferenceType as UAReferenceTypePublic } from "node-opcua-address-space-base";

import { resolveReferenceType } from "../../src/reference_impl";

export function referenceTypeToString(addressSpace: IAddressSpace, referenceTypeId: NodeIdLike | null): string {
    // istanbul ignore next
    if (!referenceTypeId) {
        return "<null> ";
    } else {
        const referenceType = addressSpace.findNode(referenceTypeId)! as UAReferenceTypePublic;
        return referenceTypeId.toString() + " " + referenceType.browseName.toString() + "/" + referenceType.inverseName!.text;
    }
}

function nodeIdInfo(addressSpace: IAddressSpace, nodeId: NodeId): string {
    const obj = addressSpace.findNode(nodeId);
    const name = obj ? obj.browseName.toString() : " <????>";
    return nodeId.toString() + " [ " + name + " ]";
}

export function dumpReferenceDescription(addressSpace: IAddressSpace, referenceDescription: ReferenceDescription): void {
    assert(referenceDescription.referenceTypeId); // must be known;

    console.log(chalk.red("referenceDescription"));
    console.log("    referenceTypeId : ", referenceTypeToString(addressSpace, referenceDescription.referenceTypeId));
    console.log("    isForward       : ", referenceDescription.isForward ? "true" : "false");
    console.log("    nodeId          : ", nodeIdInfo(addressSpace, referenceDescription.nodeId));
    console.log("    browseName      : ", referenceDescription.browseName.toString());
    console.log("    nodeClass       : ", referenceDescription.nodeClass.toString());
    console.log("    typeDefinition  : ", nodeIdInfo(addressSpace, referenceDescription.typeDefinition));
}

export function dumpReferenceDescriptions(addressSpace: IAddressSpace, referenceDescriptions: ReferenceDescription[]): void {
    referenceDescriptions.forEach((r: ReferenceDescription) => dumpReferenceDescription(addressSpace, r));
}

export function dumpBrowseDescription(node: BaseNode, _browseDescription: BrowseDescriptionOptions): void {
    const browseDescription = new BrowseDescription(_browseDescription);

    const addressSpace = node.addressSpace;

    console.log(" Browse Node :");

    if (browseDescription.nodeId) {
        console.log(" nodeId : ", chalk.cyan(browseDescription.nodeId.toString()));
    }

    console.log(" nodeId : ", chalk.cyan(node.browseName.toString()), "(", node.nodeId.toString(), ")");
    console.log("   referenceTypeId :", referenceTypeToString(addressSpace, browseDescription.referenceTypeId));

    console.log("   browseDirection :", chalk.cyan(BrowseDirection[browseDescription.browseDirection]));
    console.log("   includeSubType  :", browseDescription.includeSubtypes ? "true" : "false");
    console.log("   nodeClassMask   :", browseDescription.nodeClassMask);
    console.log("   resultMask      :", browseDescription.resultMask);
}

/**
 * @method dumpReferences
 * @param addressSpace    {IAddressSpace}
 * @param references  {Array<Reference>|null}
 * @static
 */
export function dumpReferences(addressSpace: IAddressSpace, references: UAReference[]): void {
    assert(addressSpace);
    for (const reference of references) {
        const referenceType = resolveReferenceType(addressSpace, reference);
        if (!referenceType) {
            // unknown type ... this may happen when the address space is not fully build
            return;
        }
        const dir = reference.isForward ? "(=>)" : "(<-)";
        const objectName = nodeIdInfo(addressSpace, reference.nodeId);
        console.log(
            " referenceType : ",
            dir,
            referenceType ? referenceType.browseName.toString() : reference.referenceType.toString(),
            " ",
            objectName
        );
    }
}
