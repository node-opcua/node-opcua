var factories = require("../../lib/misc/factories");
var should = require("should");
var BinaryStream =require("../../lib/misc/binaryStream").BinaryStream;
var util = require("util");
var ec = require("../../lib/misc/encode_decode");

var encode_decode_round_trip_test = require("../helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;


var Person_Schema = {
    id: factories.next_available_id(),
    name: "Person",
    fields: [
        { name: "lastName" , fieldType: "UAString" },
        { name: "address"  , fieldType: "UAString" },
        { name: "age"      , fieldType: "Int32"  , defaultValue:  25  }
    ]
};

var Role_Schema = {
    id: factories.next_available_id(),
    name: "Role",
    fields: [
        { name: "title" ,        fieldType: "UAString" },
        { name: "description"  , fieldType: "UAString" }
    ]
};

var Employee_Schema = {
    id: factories.next_available_id(),
    name: "Employee",
    baseType: "Person",
    fields: [
        { name: "role",    fieldType: "Role" },
        { name: "service", fieldType: "UAString" },
        { name: "salary",  fieldType: "Double", defaultValue: 1000.00  }
    ]
};

var Company_Schema = {
    id: factories.next_available_id(),
    name: "Company",
    fields: [
        { name: "name",                          fieldType: "String"   },
        { name: "employees",      isArray: true, fieldType: "Employee" },
        { name: "company_values", isArray: true, fieldType: "String" }
    ]
};



var Person   = factories.registerObject(Person_Schema);
var Role     = factories.registerObject(Role_Schema);
var Employee = factories.registerObject(Employee_Schema);
var Company  = factories.registerObject(Company_Schema);



var ShapeType = factories.registerEnumeration( {
    name: "EnumShapeType",
    enumValues: {
        CIRCLE:    1,
        SQUARE:    2,
        RECTANGLE: 3,
        HEXAGON:   6
    }
});
var Color = factories.registerEnumeration( {
    name: "EnumColor",
    enumValues: {
        RED:     100,
        BLUE:    200,
        GREEN:   300
    }
});

var Shape = factories.registerObject({
    id: factories.next_available_id(),
    name: "Shape",
    fields: [
        { name:"name",              fieldType: "String" , defaultValue: function() { return "my shape";} },
        { name:"shapeType",        fieldType: "EnumShapeType" },
        { name:"color",            fieldType: "EnumColor", defaultValue: Color.GREEN },
        { name:"inner_color",      fieldType: "EnumColor", defaultValue: function() { return Color.BLUE; }}
    ]
});




describe("Factories: construction",function() {

    it("a schema should provide a list of possible fields",function() {

        Person.possibleFields().should.eql(["lastName","address","age"]);
        Employee.possibleFields().should.eql(["lastName","address","age","role","service","salary"]);
    });
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

        var employee = new Employee({ lastName: "John", service: "R&D" , role: { title: "developer", description: "create the awesome"} });

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

        var employee = new Employee({  lastName: "John" , service: "R&D" });
        encode_decode_round_trip_test(employee);

    });

    it("should encode and decode a composite object containing an array",function(){


        var company  = new Company({name: "ACME" });
        company.employees.length.should.equal(0);


        var employee = new Employee({ lastName: "John", service: "R&D" });

        company.employees.push(employee);
        company.employees.push(new Employee({ lastName: "Peter", service: "R&D" }));

        company.employees.length.should.equal(2);

        encode_decode_round_trip_test(company);

    });

    it("should create an Object with a containing an array of JSON object passed in the initializer",function(){

        var company  = new Company({
            name: "ACME",
            employees: [
                { lastName: "John",  age: 25 , service: "R&D" , role: {title: "manager",  description: "" } },
                { lastName: "Peter", age: 56 , service: "R&D" , role: {title: "engineer", description: "" } }
            ]
        });

        company.employees.length.should.equal(2);
        company.employees[0].should.be.instanceOf(Employee);
        company.employees[1].should.be.instanceOf(Employee);

        encode_decode_round_trip_test(company);
    });

    it("should create an Object with a containing an array of string passed in the initializer",function(){

        var company  = new Company({
            name: "ACME",
            company_values: [
                "A commitment to sustainability and to acting in an environmentally friendly way",
                "A commitment to innovation and excellence.",
                "Encouraging employees to take initiative and give the best."
            ]
        });

        company.company_values.length.should.equal(3);
        company.company_values[0].should.equal( "A commitment to sustainability and to acting in an environmentally friendly way");

        company.should.have.property("employees");

        encode_decode_round_trip_test(company);
    });

    it("should handle subtype properly",function(){

        factories.registerBasicType({
            name: "MyInteger",
            subtype: "Integer"
        });

        should.exist(factories.findSimpleType("MyInteger"));

        var MyStruct = factories.registerObject( {
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

    it("should handle StatusCode ",function(){

        var StatusCode = require("../../lib/datamodel/opcua_status_code").StatusCode;
        var StatusCodes = require("../../lib/datamodel/opcua_status_code").StatusCodes;
        var MyStruct2 = factories.registerObject( {
            name: "MyStruct2",
            id: factories.next_available_id(),
            fields: [
                { name: "value",      fieldType: "MyInteger" },
                { name: "statusCode", fieldType: "StatusCode" }
            ]
        });

        var s = new MyStruct2();
        s.should.have.property("value");
        s.should.have.property("statusCode");
        s.value.should.equal(0);
        s.statusCode.value.should.equal(0);
        s.statusCode.should.eql(StatusCodes.Good);
        // should.eql(StatusCode.Good);


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

    it("should raise an exception when trying to pass an invalid field to constructor",function(){

        // redirect stdout to null as test will be noisy
        var old_process_stdout_write = process.stdout.write;
        process.stdout.write = function() {};

        (function() {
           new Shape({

                this_invalid_field_should_cause_Shape_Constructor_to_raise_an_exception: "**bingo**",

                name: "yo" ,
                shapeType: ShapeType.HEXAGON ,
                color: Color.BLUE });

        }).should.throw();

        // restore stdout
        process.stdout.write = old_process_stdout_write;
    });

});

describe("Factories: testing strong typed enums", function(){

    it('installEnumProp should append a member as a strong typed enum',function(){

        var ShapeType = factories.registerEnumeration( {
            name: "EnumShapeType-2",
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

        company.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(Company_Schema.id));

    });

    it("should create a object from a encodingDefaultBinaryId", function() {

        var getObjectClassName = require("../../lib/misc/utils").getObjectClassName;

        var obj = factories.constructObject(ec.makeExpandedNodeId(Company_Schema.id));

        should(obj).have.property("_schema");
        obj._schema.name.should.equal("Company");

        getObjectClassName(obj).should.equal("Object");

    });



    it("should encode and decode a Object containing ByteString",function(done){

        var Blob_Schema = {
            id: factories.next_available_id(),
            name: "FakeBlob",
            fields: [
                { name: "name",                     fieldType: "String"     },
                { name: "buffer0",                  fieldType: "ByteString" },
                { name: "buffer1",                  fieldType: "ByteString" }
            ]
        };

        var Blob = factories.registerObject(Blob_Schema);

        var blob = new Blob({ buffer0: new Buffer(0), buffer1: new Buffer(1024) });

        encode_decode_round_trip_test(blob);

        done();

    });
    it("should pretty print an object ",function(){

        var company  = new Company({name: "ACME" });
        var employee = new Employee({lastName: "John", service: "R&D" });
        company.employees.push(employee);
        company.employees.push(new Employee({ lastName: "Peter", service: "R&D" }));

        var str = company.explore();

        // console.log(str);

    });


    describe("ExtensionObject",function(){
        var MetaShape_Schema = {
            name: "metashape",
            id: factories.next_available_id(),
            fields: [
                { name: "name",                     fieldType: "String"          },
                { name: "shape",                    fieldType: "ExtensionObject" },
                { name: "comment",                  fieldType: "String" }
            ]
        };

        var MetaShape = factories.registerObject(MetaShape_Schema);

        it("should work with some missing ExtensionObject ",function(){

            var shape  = new MetaShape({
                name: "MyCircle",
                shape: null,
                comment:  "this is a comment"
            });
            shape.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(MetaShape_Schema.id));

            var stream = new BinaryStream(shape.binaryStoreSize());
            shape.encode(stream);
            encode_decode_round_trip_test(shape);
        });

        it("should work with some existing ExtensionObject ",function(){

            var shape  = new MetaShape({
                name: "MyCircle",
                shape: new Shape({name: "circle" , shapeType:ShapeType.CIRCLE , color: Color.BLUE}),
                comment:  "this is a comment"
            });
            shape.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(MetaShape_Schema.id));

            var stream = new BinaryStream(shape.binaryStoreSize());
            shape.encode(stream);

            encode_decode_round_trip_test(shape);

        });
    });

});

describe("PacketAnalyzer",function(){
    it("should analyse a encoded object",function(done){
        var analyze_object_binary_encoding = require("../../lib/misc/packet_analyzer").analyze_object_binary_encoding;

        var redirectToFile = require("../../lib/misc/utils").redirectToFile;

        var company  = new Company({
            name: "ACME",
            employees: [
                {  lastName: "John",  age: 25, service: "R&D" },
                {  lastName: "Peter", age: 56, service: "R&D" }
            ]
        });
        var stream = new BinaryStream(company.binaryStoreSize());
        company.encode(stream);

        redirectToFile("analyze_object_binary_encoding",function(){
            analyze_object_binary_encoding(company);
        },done);
    })
});

