import { AddressSpace } from "..";
import { generateAddressSpace } from "../distNodeJS";
import { get_mini_nodeset_filename } from "../testHelpers";
import "should";

const mini_nodeset_filename = get_mini_nodeset_filename();

describe("setDescription", () => {
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
    it("should be possible to change the description of a variable", () => {
        const namespace = addressSpace.getOwnNamespace();

        const uaVariable = namespace.addVariable({
            browseName: "MyVariable",
            dataType: "Double",
            organizedBy: addressSpace.rootFolder.objects,
            description: {locale: "fr", text:"Ma Variable"}
        });

        uaVariable.description.text!.should.eql("Ma Variable");


        uaVariable.setDescription({ locale: "fi", text: "minun muuttujani" });

        uaVariable.description.text!.should.eql("minun muuttujani");

    });
});
