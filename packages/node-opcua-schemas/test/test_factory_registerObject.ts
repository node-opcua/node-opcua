// tslint:disable:no-console
import * as mocha from "mocha";
import * as  path from "path";
import * as should from "should";

import {
    BinaryStream
} from "node-opcua-binary-stream";
import {
    redirectToFile
} from "node-opcua-debug";
import {
    makeExpandedNodeId
} from "node-opcua-nodeid";
import {
    analyze_object_binary_encoding
} from "node-opcua-packet-analyzer";
import { encode_decode_round_trip_test } from "node-opcua-packet-analyzer/dist/test_helpers";

import { BaseUAObject } from "node-opcua-factory";

const a = BaseUAObject;

import {
    AnyConstructorFunc, createDynamicObjectConstructor, StructureTypeRaw,
    TypeDictionary
} from "../source";
import { prepareStructureType } from "../source/tools";


const temporary_folder = path.join(__dirname, "..", "_test_generated");

const typeDictionary = new TypeDictionary([]);
const Person_Schema = {
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
        { name: "salary", fieldType: "opc:Double", defaultValue: 1000.00 }
    ]
};

const Company_Schema = {
    baseType: "ExtensionObject",

    name: "Company",

    fields: [
        { name: "name", fieldType: "opc:CharArray" },
        { name: "employees", isArray: true, fieldType: "tns:Employee" },
        { name: "company_values", isArray: true, fieldType: "opc:CharArray" }
    ]
};

function p(
    structuredType: StructureTypeRaw,
    typeDictionary1: TypeDictionary
): AnyConstructorFunc  {

    typeDictionary1.structuredTypesRaw[structuredType.name] = structuredType;
    const schema = prepareStructureType(structuredType, typeDictionary1);
    return createDynamicObjectConstructor(schema, typeDictionary1);
}

const Person = p(Person_Schema, typeDictionary);
const Role = p(Role_Schema, typeDictionary);
const Employee = p(Employee_Schema, typeDictionary);
const Company = p(Company_Schema, typeDictionary);

describe("Factories: construction", () => {

    it("a schema should provide a list of possible fields", () => {
        Person.possibleFields.should.eql(["lastName", "address", "age"]);
        Employee.possibleFields.should.eql(["lastName", "address", "age", "role", "service", "salary"]);
    });
});

describe("testing Factory", () => {
    it("should construct a new object from a simple Class Description", () => {

        const person = new Person();

        person.should.have.property("lastName");
        person.should.have.property("address");
        person.should.have.property("age");

        person.lastName.should.equal("");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("should construct a new object with options from a simple Class Description", () => {

        const person = new Person({ lastName: "Joe" });

        person.lastName.should.equal("Joe");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("should construct a new object from a complex Class Description", () => {

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

    it("should encode and decode a simple object created from the Factory", () => {

        const person = new Person({ lastName: "Joe" });
        person.age = 50;
        person.address = "Paris";

        const person_reloaded = encode_decode_round_trip_test(person);

        person.lastName.should.equal(person_reloaded.lastName);
        person.age.should.equal(person_reloaded.age);
        person.address.should.equal(person_reloaded.address);

    });

    it("should encode and decode a composite object created from the Factory", () => {

        const employee = new Employee({ lastName: "John", service: "R&D" });
        encode_decode_round_trip_test(employee);

    });

    it("should encode and decode a composite object containing an array", () => {

        const company = new Company({ name: "ACME" });
        company.employees.length.should.equal(0);

        const employee = new Employee({ lastName: "John", service: "R&D" });

        company.employees.push(employee);
        company.employees.push(new Employee({ lastName: "Peter", service: "R&D" }));

        company.employees.length.should.equal(2);

        encode_decode_round_trip_test(company);

    });

    it("should create an Object with a containing an array of JSON object passed in the initializer", () => {

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
    });

    it("should create an Object with a containing an array of string passed in the initializer", () => {

        const company = new Company({
            name: "ACME",

            company_values: [
                "A commitment to sustainability and to acting in an environmentally friendly way",
                "A commitment to innovation and excellence.",
                "Encouraging employees to take initiative and give the best."
            ]
        });

        company.company_values.length.should.equal(3);
        company.company_values[0].should.equal("A commitment to sustainability and to acting in an environmentally friendly way");

        company.should.have.property("employees");

        encode_decode_round_trip_test(company);
    });
});

/*
xdescribe("Factories: testing encodingDefaultBinary and constructObject", () => {

    it("a factory object should have a encodingDefaultBinary", () => {

        const company = new Company({ name: "ACME" });
        company.encodingDefaultBinary.should.eql(makeExpandedNodeId(Company_Schema.id));

    });

    it("should create a object from a encodingDefaultBinaryId", () => {

        const getObjectClassName = require("node-opcua-utils").getObjectClassName;

        const obj = factories.constructObject(makeExpandedNodeId(Company_Schema.id));

        should(obj).have.property("_schema");
        obj.schema.name.should.equal("Company");

        getObjectClassName(obj).should.equal("Object");

    });


    it("should encode and decode a Object containing ByteString", function(done) {

        exports.FakeBlob_Schema = {

            id: next_available_id(),

            name: "FakeBlob",

            fields: [
                { name: "name", fieldType: "String" },
                { name: "buffer0", fieldType: "ByteString" },
                { name: "buffer1", fieldType: "ByteString" }
            ]
        };
        generator.unregisterObject(exports.FakeBlob_Schema, temporary_folder);

        const Blob = generator.registerObject(exports.FakeBlob_Schema, temporary_folder);

        const blob = new Blob({ buffer0: Buffer.alloc(0), buffer1: Buffer.alloc(1024) });

        encode_decode_round_trip_test(blob);

        generator.unregisterObject(exports.FakeBlob_Schema, temporary_folder);


        done();

    });
    it("should pretty print an object ", () => {

        redirectToFile("pretty_print.log", () => {
            const company = new Company({ name: "ACME" });
            const employee = new Employee({ lastName: "John", service: "R&D" });
            company.employees.push(employee);
            company.employees.push(new Employee({ lastName: "Peter", service: "R&D" }));

            const str = company.explore();

            console.log(str);

        });

    });

    it("should help JSON.stringify", () => {

        const someArray = [new Person({})];

        const str = JSON.stringify({ stuff: someArray }, null, " ");
        //xx console.log("xxxx str =",str);

    });

    it("should clone an object ", () => {
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

});


describe("PacketAnalyzer", () => {

    it("should analyse a encoded object", function(done) {

        const company = new Company({
            name: "ACME",
            employees: [
                { lastName: "John", age: 25, service: "R&D" },
                { lastName: "Peter", age: 56, service: "R&D" }
            ]
        });
        const stream = new BinaryStream(company.binaryStoreSize());
        company.encode(stream);

        redirectToFile("analyze_object_binary_encoding", () => {
            analyze_object_binary_encoding(company);
        }, done);
    });
});

*/