import * as fs from "fs";
import * as path from "path";
import "should";
import { nodesets } from "node-opcua-nodesets";
import { AttributeIds } from "node-opcua-basic-types";
import { AddressSpace, SessionContext, UAObject, UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

describe("Testing loading nodeset with extension objects values in types", () => {
    let addressSpace: AddressSpace;

    const xml_file1 = path.join(__dirname, "../test_helpers/test_fixtures/variabletype_with_value.xml");
    fs.existsSync(xml_file1).should.be.eql(true, " should find " + xml_file1);
    
    const xml_file2 = path.join(__dirname, "../test_helpers/test_fixtures/variable_with_value.xml");
    fs.existsSync(xml_file2).should.be.eql(true, " should find " + xml_file2);
    
    const context = SessionContext.defaultContext;
    
    beforeEach(async () => {
        addressSpace = AddressSpace.create();
    });
    afterEach(() => {
        addressSpace.dispose();
    });
    it("LNEX1- should load nodeset with extension objects", async () => {
        // const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/plc_demo.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file1]);

        const nsSterfive = addressSpace.getNamespaceIndex("http://sterfive.com/Small_model/");
        const connectionDetailsType = addressSpace.findVariableType("ConnectionDetailsType", nsSterfive)!;

        console.log(connectionDetailsType.toString());
        const value = connectionDetailsType.readAttribute(context, AttributeIds.Value).value;
        console.log(value.toString());
        value.value.constructor.name.should.eql("ConnectionDetails");

        //
        const certificateVariable = connectionDetailsType.getChildByName("Certificates")! as UAVariable;
        const urlVariable = connectionDetailsType.getChildByName("Url")! as UAVariable;

        console.log(certificateVariable.toString());
        console.log(urlVariable.toString());
    });

    it("LNEX2- should load nodeset with array extension objects", async () => {
        // const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/plc_demo.xml");
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file1, xml_file2]);

        const nsSterfive = addressSpace.getNamespaceIndex("http://sterfive.com/Small_model/");
        nsSterfive.should.be.greaterThanOrEqual(0);
        
        const nsSterfiveInstance = addressSpace.getNamespaceIndex("http://sterfive.com/Small_instance/");
        nsSterfiveInstance.should.be.greaterThanOrEqual(0);
        
        const myTestObject = addressSpace.findNode(`ns=${nsSterfiveInstance};i=5002`)! as UAObject;

        const connectionDetailDataType = addressSpace.findDataType("ConnectionDetails",nsSterfive );
        console.log(connectionDetailDataType.toString());
        
        console.log(myTestObject.toString());

        const primaryConnection = myTestObject.getChildByName("PrimaryConnection")! as UAVariable;
        const otherConnections = myTestObject.getChildByName("OtherConnections")! as UAVariable;
        const connection2WithOptionalFields = myTestObject.getChildByName("Connection2WithOptionalFields")! as UAVariable;

        const c1 = addressSpace.constructExtensionObject(connectionDetailDataType,{
            certificates: Buffer.from("Hello World"),
            url: "http://10.0.19.120",
        });


        console.log("primaryConnection\n", primaryConnection.toString());
        console.log("otherConnections\n", otherConnections.toString());
        console.log("connection2WithOptionalFields\n", connection2WithOptionalFields.toString());

    });
});
