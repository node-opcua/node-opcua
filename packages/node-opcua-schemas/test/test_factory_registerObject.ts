"use strict";
const should = require("should");

const generator = require("..");
const factories = require("node-opcua-factory");

const redirectToFile = require("node-opcua-debug").redirectToFile;
const makeExpandedNodeId = require("node-opcua-nodeid").makeExpandedNodeId;

const BinaryStream = require("node-opcua-binary-stream").BinaryStream;
const encode_decode_round_trip_test = require("node-opcua-packet-analyzer/dist/test_helpers").encode_decode_round_trip_test;
const analyze_object_binary_encoding = require("node-opcua-packet-analyzer").analyze_object_binary_encoding;
const compare_obj_by_encoding = require("node-opcua-packet-analyzer/dist/test_helpers").compare_obj_by_encoding;


const typeDico = new TypeDictionnary();

function initializeTest() {

    const Person_Schema = {
        id: factories.next_available_id(),
        name: "Person",
        fields: [
            { name: "lastName", fieldType: "UAString" },
            { name: "address", fieldType: "UAString" },
            { name: "age", fieldType: "Int32", defaultValue: 25 }
        ]
    };
    exports.Person_Schema = Person_Schema;
    const Role_Schema = {
        id: factories.next_available_id(),
        name: "Role",
        fields: [
            { name: "title", fieldType: "UAString" },
            { name: "description", fieldType: "UAString" }
        ]
    };
    exports.Role_Schema = Role_Schema;
    const Employee_Schema = {
        id: factories.next_available_id(),
        name: "Employee",
        baseType: "Person",
        fields: [
            { name: "role", fieldType: "Role" },
            { name: "service", fieldType: "UAString" },
            { name: "salary", fieldType: "Double", defaultValue: 1000.00 }
        ]
    };
    exports.Employee_Schema = Employee_Schema;

    const Company_Schema = {
        id: factories.next_available_id(),
        name: "Company",
        fields: [
            { name: "name", fieldType: "String" },
            { name: "employees", isArray: true, fieldType: "Employee" },
            { name: "company_values", isArray: true, fieldType: "String" }
        ]
    };
    exports.Company_Schema = Company_Schema;

    const path = require("path");
    const temporary_folder = path.join(__dirname, "..", "_test_generated");

    const Person = generator.registerObject(Person_Schema, temporary_folder);
    const Role = generator.registerObject(Role_Schema, temporary_folder);
    const Employee = generator.registerObject(Employee_Schema, temporary_folder);
    const Company = generator.registerObject(Company_Schema, temporary_folder);
}

xdescribe("Factories: construction", function () {

    it("a schema should provide a list of possible fields", function () {

        Person.possibleFields.should.eql(["lastName", "address", "age"]);
        Employee.possibleFields.should.eql(["lastName", "address", "age", "role", "service", "salary"]);
    });
});

xdescribe("testing Factory",function(){
    it("should construct a new object from a simple Class Description", function () {

        const person = new Person();

        person.should.have.property("lastName");
        person.should.have.property("address");
        person.should.have.property("age");

        person.lastName.should.equal("");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("should construct a new object with options from a simple Class Description", function () {

        const person = new Person({lastName: "Joe"});

        person.lastName.should.equal("Joe");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("should construct a new object from a complex Class Description", function () {

        const employee = new Employee({
            lastName: "John",
            service: "R&D",
            role: {title: "developer", description: "create the awesome"}
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

    it("should encode and decode a simple object created from the Factory", function () {

        const person = new Person({lastName: "Joe"});
        person.age = 50;
        person.address = "Paris";

        const person_reloaded = encode_decode_round_trip_test(person);

        person.lastName.should.equal(person_reloaded.lastName);
        person.age.should.equal(person_reloaded.age);
        person.address.should.equal(person_reloaded.address);

    });

    it("should encode and decode a composite object created from the Factory", function () {

        const employee = new Employee({lastName: "John", service: "R&D"});
        encode_decode_round_trip_test(employee);

    });

    it("should encode and decode a composite object containing an array", function () {


        const company = new Company({name: "ACME"});
        company.employees.length.should.equal(0);


        const employee = new Employee({lastName: "John", service: "R&D"});

        company.employees.push(employee);
        company.employees.push(new Employee({lastName: "Peter", service: "R&D"}));

        company.employees.length.should.equal(2);

        encode_decode_round_trip_test(company);

    });

    it("should create an Object with a containing an array of JSON object passed in the initializer", function () {

        const company = new Company({
            name: "ACME",
            employees: [
                {lastName: "John", age: 25, service: "R&D", role: {title: "manager", description: ""}},
                {lastName: "Peter", age: 56, service: "R&D", role: {title: "engineer", description: ""}}
            ]
        });

        company.employees.length.should.equal(2);
        company.employees[0].should.be.instanceOf(Employee);
        company.employees[1].should.be.instanceOf(Employee);

        encode_decode_round_trip_test(company);
    });

    it("should create an Object with a containing an array of string passed in the initializer", function () {

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

xdescribe("Factories: testing encodingDefaultBinary and constructObject", function () {

    it("a factory object should have a encodingDefaultBinary", function () {

        const company = new Company({name: "ACME"});
        company.encodingDefaultBinary.should.eql(makeExpandedNodeId(Company_Schema.id));

    });

    it("should create a object from a encodingDefaultBinaryId", function () {

        const getObjectClassName = require("node-opcua-utils").getObjectClassName;

        const obj = factories.constructObject(makeExpandedNodeId(Company_Schema.id));

        should(obj).have.property("_schema");
        obj.schema.name.should.equal("Company");

        getObjectClassName(obj).should.equal("Object");

    });


    it("should encode and decode a Object containing ByteString", function (done) {

        exports.FakeBlob_Schema = {
            id: factories.next_available_id(),
            name: "FakeBlob",
            fields: [
                {name: "name", fieldType: "String"},
                {name: "buffer0", fieldType: "ByteString"},
                {name: "buffer1", fieldType: "ByteString"}
            ]
        };
        generator.unregisterObject(exports.FakeBlob_Schema, temporary_folder);

        const Blob = generator.registerObject(exports.FakeBlob_Schema, temporary_folder);

        const blob = new Blob({buffer0: Buffer.alloc(0), buffer1: Buffer.alloc(1024)});

        encode_decode_round_trip_test(blob);

        generator.unregisterObject(exports.FakeBlob_Schema, temporary_folder);


        done();

    });
    it("should pretty print an object ", function () {

        redirectToFile("pretty_print.log", function () {
            const company = new Company({name: "ACME"});
            const employee = new Employee({lastName: "John", service: "R&D"});
            company.employees.push(employee);
            company.employees.push(new Employee({lastName: "Peter", service: "R&D"}));

            const str = company.explore();

            console.log(str);

        });

    });

    it("should help JSON.stringify", function () {

        const someArray = [new Person({})];

        const str = JSON.stringify({stuff: someArray}, null, " ");
        //xx console.log("xxxx str =",str);

    });

    it("should clone an object ", function () {
        const company = new Company({name: "ACME"});
        const employee = new Employee({lastName: "John", service: "R&D"});
        company.employees.push(employee);
        company.employees.push(new Employee({lastName: "Peter", service: "R&D"}));

        const company_copy = company.clone();

        company_copy.constructor.name.should.eql("Company");
        company_copy.name.should.eql("ACME");
        company_copy.employees.length.should.eql(2);
        company_copy.employees[0].lastName.should.eql("John");
        company_copy.employees[0].service.should.eql("R&D");
        company_copy.employees[1].lastName.should.eql("Peter");
        company_copy.employees[1].service.should.eql("R&D");
        compare_obj_by_encoding(company,company_copy);
    });

});


describe("PacketAnalyzer", function () {

    it("should analyse a encoded object", function (done) {

        const company = new Company({
            name: "ACME",
            employees: [
                {lastName: "John", age: 25, service: "R&D"},
                {lastName: "Peter", age: 56, service: "R&D"}
            ]
        });
        const stream = new BinaryStream(company.binaryStoreSize());
        company.encode(stream);

        redirectToFile("analyze_object_binary_encoding", function () {
            analyze_object_binary_encoding(company);
        }, done);
    });
});

