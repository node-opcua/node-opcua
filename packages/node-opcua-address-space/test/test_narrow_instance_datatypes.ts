import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { resolveNodeId, sameNodeId } from "node-opcua-nodeid";
import { nodesets } from "node-opcua-nodesets";
import { DataType } from "node-opcua-variant";
import should from "should";
import {
    AddressSpace,
    narrowInstanceDataTypes,
    type UADataType,
    type UAObject,
    type UAObjectType,
    type UAVariable
} from "../dist/api/index.js";
import { generateAddressSpace } from "../nodeJS.js";

const SemanticVersionString = resolveNodeId("i=24263");
const String_ = resolveNodeId("i=12");
const DI_URI = "http://opcfoundation.org/UA/DI/";

function dataTypeAttribute(variable: UAVariable) {
    const dataValue = variable.readAttribute(null, AttributeIds.DataType);
    dataValue.value.dataType.should.eql(DataType.NodeId);
    return dataValue.value.value;
}

/**
 * every member of the NamespaceMetadata objects whose DataType is a strict supertype of what
 * NamespaceMetadataType declares for it: what OPC 10000-3 forbids and the CTT reports
 */
function namespaceMetadataMembersWiderThanDeclared(addressSpace: AddressSpace): string[] {
    const metadataType = addressSpace.findObjectType("NamespaceMetadataType");
    should.exist(metadataType);
    const namespaces = addressSpace.findNode("i=11715") as UAObject;
    should.exist(namespaces);
    const offenders: string[] = [];
    for (const namespaceObject of namespaces.getComponents()) {
        for (const member of namespaceObject.findReferencesExAsObject("Aggregates")) {
            if (member.nodeClass !== NodeClass.Variable) {
                continue;
            }
            const declared = metadataType!.getChildByName(member.browseName) as UAVariable | null;
            if (!declared || declared.nodeClass !== NodeClass.Variable) {
                continue;
            }
            const instanceDataType = addressSpace.findDataType((member as UAVariable).dataType) as UADataType;
            const declaredDataType = addressSpace.findDataType(declared.dataType) as UADataType;
            if (sameNodeId(instanceDataType.nodeId, declaredDataType.nodeId)) {
                continue;
            }
            if (declaredDataType.isSubtypeOf(instanceDataType)) {
                offenders.push(
                    `${namespaceObject.browseName.toString()}/${member.browseName.toString()}: ` +
                        `${instanceDataType.browseName.toString()} wider than ${declaredDataType.browseName.toString()}`
                );
            }
        }
    }
    return offenders;
}

describe("narrowing instance DataTypes to their declaration at load", function (this: Mocha.Suite) {
    this.timeout(200000);

    describe("the DI nodeset over the standard one", () => {
        let addressSpace: AddressSpace;
        before(async () => {
            addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, [nodesets.standard, nodesets.di]);
        });
        after(() => {
            addressSpace.dispose();
        });

        it("NamespaceMetadataType still declares ModelVersion as SemanticVersionString", () => {
            const metadataType = addressSpace.findObjectType("NamespaceMetadataType")!;
            const declared = metadataType.getChildByName("ModelVersion") as UAVariable;
            should.exist(declared);
            declared.dataType.toString().should.eql(SemanticVersionString.toString());
        });

        it("the DI namespace ModelVersion, declared String by the DI nodeset, reads SemanticVersionString", () => {
            const di = addressSpace.getNamespaceIndex(DI_URI);
            di.should.be.greaterThan(0);
            const modelVersion = addressSpace.findNode(`ns=${di};i=489`) as UAVariable;
            should.exist(modelVersion);
            should(modelVersion.browseName.name).eql("ModelVersion");
            modelVersion.dataType.toString().should.eql(SemanticVersionString.toString());
            dataTypeAttribute(modelVersion).toString().should.eql(SemanticVersionString.toString());
        });

        it("its value is untouched: still the String 1.5.0", () => {
            const di = addressSpace.getNamespaceIndex(DI_URI);
            const modelVersion = addressSpace.findNode(`ns=${di};i=489`) as UAVariable;
            const dataValue = modelVersion.readValue();
            dataValue.statusCode.isGood().should.eql(true);
            dataValue.value.dataType.should.eql(DataType.String);
            dataValue.value.value.should.eql("1.5.0");
        });

        it("a second sweep finds nothing left to narrow", () => {
            narrowInstanceDataTypes(addressSpace).should.eql([]);
        });
    });

    describe("what the sweep leaves alone", () => {
        let addressSpace: AddressSpace;
        let objectType: UAObjectType;
        let instance: UAObject;
        before(async () => {
            addressSpace = AddressSpace.create();
            await generateAddressSpace(addressSpace, [nodesets.standard]);
            const namespace = addressSpace.registerNamespace("urn:feat32");

            objectType = namespace.addObjectType({ browseName: "Feat32Type" });
            namespace.addVariable({
                browseName: "Version",
                dataType: "SemanticVersionString",
                modellingRule: "Mandatory",
                propertyOf: objectType
            });
            namespace.addVariable({
                browseName: "Measure",
                dataType: "Double",
                modellingRule: "Optional",
                propertyOf: objectType
            });
            namespace.addVariable({
                browseName: "Anything",
                dataType: "Number",
                modellingRule: "Optional",
                propertyOf: objectType
            });
            namespace.addVariable({
                browseName: "Tag",
                dataType: "SemanticVersionString",
                modellingRule: "Optional",
                propertyOf: objectType
            });
            // a member nested below a declared member whose own type says nothing about it
            const group = namespace.addObject({
                browseName: "Group",
                componentOf: objectType,
                modellingRule: "Mandatory",
                typeDefinition: "FolderType"
            });
            namespace.addVariable({
                browseName: "GroupVersion",
                dataType: "SemanticVersionString",
                modellingRule: "Mandatory",
                propertyOf: group
            });

            // the instance is assembled by hand, with the DataTypes a companion nodeset could carry
            instance = namespace.addObject({
                browseName: "Feat32Instance",
                organizedBy: addressSpace.rootFolder.objects,
                typeDefinition: objectType
            });
            const add = (browseName: string, dataType: string, value?: { dataType: DataType; value: unknown }) =>
                namespace.addVariable({ browseName, dataType, propertyOf: instance, value });
            add("Version", "String", { dataType: DataType.String, value: "1.0.0" });
            add("Measure", "Number", { dataType: DataType.Int32, value: 42 });
            add("Anything", "Double", { dataType: DataType.Double, value: 1.5 });
            add("Tag", "Int32", { dataType: DataType.Int32, value: 7 });
            const instanceGroup = namespace.addObject({ browseName: "Group", componentOf: instance, typeDefinition: "FolderType" });
            namespace.addVariable({
                browseName: "GroupVersion",
                dataType: "String",
                propertyOf: instanceGroup,
                value: { dataType: DataType.String, value: "2.0.0" }
            });
        });
        after(() => {
            addressSpace.dispose();
        });

        let narrowed: ReturnType<typeof narrowInstanceDataTypes>;
        before(() => {
            narrowed = narrowInstanceDataTypes(addressSpace);
        });

        it("narrows a member whose DataType is a strict supertype of the declared one", () => {
            const version = instance.getPropertyByName("Version") as UAVariable;
            version.dataType.toString().should.eql(SemanticVersionString.toString());
            version.readValue().value.value.should.eql("1.0.0");
        });

        it("narrows a member nested below a declared member, through the container's declaration", () => {
            const group = instance.getComponentByName("Group") as UAObject;
            const version = group.getPropertyByName("GroupVersion") as UAVariable;
            version.dataType.toString().should.eql(SemanticVersionString.toString());
        });

        it("leaves a member whose DataType is a subtype of the declared one", () => {
            const anything = instance.getPropertyByName("Anything") as UAVariable;
            anything.dataType.toString().should.eql(resolveNodeId("Double").toString());
        });

        it("leaves a member whose DataType is unrelated to the declared one", () => {
            const tag = instance.getPropertyByName("Tag") as UAVariable;
            tag.dataType.toString().should.eql(resolveNodeId("Int32").toString());
            tag.readValue().value.value.should.eql(7);
        });

        it("leaves a member whose value would not fit the declared built-in type", () => {
            const measure = instance.getPropertyByName("Measure") as UAVariable;
            measure.dataType.toString().should.eql(resolveNodeId("Number").toString());
            measure.readValue().value.dataType.should.eql(DataType.Int32);
        });

        it("leaves the declarations of the type itself", () => {
            const declared = objectType.getPropertyByName("Version") as UAVariable;
            declared.dataType.toString().should.eql(SemanticVersionString.toString());
            const measure = objectType.getPropertyByName("Measure") as UAVariable;
            measure.dataType.toString().should.eql(resolveNodeId("Double").toString());
        });

        it("reports exactly the nodes it moved", () => {
            narrowed
                .map((n) => `${n.node.browseName.name}:${n.from.toString()}->${n.to.toString()}`)
                .sort()
                .should.eql([
                    `GroupVersion:${String_.toString()}->${SemanticVersionString.toString()}`,
                    `Version:${String_.toString()}->${SemanticVersionString.toString()}`
                ]);
        });

        it("has nothing left to do on a second pass", () => {
            narrowInstanceDataTypes(addressSpace).should.eql([]);
        });
    });

    describe("the companion nodesets", () => {
        it("no NamespaceMetadata member is wider than NamespaceMetadataType declares, after loading standard + DI + ADI + more", async () => {
            const addressSpace = AddressSpace.create();
            try {
                await generateAddressSpace(addressSpace, [
                    nodesets.standard,
                    nodesets.di,
                    nodesets.adi,
                    nodesets.autoId,
                    nodesets.ia,
                    nodesets.machinery,
                    nodesets.gds
                ]);
                namespaceMetadataMembersWiderThanDeclared(addressSpace).should.eql([]);
                narrowInstanceDataTypes(addressSpace).should.eql([]);
            } finally {
                addressSpace.dispose();
            }
        });
    });
});
