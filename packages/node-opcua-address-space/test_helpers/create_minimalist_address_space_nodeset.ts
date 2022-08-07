/* eslint-disable max-statements */
/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-console
// tslint:disable:max-line-length

import * as chalk from "chalk";
import { assert } from "node-opcua-assert";
import { DataTypeIds, ObjectIds, ObjectTypeIds, ReferenceTypeIds, VariableTypeIds } from "node-opcua-constants";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";

import { AddReferenceOpts, AddressSpace, UAFolder, UAObject, UAReferenceType, UAVariableType } from "..";

const doDebug = false;

function dumpReferencesHierarchy(_addressSpace: AddressSpace) {
    const addressSpace = _addressSpace;

    function _dump(referenceType: UAReferenceType, level: string) {
        console.log(
            level,
            referenceType.browseName.toString(),
            "(",
            chalk.green(
                referenceType
                    .getAllSubtypes()
                    .map((x: any) => x.browseName.toString())
                    .join(" ")
            ),
            ")"
        );

        const subTypes = referenceType.findReferencesExAsObject("HasSubtype");
        for (const subType of subTypes) {
            _dump(subType as UAReferenceType, "     " + level);
        }
    }

    const references = addressSpace.findReferenceType(ReferenceTypeIds.References)!;

    _dump(references, " ");
}

export function create_minimalist_address_space_nodeset(addressSpace: AddressSpace): void {
    const _addressSpace = addressSpace;

    const namespace0 = addressSpace.registerNamespace("http://opcfoundation.org/UA/");

    assert(namespace0.index === 0);

    function addReferenceType(browseName_: string, isAbstract?: boolean, subtypeOf?: UAReferenceType): UAReferenceType {
        const tmp = browseName_.split("/");
        const inverseName = tmp[1] as string;
        const browseName = tmp[0] as string;

        const options = {
            browseName,
            inverseName,
            isAbstract,
            nodeClass: NodeClass.ReferenceType,
            nodeId: resolveNodeId((ReferenceTypeIds as any)[browseName]),
            references: [] as AddReferenceOpts[],
            subtypeOf
        };

        const hasSubType = resolveNodeId("HasSubtype");
        if (subtypeOf) {
            options.references.push({
                isForward: false,
                nodeId: subtypeOf.nodeId,
                referenceType: hasSubType
            });
        }
        const node = namespace0.internalCreateNode(options);

        node.propagate_back_references();

        return node as UAReferenceType;
    }

    // add references
    {
        // before we do any thing , we need to create the HasSubtype reference
        // which is required in the first to create the hierachy of References
        const hasSubtype = addReferenceType("HasSubtype/HasSupertype");

        const references = addReferenceType("References", true);
        {
            const nonHierarchicalReferences = addReferenceType("NonHierarchicalReferences", true, references);
            {
                const hasTypeDefinition = addReferenceType("HasTypeDefinition/TypeDefinitionOf", false, nonHierarchicalReferences);
                const hasModellingRule = addReferenceType("HasModellingRule/ModellingRuleOf", false, nonHierarchicalReferences);
                const hasEncoding = addReferenceType("HasEncoding/EncodingOf", false, nonHierarchicalReferences);
            }
        }
        {
            const hierarchicalReferences = addReferenceType("HierarchicalReferences", true, references);
            {
                const hasChild = addReferenceType("HasChild/ChildOf", true, hierarchicalReferences);
                {
                    const aggregates = addReferenceType("Aggregates/AggregatedBy", true, hasChild);
                    {
                        const hasComponent = addReferenceType("HasComponent/ComponentOf", false, aggregates);
                        const hasProperty = addReferenceType("HasProperty/PropertyOf", false, aggregates);
                        const hasHistoricalConfiguration = addReferenceType(
                            "HasHistoricalConfiguration/HistoricalConfigurationOf",
                            false,
                            aggregates
                        );
                    }
                }
                {
                    // add a link to hasSubType
                    hasSubtype.addReference({
                        isForward: false,
                        nodeId: hasChild,
                        referenceType: hasSubtype
                    });
                }
            }
            {
                const organizes = addReferenceType("Organizes/OrganizedBy", false, hierarchicalReferences);
            }
            {
                const hasEventSource = addReferenceType("HasEventSource/EventSourceOf", false, hierarchicalReferences);
            }
        }
    }

    if (doDebug) {
        dumpReferencesHierarchy(addressSpace);
    }

    const baseObjectType = namespace0.internalCreateNode({
        browseName: "BaseObjectType",
        isAbstract: true,
        nodeClass: NodeClass.ObjectType,
        nodeId: resolveNodeId(ObjectTypeIds.BaseObjectType)
    });

    const baseVariableType = namespace0.internalCreateNode({
        browseName: "BaseVariableType",
        isAbstract: true,
        nodeClass: NodeClass.VariableType,
        nodeId: resolveNodeId(VariableTypeIds.BaseVariableType)
    }) as any as UAVariableType;

    const propertyType = namespace0.addVariableType({
        browseName: "PropertyType",
        subtypeOf: baseVariableType
    });

    const baseDataVariableType = namespace0.internalCreateNode({
        browseName: "BaseDataVariableType",
        isAbstract: true,
        nodeClass: NodeClass.VariableType,
        nodeId: resolveNodeId(VariableTypeIds.BaseDataVariableType),
        subtypeOf: baseVariableType.nodeId
    }) as any as UAVariableType;

    const modellingRule_Optional = namespace0.internalCreateNode({
        browseName: "Optional",
        nodeClass: NodeClass.Object,
        nodeId: resolveNodeId(ObjectIds.ModellingRule_Optional)
    }) as any as UAObject;

    const modellingRule_Mandatory = namespace0.internalCreateNode({
        browseName: "Mandatory",
        nodeClass: NodeClass.Object,
        nodeId: resolveNodeId(ObjectIds.ModellingRule_Mandatory)
    }) as any as UAObject;

    // add the root folder
    {
        const rootFolder = namespace0.internalCreateNode({
            browseName: "RootFolder",
            nodeClass: NodeClass.Object,
            nodeId: resolveNodeId(ObjectIds.RootFolder)
        }) as any as UAObject;

        {
            const objectsFolder = namespace0.addObject({
                browseName: "Objects",
                nodeId: resolveNodeId(ObjectIds.ObjectsFolder),
                organizedBy: rootFolder
            });

            assert(rootFolder.getFolderElementByName("Objects")!.browseName.toString() === "Objects");
        }
        {
            const dataTypeFolder = namespace0.addObject({
                browseName: "DataType",
                nodeId: resolveNodeId(ObjectIds.DataTypesFolder),
                organizedBy: rootFolder
            });
            {
                const doubleDataType = namespace0.internalCreateNode({
                    browseName: "Double",
                    nodeClass: NodeClass.DataType,
                    nodeId: resolveNodeId(DataTypeIds.Double),
                    organizedBy: dataTypeFolder
                });
            }
        }
    }
}
