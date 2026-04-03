/**
 * Reference test nodes for CTT conformance testing.
 */
import type { Namespace, UAObject } from "node-opcua-address-space";

export function addNodeWithReferences(namespace: Namespace, simulation_folder: UAObject): void {
    const parent = simulation_folder;
    const referenceFolder = namespace.addObject({
        browseName: "References",
        nodeId: "s=Demo.CTT.References",
        organizedBy: parent,
        typeDefinition: "FolderType"
    });

    // --- Has3ForwardReferences1: 3 variable components ---
    {
        const has3ForwardReferences1 = namespace.addObject({
            browseName: "Has3ForwardReferences1",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences1",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        namespace.addVariable({ browseName: "ReferenceNode1", componentOf: has3ForwardReferences1, dataType: "UInt32" });
        namespace.addVariable({ browseName: "ReferenceNode2", componentOf: has3ForwardReferences1, dataType: "UInt32" });
        namespace.addVariable({ browseName: "ReferenceNode3", componentOf: has3ForwardReferences1, dataType: "UInt32" });
    }

    // --- Has3ForwardReferences2: variable + 3 methods + property ---
    {
        const has3ForwardReferences2 = namespace.addObject({
            browseName: "Has3ForwardReferences2",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences2",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        namespace.addVariable({ browseName: "BaseDataVariable", componentOf: has3ForwardReferences2, dataType: "UInt32" });
        namespace.addMethod(has3ForwardReferences2, { browseName: "Method1" });
        namespace.addMethod(has3ForwardReferences2, { browseName: "Method2" });
        namespace.addMethod(has3ForwardReferences2, { browseName: "Method3" });
        namespace.addVariable({ browseName: "Property", propertyOf: has3ForwardReferences2, dataType: "UInt32" });
    }

    // --- Has3ForwardReferences3 + Has3InverseReferences ---
    {
        const has3ForwardReferences3 = namespace.addObject({
            browseName: "Has3ForwardReferences3",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences3",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        const referencedNode1 = namespace.addFolder(has3ForwardReferences3, "ReferencedNode1");
        const referencedNode2 = namespace.addFolder(has3ForwardReferences3, "ReferencedNode2");
        const referencedNode3 = namespace.addFolder(has3ForwardReferences3, "ReferencedNode3");

        const has3InverseReferences = namespace.addObject({
            browseName: "Has3InverseReferences",
            nodeId: "s=Demo.CTT.References.Has3InverseReferences",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });

        referencedNode1.addReference({ referenceType: "Organizes", nodeId: has3InverseReferences });
        referencedNode2.addReference({ referenceType: "Organizes", nodeId: has3InverseReferences });
        referencedNode3.addReference({ referenceType: "Organizes", nodeId: has3InverseReferences });
    }

    // --- Has3ForwardReferences4: 3 properties ---
    {
        const has3ForwardReferences4 = namespace.addObject({
            browseName: "Has3ForwardReferences4",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences4",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        namespace.addVariable({ browseName: "ReferenceNode1", propertyOf: has3ForwardReferences4, dataType: "UInt32" });
        namespace.addVariable({ browseName: "ReferenceNode2", propertyOf: has3ForwardReferences4, dataType: "UInt32" });
        namespace.addVariable({ browseName: "ReferenceNode3", propertyOf: has3ForwardReferences4, dataType: "UInt32" });
    }

    // --- Has3ForwardReferences5: folder + property + method ---
    {
        const has3ForwardReferences5 = namespace.addObject({
            browseName: "Has3ForwardReferences5",
            nodeId: "s=Demo.CTT.References.Has3ForwardReferences5",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        namespace.addFolder(has3ForwardReferences5, { browseName: "ReferenceNode1" });
        namespace.addVariable({ browseName: "ReferenceNode2", propertyOf: has3ForwardReferences5, dataType: "UInt32" });
        namespace.addMethod(has3ForwardReferences5, { browseName: "ReferenceNode3" });
    }

    // --- HasInverseAndForwardReferences ---
    {
        const hasInverseAndForwardReferences = namespace.addObject({
            browseName: "HasInverseAndForwardReferences",
            nodeId: "s=Demo.CTT.References.HasInverseAndForwardReferences",
            componentOf: referenceFolder,
            typeDefinition: "FolderType"
        });
        const nodeId = namespace.addFolder(hasInverseAndForwardReferences, { browseName: "ReferenceNode1" });
        hasInverseAndForwardReferences.addReference({ nodeId, referenceType: "AlarmGroupMember" });
    }

    // --- HasReferencesWithDifferentParentTypes ---
    namespace.addObject({
        browseName: "HasReferencesWithDifferentParentTypes",
        nodeId: "s=Demo.CTT.References.HasReferencesWithDifferentParentTypes",
        componentOf: referenceFolder,
        typeDefinition: "FolderType"
    });

    // --- HasReferencesOfAReferenceTypeAndSubType ---
    {
        const hasReferencesOfAReferenceTypeAndSubType = namespace.addObject({
            browseName: "HasReferencesOfAReferenceTypeAndSubType",
            nodeId: "s=Demo.CTT.References.HasReferencesOfAReferenceTypeAndSubType",
            typeDefinition: "FolderType",
            componentOf: referenceFolder
        });
        namespace.addVariable({ browseName: "ReferenceNode1", propertyOf: hasReferencesOfAReferenceTypeAndSubType, dataType: "UInt32" });
        namespace.addVariable({ browseName: "ReferenceNode2", propertyOf: hasReferencesOfAReferenceTypeAndSubType, dataType: "UInt32" });
        namespace.addVariable({ browseName: "ReferenceNode3", propertyOf: hasReferencesOfAReferenceTypeAndSubType, dataType: "UInt32" });
        namespace.addVariable({ browseName: "ReferenceNode4", propertyOf: hasReferencesOfAReferenceTypeAndSubType, dataType: "UInt32" });
        for (let i = 0; i < 4; i++) {
            const a = namespace.addObject({ browseName: `AlarmSuppressionGroup${i}`, componentOf: referenceFolder });
            hasReferencesOfAReferenceTypeAndSubType.addReference({ nodeId: a, referenceType: "HasAlarmSuppressionGroup" });
        }
    }
}
