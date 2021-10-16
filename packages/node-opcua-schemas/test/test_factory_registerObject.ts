// tslint:disable:no-console
import * as should from "should";

import { redirectToFile } from "node-opcua-debug/nodeJS";
import { BaseUAObject, DataTypeFactory } from "node-opcua-factory";
import { makeExpandedNodeId } from "node-opcua-nodeid";
import { getObjectClassName } from "node-opcua-utils";
import { compare_obj_by_encoding, encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";
import { BinaryStream } from "node-opcua-binary-stream";
import { analyze_object_binary_encoding } from "node-opcua-packet-analyzer";

import {
    AnyConstructorFunc,
    createDynamicObjectConstructor,
    getOrCreateStructuredTypeSchema,
    MapDataTypeAndEncodingIdProvider,
    StructureTypeRaw,
    TypeDictionary
} from "../source";
import { MockProvider } from "./mock_id_provider";
const a = BaseUAObject;

const typeDictionary = new TypeDictionary();

const Person_Schema: StructureTypeRaw = {
    baseType: "ExtensionObject",
    name: "Person",

    fields: [
        { name: "lastName", fieldType: "opc:CharArray" },
        { name: "address", fieldType: "opc:CharArray" },
        { name: "age", fieldType: "opc:Int32", defaultValue: 25 }
    ]
};

const Role_Schema = {
    baseType: "ExtensionObject",
    name: "Role",

    fields: [
        { name: "title", fieldType: "opc:CharArray" },
        { name: "description", fieldType: "opc:CharArray" }
    ]
};
const Employee_Schema = {
    baseType: "Person",
    name: "Employee",

    fields: [
        { name: "role", fieldType: "tns:Role" },
        { name: "service", fieldType: "opc:CharArray" },
        { name: "salary", fieldType: "opc:Double", defaultValue: 1000.0 }
    ]
};

const Company_Schema = {
    baseType: "ExtensionObject",
    name: "Company",

    fields: [
        { name: "name", fieldType: "opc:CharArray" },
        { name: "employees", isArray: true, fieldType: "tns:Employee" },
        { name: "companyValues", isArray: true, fieldType: "opc:CharArray" }
    ]
};

const FakeBlob_Schema = {
    name: "FakeBlob",

    fields: [
        { name: "name", fieldType: "String" },
        { name: "buffer0", fieldType: "ByteString" },
        { name: "buffer1", fieldType: "ByteString" }
    ]
};

const dataTypeFactory = new DataTypeFactory([]);
const idProvider = new MockProvider();

function p(structuredType: StructureTypeRaw, typeDictionary1: TypeDictionary): AnyConstructorFunc {
    typeDictionary1.addRaw(structuredType);
    const schema = getOrCreateStructuredTypeSchema(structuredType.name, typeDictionary1, dataTypeFactory, idProvider);
    return createDynamicObjectConstructor(schema, dataTypeFactory);
}

const Person = p(Person_Schema, typeDictionary);
const Role = p(Role_Schema, typeDictionary);
const Employee = p(Employee_Schema, typeDictionary);
const Company = p(Company_Schema, typeDictionary);
const FakeBlob = p(FakeBlob_Schema, typeDictionary);

describe("Factories: construction", () => {
    it("a schema should provide a list of possible fields", () => {
        Person.possibleFields.should.eql(["lastName", "address", "age"]);
        Employee.possibleFields.should.eql(["lastName", "address", "age", "role", "service", "salary"]);
    });
});

describe("testing Factory", () => {
    it("FF1 - should construct a new object from a simple Class Description", () => {
        const person = new Person();

        person.should.have.property("lastName");
        person.should.have.property("address");
        person.should.have.property("age");

        person.lastName.should.equal("");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("FF2 - should construct a new object with options from a simple Class Description", () => {
        const person = new Person({ lastName: "Joe" });

        person.lastName.should.equal("Joe");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("FF3 - should construct a new object from a complex Class Description", () => {
        const employee = new Employee({
            lastName: "John",
            service: "R&D",

            role: { title: "developer", description: "create the awesome" }
        });

        employee.should.be.instanceOf(Person);
        employee.should.be.instanceOf(Employee);

        employee.should.have.property("role");
        employee.should.have.property("service");
        employee.should.have.property("salary");

        // due to inheritance, employee shall be a person
        employee.should.have.property("lastName");
        employee.should.have.property("address");
        employee.should.have.property("age");

        employee.lastName.should.equal("John");
        employee.address.should.equal("");
        employee.age.should.equal(25);

        employee.service.should.equal("R&D");
        employee.salary.should.equal(1000.0);

        employee.role.should.be.instanceOf(Role);
        employee.role.title.should.equal("developer");
        employee.role.description.should.equal("create the awesome");
    });

    it("FF4 - should encode and decode a simple object created from the Factory", () => {
        const person = new Person({ lastName: "Joe" });
        person.age = 50;
        person.address = "Paris";

        const person_reloaded = encode_decode_round_trip_test(person);

        person.lastName.should.equal(person_reloaded.lastName);
        person.age.should.equal(person_reloaded.age);
        person.address.should.equal(person_reloaded.address);
    });

    it("FF5 - should encode and decode a composite object created from the Factory", () => {
        const employee = new Employee({ lastName: "John", service: "R&D" });
        encode_decode_round_trip_test(employee);

        console.log(employee.toJSON());
        employee.toJSON().should.eql({
            address: "",
            age: 25,
            lastName: "John",
            role: {
                description: "",
                title: ""
            },
            salary: 1000,
            service: "R&D"
        });
    });

    it("FF6 - should encode and decode a composite object containing an array", () => {
        const company = new Company({ name: "ACME" });
        company.employees.length.should.equal(0);

        const employee = new Employee({ lastName: "John", service: "R&D" });

        company.employees.push(employee);
        company.employees.push(new Employee({ lastName: "Peter", service: "R&D" }));

        company.employees.length.should.equal(2);

        encode_decode_round_trip_test(company);
    });

    it("FF7 - should create an Object with a containing an array of JSON object passed in the initializer", () => {
        const company = new Company({
            name: "ACME",

            employees: [
                { lastName: "John", age: 25, service: "R&D", role: { title: "manager", description: "" } },
                { lastName: "Peter", age: 56, service: "R&D", role: { title: "engineer", description: "" } }
            ]
        });

        company.employees.length.should.equal(2);
        company.employees[0].should.be.instanceOf(Employee);
        company.employees[1].should.be.instanceOf(Employee);

        encode_decode_round_trip_test(company);

        company.toJSON().should.eql({
            companyValues: [],
            name: "ACME",

            employees: [
                {
                    address: "",
                    age: 25,
                    lastName: "John",
                    role: { title: "manager", description: "" },
                    salary: 1000,
                    service: "R&D"
                },
                {
                    address: "",
                    age: 56,
                    lastName: "Peter",
                    role: { title: "engineer", description: "" },
                    salary: 1000,
                    service: "R&D"
                }
            ]
        });
    });

    it("FF8 - should create an Object with a containing an array of string passed in the initializer", () => {
        const company = new Company({
            name: "ACME",

            companyValues: [
                "A commitment to sustainability and to acting in an environmentally friendly way",
                "A commitment to innovation and excellence.",
                "Encouraging employees to take initiative and give the best."
            ]
        });

        company.companyValues.length.should.equal(3);
        company.companyValues[0].should.equal("A commitment to sustainability and to acting in an environmentally friendly way");

        company.should.have.property("employees");

        encode_decode_round_trip_test(company);
    });
});

describe("Factories: testing encodingDefaultBinary and constructObject", () => {
    it("XF1 a factory object should have a encodingDefaultBinary", () => {
        const company = new Company({ name: "ACME" });
        company.constructor.schema.dataTypeNodeId
            .toString()
            .should.eql(makeExpandedNodeId(Company.schema.dataTypeNodeId).toString());
        company.constructor.encodingDefaultBinary
            .toString()
            .should.eql(makeExpandedNodeId(Company.schema.encodingDefaultBinary).toString());
        company.constructor.encodingDefaultXml
            .toString()
            .should.eql(makeExpandedNodeId(Company.schema.encodingDefaultXml!).toString());
        // company.constructor.encodingDefaultJson.toString().should.eql(makeExpandedNodeId(Company.schema.encodingDefaultJson!).toString());
    });

    xit("XF2 should create a object from a encodingDefaultBinaryId", () => {
        should.exist(Company.schema.encodingDefaultBinary);
        const obj = dataTypeFactory.constructObject(Company.schema.encodingDefaultBinary!);
        console.log(obj);
        (obj.constructor as any).schema.name.should.equal("Company");
        getObjectClassName(obj).should.equal("Object");
    });

    it("XF3 should pretty print an object ", (done) => {
        redirectToFile(
            "pretty_print.log",
            () => {
                const company = new Company({ name: "ACME" });
                const employee = new Employee({ lastName: "John", service: "R&D" });
                company.employees.push(employee);
                company.employees.push(new Employee({ lastName: "Peter", service: "R&D" }));
                const str = company.explore();
                console.log(str);
                console.log(company.toString());
            },
            done
        );
    });

    it("XF4 - should encode and decode a Object containing ByteString", async () => {
        const blob = new FakeBlob({ buffer0: Buffer.alloc(0), buffer1: Buffer.alloc(1024) });
        encode_decode_round_trip_test(blob);
    });

    it("XF5 - should clone an object ", () => {
        const company = new Company({ name: "ACME" });
        const employee = new Employee({ lastName: "John", service: "R&D" });
        company.employees.push(employee);
        company.employees.push(new Employee({ lastName: "Peter", service: "R&D" }));

        const company_copy = company.clone();

        company_copy.constructor.name.should.eql("Company");
        company_copy.name.should.eql("ACME");
        company_copy.employees.length.should.eql(2);
        company_copy.employees[0].lastName.should.eql("John");
        company_copy.employees[0].service.should.eql("R&D");
        company_copy.employees[1].lastName.should.eql("Peter");
        company_copy.employees[1].service.should.eql("R&D");
        compare_obj_by_encoding(company, company_copy);
    });

    it("XF6 - should analyse a encoded object", (done) => {
        const company = new Company({
            name: "ACME",

            employees: [
                { lastName: "John", age: 25, service: "R&D" },
                { lastName: "Peter", age: 56, service: "R&D" }
            ]
        });
        const stream = new BinaryStream(company.binaryStoreSize());
        company.encode(stream);

        redirectToFile(
            "analyze_object_binary_encoding",
            () => {
                analyze_object_binary_encoding(company);
            },
            done
        );
    });
});
