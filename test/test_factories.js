var factories = require("../lib/factories");
var should = require("should");
var BinaryStream =require("../lib/binaryStream").BinaryStream;
var util = require("util");

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

        var person = new Person();

        person.should.have.property("lastName");
        person.should.have.property("address");
        person.should.have.property("age");

        person.lastName.should.equal("");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("should construct a new object with options from a simple Class Description", function () {

        var person = new Person({lastName:"Joe"});

        person.lastName.should.equal("Joe");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("should construct a new object from a complex Class Description", function () {

        var employee = new Employee({ person: { lastName: "John"}, service: "R&D" });

        employee.should.have.property("person");
        employee.should.have.property("service");
        employee.should.have.property("salary");

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
    it("should handle subtype properly",function(){

        factories.UAObjectFactoryBuild( {
            name: "MyInteger",
            subtype: "Integer"
        });

        should.exist(factories.findSimpleType("MyInteger"));

        var MyStruct = factories.UAObjectFactoryBuild( {
            name: "MyStruct",
            fields: [
                { name: "value", fieldType: "MyInteger" }
            ]
        });

        var s = new MyStruct();
        s.should.have.property("value");
        s.value.should.equal(0);
    });
    it('should handle enumeration properly',function(){

        var ShapeType = factories.UAObjectFactoryBuild( {
            name: "EnumShapeType",
            isEnum: true,
            enumValues: {
                CIRCLE:    1,
                SQUARE:    2,
                RECTANGLE: 3
            }
        });
        var Shape = factories.UAObjectFactoryBuild({
            name: "Shape",
            fields: [
                { name:"shapeType" , fieldType: "EnumShapeType" }
            ]
        });

        var shape = new Shape();

        shape.shapeType.should.eql(ShapeType.CIRCLE);

        shape.shapeType = ShapeType.RECTANGLE;
        shape.shapeType.should.equal(ShapeType.RECTANGLE);

        (function(){
            shape.shapeType = 34;
        }).should.throw();

    });
});
describe("testing strong typed enums", function(){

    it('installEnumProp should create a strong typed enum',function(){

        var ShapeType = factories.UAObjectFactoryBuild( {
            name: "EnumShapeType",
            isEnum: true,
            enumValues: {
                CIRCLE: 1,
                SQUARE: 2,
                RECTANGLE: 3
            }
        });
        var obj = { };
        factories.installEnumProp(obj,"shapeType",ShapeType);
        obj.shapeType.value.should.equal(1);

        (function() {
            obj.shapeType = "toto";
        }).should.throw();

        var value = ShapeType.CIRCLE;

        ShapeType.CIRCLE.key.should.equal("CIRCLE");

        value.should.equal(ShapeType.CIRCLE);

    });
});

