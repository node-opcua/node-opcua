import { describeWithLeakDetector as describe } from "node-opcua-leak-detector";
import { nodesets } from "node-opcua-nodesets";
import should from "should";
import { AddressSpace, type UAObject, type UAObjectType } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

/**
 * An instance declaration carries the placeholders of its type that it asks for.
 *
 * A member built with instantiate() inside a type got its type's Mandatory members, but none of
 * its placeholders, even when asked through `optionals`. The OPC Foundation ModelCompiler emits
 * the ones the design declares: OPC 10000-100 DI DeviceType/DeviceTypeImage/<ImageIdentifier>
 * (DI i=6210), OPC 40301 Glass ProductionPlanType/<OrderedObject>/InputMaterials/<InputMaterial>.
 * It does not emit the others (DI TopologyElementType/Identification has no <GroupIdentifier>),
 * so a placeholder not asked for stays out. An instance still takes no placeholder.
 */
describe("an instance declaration carries the placeholders it asks for (instantiate inside a type)", () => {
    let addressSpace: AddressSpace;
    let listType: UAObjectType;
    let jobType: UAObjectType;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        addressSpace.registerNamespace("Private");
        await generateAddressSpace(addressSpace, [nodesets.standard]);
        const ns = addressSpace.getOwnNamespace();
        listType = ns.addObjectType({ browseName: "ProgramListType" });
        ns.addObject({
            browseName: "<OrderedObject>",
            componentOf: listType,
            typeDefinition: "BaseObjectType",
            modellingRule: "OptionalPlaceholder"
        });
        jobType = ns.addObjectType({ browseName: "ProductionJobType" });
        listType.instantiate({
            browseName: "ProductionPrograms",
            componentOf: jobType,
            modellingRule: "Mandatory",
            optionals: ["<OrderedObject>"]
        });
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    const children = (node: UAObject) => node.getAggregates().map((c) => `${c.browseName.toString()} ${c.modellingRule}`);

    it("PIID-1 the member of the type carries the placeholder, with its modelling rule", () => {
        const programs = jobType.getComponentByName("ProductionPrograms") as UAObject;
        should(children(programs)).eql(["1:<OrderedObject> OptionalPlaceholder"]);
    });

    it("PIID-3 a placeholder not asked for stays out", () => {
        listType.instantiate({ browseName: "ArchivedPrograms", componentOf: jobType, modellingRule: "Optional" });
        const archived = jobType.getComponentByName("ArchivedPrograms") as UAObject;
        should(children(archived)).eql([]);
    });

    it("PIID-2 an instance of the type still takes no placeholder", () => {
        const job = jobType.instantiate({ browseName: "Job", organizedBy: addressSpace.rootFolder.objects });
        const programs = job.getComponentByName("ProductionPrograms") as UAObject;
        should(programs).be.ok();
        should(children(programs)).eql([]);
    });
});
