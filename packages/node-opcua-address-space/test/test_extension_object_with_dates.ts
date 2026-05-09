import path from "node:path";
import { nodesets } from "node-opcua-nodesets";
import { StatusCodes } from "node-opcua-status-code";
import type { CallMethodResultOptions } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import should from "should";
import { AddressSpace, type ISessionContext, SessionContext, type UAMethod, type UAObject, type UAVariable } from "..";
import { generateAddressSpace } from "../nodeJS";

describe("Testing loading nodeset with extension objects containing DateTime values", function (this: Mocha.Suite) {
    this.timeout(200000);

    let addressSpace: AddressSpace;
    const context = SessionContext.defaultContext;

    const xml_file = path.join(__dirname, "../test_helpers/test_fixtures/extension_object_with_dates.xml");

    beforeEach(async () => {
        addressSpace = AddressSpace.create();
        await generateAddressSpace(addressSpace, [nodesets.standard, xml_file]);
    });
    afterEach(() => {
        addressSpace.dispose();
    });

    it("EOD-1 should load the nodeset without error", () => {
        const nsMyCompany = addressSpace.getNamespaceIndex("http://my-company.com");
        nsMyCompany.should.be.greaterThanOrEqual(1);
    });

    it("EOD-2 should find the BasicComplexData datatype with a dateTime field", () => {
        const nsMyCompany = addressSpace.getNamespaceIndex("http://my-company.com");
        const basicComplexDataType = addressSpace.findDataType("BasicComplexData", nsMyCompany);
        should.exist(basicComplexDataType, "BasicComplexData datatype should exist");
    });

    it("EOD-3 should read basicComplexData variable with a DateTime value in extension object", () => {
        const nsMyCompany = addressSpace.getNamespaceIndex("http://my-company.com");

        // ns=1;i=6029 is the basicComplexData variable
        const basicComplexDataVar = addressSpace.findNode(`ns=${nsMyCompany};i=6029`) as UAVariable;
        should.exist(basicComplexDataVar, "basicComplexData variable should exist");

        const dataValue = basicComplexDataVar.readValue(context);
        dataValue.value.dataType.should.eql(DataType.ExtensionObject);

        const extObj = dataValue.value.value;
        should.exist(extObj, "extension object value should exist");

        // The dateTime field should be a Date with value 2026-02-06T10:30:00.000Z
        extObj.dateTime.should.be.instanceof(Date);
        extObj.dateTime.toISOString().should.eql("2026-02-06T10:30:00.000Z");

        // verify other scalar fields are present
        extObj.boolean.should.eql(false);
        extObj.int32.should.eql(0);
        extObj.double.should.eql(0);
        extObj.float.should.eql(0);
    });

    it("EOD-4 should read the dateTime component variable", () => {
        const nsMyCompany = addressSpace.getNamespaceIndex("http://my-company.com");

        // ns=1;i=6009 is the dateTime sub-variable
        const dateTimeVar = addressSpace.findNode(`ns=${nsMyCompany};i=6009`) as UAVariable;
        should.exist(dateTimeVar, "dateTime component variable should exist");
        should(dateTimeVar.browseName.name).eql("dateTime");
    });

    it("EOD-5 should read complexDataWithComplexArray containing nested BasicComplexData with dateTime", () => {
        const nsMyCompany = addressSpace.getNamespaceIndex("http://my-company.com");

        // ns=1;i=6034 is the complexDataWithComplexArray variable
        const complexVar = addressSpace.findNode(`ns=${nsMyCompany};i=6034`) as UAVariable;
        should.exist(complexVar, "complexDataWithComplexArray variable should exist");

        const dataValue = complexVar.readValue(context);
        dataValue.value.dataType.should.eql(DataType.ExtensionObject);

        const extObj = dataValue.value.value;
        should.exist(extObj);

        extObj.name.should.eql("test");

        // The complexDataArray field should contain BasicComplexData entries with dateTime
        extObj.complexDataArray.should.be.an.Array();
        extObj.complexDataArray.length.should.be.greaterThanOrEqual(1);

        const nested = extObj.complexDataArray[0];
        nested.dateTime.should.be.instanceof(Date);
        nested.dateTime.toISOString().should.eql("2026-02-06T10:30:00.000Z");
    });

    it("EOD-6 should call callBasicComplexData method and verify the variable is updated with new DateTime", async () => {
        const nsMyCompany = addressSpace.getNamespaceIndex("http://my-company.com");

        // find the basicComplexData variable (ns=1;i=6029)
        const basicComplexDataVar = addressSpace.findNode(`ns=${nsMyCompany};i=6029`) as UAVariable;
        should.exist(basicComplexDataVar, "basicComplexData variable should exist");

        // find the callBasicComplexData method (ns=1;i=7000)
        const callBasicComplexDataMethod = addressSpace.findNode(`ns=${nsMyCompany};i=7000`) as UAMethod;
        should.exist(callBasicComplexDataMethod, "callBasicComplexData method should exist");

        // find the parent object (ns=1;i=5007 - ComplexData)
        const complexDataObject = addressSpace.findNode(`ns=${nsMyCompany};i=5007`) as UAObject;
        should.exist(complexDataObject, "ComplexData object should exist");

        // bind the method: it updates the basicComplexData variable
        // with the input extension object and returns the previous value
        callBasicComplexDataMethod.bindMethod(async function (
            this: UAMethod,
            inputArguments: Variant[],
            _context: ISessionContext
        ): Promise<CallMethodResultOptions> {
            const inputExtObj = inputArguments[0].value;
            const previousValue: Variant = basicComplexDataVar.readValue().value;
            basicComplexDataVar.setValueFromSource(
                new Variant({
                    dataType: DataType.ExtensionObject,
                    value: inputExtObj
                })
            );
            return {
                statusCode: StatusCodes.Good,
                outputArguments: [previousValue]
            };
        });

        // verify initial dateTime value
        const initialValue = basicComplexDataVar.readValue().value.value;
        initialValue.dateTime.toISOString().should.eql("2026-02-06T10:30:00.000Z");

        // construct a new extension object with a different dateTime
        const basicComplexDataType = addressSpace.findDataType("BasicComplexData", nsMyCompany);
        should.exist(basicComplexDataType, "BasicComplexData datatype should exist");

        const newDate = new Date("2026-06-15T08:00:00.000Z");
        const newExtObj = addressSpace.constructExtensionObject(basicComplexDataType!, {
            boolean: true,
            int32: 42,
            double: 3.14,
            float: 1.5,
            int64: [0, 100],
            dateTime: newDate
        });

        // call the method as if a client invoked it
        const result = (await callBasicComplexDataMethod.execute(
            complexDataObject,
            [new Variant({ dataType: DataType.ExtensionObject, value: newExtObj })],
            context
        )) as CallMethodResultOptions;

        should(result.statusCode).eql(StatusCodes.Good);

        // the output should contain the previous value
        should.exist(result.outputArguments);
        should(result.outputArguments?.length).eql(1);
        const previousExtObj = result.outputArguments?.[0]?.value;
        previousExtObj.dateTime.toISOString().should.eql("2026-02-06T10:30:00.000Z");

        // the variable should now have the new value
        const updatedValue = basicComplexDataVar.readValue().value.value;
        updatedValue.boolean.should.eql(true);
        updatedValue.int32.should.eql(42);
        updatedValue.double.should.eql(3.14);
        updatedValue.dateTime.should.be.instanceof(Date);
        updatedValue.dateTime.toISOString().should.eql("2026-06-15T08:00:00.000Z");
    });
});
