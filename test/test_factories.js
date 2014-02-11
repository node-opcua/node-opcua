var factories = require("../lib/factories");
var should = require("should");
var BinaryStream =require("../lib/binaryStream").BinaryStream;
var util = require("util");
var ec = require("../lib/encode_decode");

var encode_decode_round_trip_test = require("./utils/encode_decode_round_trip_test").encode_decode_round_trip_test;


var Person_Description = {
    id: factories.next_available_id(),
    name: "Person",
    fields: [
        { name: "lastName" , fieldType: "UAString" },
        { name: "address"  , fieldType: "UAString" },
        { name: "age"      , fieldType: "Int32"  , defaultValue:  25  }
    ]
};


var Employee_Description = {
    id: factories.next_available_id(),
    name: "Employee",
    fields: [
        { name: "person", fieldType: "Person" },
        { name: "service", fieldType: "UAString" },
        { name: "salary", fieldType: "Double", defaultValue: 1000.00  }
    ]
};

var Company_Description = {
    id: factories.next_available_id(),
    name: "Company",
    fields: [
        { name: "name",                     fieldType: "String"   },
        { name: "employees", isArray: true, fieldType: "Employee" }
    ]
};



var Person = factories.UAObjectFactoryBuild(Person_Description);
var Employee = factories.UAObjectFactoryBuild(Employee_Description);
var Company  = factories.UAObjectFactoryBuild(Company_Description);



var ShapeType = factories.UAObjectFactoryBuild( {
    name: "EnumShapeType",
    isEnum: true,
    enumValues: {
        CIRCLE:    1,
        SQUARE:    2,
        RECTANGLE: 3,
        HEXAGON:   6
    }
});
var Color = factories.UAObjectFactoryBuild( {
    name: "EnumColor",
    isEnum: true,
    enumValues: {
        RED:     100,
        BLUE:    200,
        GREEN:   300
    }
});

var Shape = factories.UAObjectFactoryBuild({
    id: factories.next_available_id(),
    name: "Shape",
    fields: [
        { name:"name",              fieldType: "String" , defaultValue: function() { return "my shape";} },
        { name:"shapeType",        fieldType: "EnumShapeType" },
        { name:"color",            fieldType: "EnumColor", defaultValue: Color.GREEN },
        { name:"inner_color",      fieldType: "EnumColor", defaultValue: function() { return Color.BLUE; }}
    ]
});






describe("Factories: testing object factory", function () {

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

    it("should encode and decode a simple object created from the Factory",function(){

        var person = new Person({lastName:"Joe"});
        person.age = 50;
        person.address = "Paris";

        var person_reloaded = encode_decode_round_trip_test(person);

        person.lastName.should.equal(person_reloaded.lastName);
        person.age.should.equal(person_reloaded.age);
        person.address.should.equal(person_reloaded.address);



    });

    it("should encode and decode a composite object created from the Factory",function(){

        var employee = new Employee({ person: { lastName: "John"}, service: "R&D" });

        encode_decode_round_trip_test(employee);

    });

    it("should encode and decode a composite object containing an array",function(){


        var company  = new Company({name: "ACME" });
        company.employees.length.should.equal(0);


        var employee = new Employee({ person: { lastName: "John"}, service: "R&D" });

        company.employees.push(employee);
        company.employees.push(new Employee({ person: { lastName: "Peter"}, service: "R&D" }));

        company.employees.length.should.equal(2);

        encode_decode_round_trip_test(company);

    });


    it("should handle subtype properly",function(){

        factories.UAObjectFactoryBuild( {
            name: "MyInteger",
            subtype: "Integer"
        });

        should.exist(factories.findSimpleType("MyInteger"));

        var MyStruct = factories.UAObjectFactoryBuild( {
            name: "MyStruct",
            id: factories.next_available_id(),
            fields: [
                { name: "value", fieldType: "MyInteger" }
            ]
        });

        var s = new MyStruct();
        s.should.have.property("value");
        s.value.should.equal(0);
    });


    it('should handle enumeration properly',function(){


        var shape = new Shape();

        shape.shapeType.should.eql(ShapeType.CIRCLE);
        shape.name.should.eql("my shape");
        shape.color.should.eql(Color.GREEN);

        shape.inner_color.should.eql(Color.BLUE);

        shape.shapeType = ShapeType.RECTANGLE;
        shape.shapeType.should.equal(ShapeType.RECTANGLE);

        (function(){
            shape.shapeType = 34;
        }).should.throw();

    });
    it('should allow enumeration value to be passed in options during construction',function(){

        var shape1 = new Shape({ shapeType: ShapeType.HEXAGON});
        shape1.shapeType.should.eql(ShapeType.HEXAGON);

        var shape2 = new Shape({ shapeType: ShapeType.RECTANGLE});
        shape2.shapeType.should.eql(ShapeType.RECTANGLE);
    });

    it("should encode and decode a structure containing a enumeration properly",function(){

        var shape = new Shape({name: "yo" , shapeType: ShapeType.HEXAGON , color: Color.BLUE });

        encode_decode_round_trip_test(shape);


    });

});

describe("Factories: testing strong typed enums", function(){

    it('installEnumProp should append a member as a strong typed enum',function(){

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


describe("Factories: testing binaryStoreSize",function(){

    it("should implement binaryStoreSize",function(){

        var shape = new  Shape();

        shape.binaryStoreSize().should.be.greaterThan(10);

    });
});

describe("Factories: testing encodingDefaultBinary and constructObject",function(){

    it("a factory object should have a encodingDefaultBinary",function(){

        var company = new Company({name: "ACME"});

        company.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(Company_Description.id));

    });

    it("should create a object from a encodingDefaultBinaryId", function() {

        var getObjectClassName = require("../lib/utils").getObjectClassName;

        var obj = factories.constructObject(ec.makeExpandedNodeId(Company_Description.id));

        should(obj).have.property("_description");
        obj._description.name.should.equal("Company");

        getObjectClassName(obj).should.equal("Object");

    });



    it("should encode and decode a Object containing ByteString",function(done){

        var Blob_Description = {
            id: factories.next_available_id(),
            name: "FakeBlob",
            fields: [
                { name: "name",                     fieldType: "String"     },
                { name: "buffer0",                  fieldType: "ByteString" },
                { name: "buffer1",                  fieldType: "ByteString" }
            ]
        };

        var Blob = factories.UAObjectFactoryBuild(Blob_Description);

        var blob = new Blob({ buffer0: new Buffer(0), buffer1: new Buffer(1024) });

        encode_decode_round_trip_test(blob);

        done();

    });
    it("should pretty print an object ",function(){

        var company  = new Company({name: "ACME" });
        var employee = new Employee({ person: { lastName: "John"}, service: "R&D" });
        company.employees.push(employee);
        company.employees.push(new Employee({ person: { lastName: "Peter"}, service: "R&D" }));

        var str = company.explore();

        // console.log(str);

    });


    it("should handle ExtensionObject ",function(){


        var MetaShape_Description = {
            id: factories.next_available_id(),
            fields: [
                { name: "name",                     fieldType: "String"          },
                { name: "shape",                    fieldType: "ExtensionObject" },
                { name: "comment",                  fieldType: "String" }
            ]
        };

        var MetaShape = factories.UAObjectFactoryBuild(MetaShape_Description);


        var shape  = new MetaShape({
            name: "MyCircle",
            shape: new Shape({name: "circle" , shapeType:ShapeType.CIRCLE , color: Color.BLUE}),
            comment:  "this is a comment"
        });
        shape.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(MetaShape_Description.id));

        var stream = new BinaryStream(shape.binaryStoreSize());
        shape.encode(stream);

        var encode_decode_round_trip_test = require("./utils/encode_decode_round_trip_test").encode_decode_round_trip_test;

        encode_decode_round_trip_test(shape);

    });
});
