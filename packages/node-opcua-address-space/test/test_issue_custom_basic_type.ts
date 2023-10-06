import { StatusCodes } from "node-opcua-status-code";
import "should";
import { DataType, Variant } from "node-opcua-variant";
import { AddressSpace } from "..";
import { generateAddressSpace } from "../distNodeJS";
import { get_mini_nodeset_filename } from "../testHelpers";

const mini_nodeset_filename = get_mini_nodeset_filename();

describe("variable with a custom basic dataType", () => {
    let addressSpace: AddressSpace;

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        const xml_files = [mini_nodeset_filename];
        await generateAddressSpace(addressSpace, xml_files);
        addressSpace.registerNamespace("Private");
    });
    afterEach(() => {
        if (addressSpace) {
            addressSpace.dispose();
        }
    });
    it("should be to write a variable with a custom basic dataType", async () => {
        // Given a custom basic dataType
        const customTypeNamespace = addressSpace.registerNamespace("http://myorganisation.org/customTypes");

        const customDataType = customTypeNamespace.createDataType({
            browseName: "INT",
            subtypeOf: "Int16",
            isAbstract: false
        });

        // Given a variable with this custom basic dataType
        const namespace = addressSpace.getOwnNamespace();

        const parent = namespace.addFolder(addressSpace.rootFolder.objects, {
            browseName: "Parent"
        });
        const variant = new Variant({
            dataType: DataType.Int16,
            value: 1
        });

        const uaVariable = namespace.addVariable({
            componentOf: parent,
            nodeId: "s=testVar",
            browseName: "testVar",
            minimumSamplingInterval: 500,
            dataType: customDataType!,
            value: variant
        });

        // When I set the value directly to the variable (using setValueFromSource)
        uaVariable.setValueFromSource({
            dataType: DataType.Int16,
            value: 2
        });
        // Then it should succeed
        uaVariable.readValue().value.value.should.eql(2);

        // When I write to this variable using its basic dataType using writeAttribute

        const statusCode = await uaVariable.writeAttribute(null, {
            attributeId: 13,
            value: {
                value: {
                    dataType: DataType.Int16,
                    value: 3
                }
            }
        });

        // Then it should work !
        statusCode.should.eql(StatusCodes.Good);
        uaVariable.readValue().value.value.should.eql(3);
    });
});
