var factories = require("../lib/factories");
var should = require("should");
var BinaryStream =require("../lib/binaryStream").BinaryStream;


var Person_Description = {
    name: "Person",
    fields: [
        { name: "lastName" , fieldType: "UAString" },
        { name: "address"  , fieldType: "UAString" },
        { name: "age"      , fieldType: "Int32"  , defaultValue:  25  }
    ]
};


var Employee_Description = {

    name: "Employee",
    fields: [
        { name: "person", fieldType: "Person" },
        { name: "service", fieldType: "UAString" },
        { name: "salary", fieldType: "Double", defaultValue: 1000.00  }
    ]
};

var Person = factories.UAObjectFactoryBuild(Person_Description);
var Employee = factories.UAObjectFactoryBuild(Employee_Description);

describe("testing object factory", function () {

    it("should construct a new object from a simple Class Description", function () {

        var person = new Person({lastName:"Joe"});

        person.lastName.should.equal("Joe");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("should construct a new object from a complex Class Description", function () {

        var employee = new Employee({ person: { lastName: "John"}, service: "R&D" });

        employee.person.lastName.should.equal("John");
        employee.person.address.should.equal("");
        employee.person.age.should.equal(25);

        employee.service.should.equal("R&D");
        employee.salary.should.equal(1000.0);

    });

    it("should encode and decode a object created from the Factory",function(){

        var Person = factories.UAObjectFactoryBuild(Person_Description);

        var person = new Person({lastName:"Joe"});
        person.age = 50;
        person.address = "Paris";

        var stream  = new BinaryStream();
        person.encode(stream);

        stream.rewind();

        var person_reloaded = new Person();
        person_reloaded.decode(stream);

        person.lastName.should.equal(person_reloaded.lastName);
        person.age.should.equal(person_reloaded.age);
        person.address.should.equal(person_reloaded.address);

    });



});