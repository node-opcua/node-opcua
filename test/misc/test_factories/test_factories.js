require("requirish")._(module);
var factories = require("lib/misc/factories");
import createObject from "lib/misc/create-factory";
var should = require("should");
var BinaryStream = require("lib/misc/binaryStream").BinaryStream;
var util = require("util");
var ec = require("lib/misc/encode_decode");
var _ = require("underscore");

var redirectToFile = require("lib/misc/utils").redirectToFile;

var encode_decode_round_trip_test = require("test/helpers/encode_decode_round_trip_test").encode_decode_round_trip_test;

var QualifiedName = require("lib/datamodel/qualified_name").QualifiedName;
var LocalizedText = require("lib/datamodel/localized_text").LocalizedText;
var Variant = require("lib/datamodel/variant").Variant;



import  { 
  Person_Schema,
  Role_Schema,
  Employee_Schema,
  Company_Schema,
  ShapeType,
  Color,
  Shape_Schema,
  MyStruct_Schema,
  MyStruct2_Schema,
  FakeBlob_Schema,
  FakeBlob2_Schema,
  FakeBlob3_Schema,
  FakeQualifiedName_Schema,
  Blob4_Schema,
  Blob6_Schema
} from './test_factories_schema';



createObject(Person_Schema, "tmp", "_schema");
var Person = factories.registerObject(Person_Schema, "tmp");

createObject(Role_Schema, "tmp", "_schema");
var Role = factories.registerObject(Role_Schema, "tmp");

createObject(Employee_Schema, "tmp", "_schema");
var Employee = factories.registerObject(Employee_Schema, "tmp");

createObject(Company_Schema, "tmp", "_schema");
var Company = factories.registerObject(Company_Schema, "tmp");

createObject(Shape_Schema, "tmp", "_schema");
var Shape = factories.registerObject(Shape_Schema, "tmp");


describe("Factories: construction", function () {

    it("a schema should provide a list of possible fields", function () {

        Person.possibleFields.should.eql(["lastName", "address", "age"]);
        Employee.possibleFields.should.eql(["lastName", "address", "age", "role", "service", "salary"]);
    });
});


describe("Factories: testing object factory", function () {

    after(function () {
        try {
            factories.unregisterType("MyInteger");
        }
        catch (err) {/**/ }

    });
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

        var person = new Person({lastName: "Joe"});

        person.lastName.should.equal("Joe");
        person.address.should.equal("");
        person.age.should.equal(25);
    });

    it("should construct a new object from a complex Class Description", function () {

        var employee = new Employee({
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

        var person = new Person({lastName: "Joe"});
        person.age = 50;
        person.address = "Paris";

        var person_reloaded = encode_decode_round_trip_test(person);

        person.lastName.should.equal(person_reloaded.lastName);
        person.age.should.equal(person_reloaded.age);
        person.address.should.equal(person_reloaded.address);

    });

    it("should encode and decode a composite object created from the Factory", function () {

        var employee = new Employee({lastName: "John", service: "R&D"});
        encode_decode_round_trip_test(employee);

    });

    it("should encode and decode a composite object containing an array", function () {


        var company = new Company({name: "ACME"});
        company.employees.length.should.equal(0);


        var employee = new Employee({lastName: "John", service: "R&D"});

        company.employees.push(employee);
        company.employees.push(new Employee({lastName: "Peter", service: "R&D"}));

        company.employees.length.should.equal(2);

        encode_decode_round_trip_test(company);

    });

    it("should create an Object with a containing an array of JSON object passed in the initializer", function () {

        var company = new Company({
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

        var company = new Company({
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

    it("should handle subtype properly", function () {

        factories.registerBasicType({
            name: "MyInteger",
            subtype: "UInt16",
            defaultValue: 0
        });

        should.exist(factories.findSimpleType("MyInteger"));

        factories.unregisterObject(MyStruct_Schema, "tmp");

        createObject(MyStruct_Schema, "tmp", "_schema");

        var MyStruct = factories.registerObject(MyStruct_Schema, "tmp");

        var s = new MyStruct();
        s.should.have.property("value");
        s.value.should.equal(0);

        factories.unregisterObject(MyStruct_Schema, "tmp");

    });

    it("should handle StatusCode ", function () {

        var StatusCode = require("lib/datamodel/opcua_status_code").StatusCode;
        var StatusCodes = require("lib/datamodel/opcua_status_code").StatusCodes;

        factories.unregisterObject(MyStruct2_Schema, "tmp");

        createObject(MyStruct2_Schema, "tmp", "_schema");

        var MyStruct2 = factories.registerObject(MyStruct2_Schema, "tmp");

        var s = new MyStruct2();
        s.should.have.property("value");
        s.should.have.property("statusCode");
        s.value.should.equal(0);
        s.statusCode.value.should.equal(0);
        s.statusCode.should.eql(StatusCodes.Good);
        // should.eql(StatusCode.Good);
        factories.unregisterObject(MyStruct2_Schema, "tmp");

    });

    it('should handle enumeration properly', function () {

        var shape = new Shape();

        shape.shapeType.should.eql(ShapeType.CIRCLE);
        shape.name.should.eql("my shape");
        shape.color.should.eql(Color.GREEN);

        shape.inner_color.should.eql(Color.BLUE);

        shape.shapeType = ShapeType.RECTANGLE;
        shape.shapeType.should.equal(ShapeType.RECTANGLE);

        (function () {
            shape.setShapeType(34);
        }).should.throw();

    });
    it('should allow enumeration value to be passed in options during construction', function () {

        var shape1 = new Shape({shapeType: ShapeType.HEXAGON});
        shape1.shapeType.should.eql(ShapeType.HEXAGON);

        var shape2 = new Shape({shapeType: ShapeType.RECTANGLE});
        shape2.shapeType.should.eql(ShapeType.RECTANGLE);
    });

    it("should encode and decode a structure containing a enumeration properly", function () {

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, color: Color.BLUE});
        encode_decode_round_trip_test(shape);

    });

    it("should raise an exception when trying to pass an invalid field to constructor", function () {

        var schema_helpers =  require("lib/misc/factories_schema_helpers");

        var old_schema_helpers_doDebug = schema_helpers.doDebug();
        schema_helpers.setDebug(true);
        // redirect stdout to null as test will be noisy
        var old_process_stdout_write = process.stdout.write;

        (function test_constructor_with_invalid_args() {
            console.log('testing...§')
            var a = new Shape({

                this_invalid_field_should_cause_Shape_Constructor_to_raise_an_exception: "**bingo**",

                name: "yo",
                shapeType: ShapeType.HEXAGON,
                color: Color.BLUE
            });

        }).should.throw();

        schema_helpers.setDebug (old_schema_helpers_doDebug);
     });

});

describe("Factories: testing strong typed enums", function () {

    it("should throw if a invalid argument is passed for an enum", function () {


        ShapeType.CIRCLE.key.should.equal("CIRCLE");
        var value = ShapeType.CIRCLE;
        value.should.equal(ShapeType.CIRCLE);

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});

        (function () {
            shape.setShapeType("toto");
        }).should.throw();


    });

    it("should be possible to initialize enumeration with string values", function () {

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});
        var shape2 = new Shape({name: "yo", shapeType: "HEXAGON", inner_color: "RED", color: "BLUE"});

        shape.should.eql(shape2);

    });

    it("should be possible to initialize enumeration with integer values as well", function () {

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});
        var shape2 = new Shape({name: "yo", shapeType: 6, inner_color: 100, color: 200});

        shape.should.eql(shape2);

    });
});


describe("Factories: testing binaryStoreSize", function () {

    it("should implement binaryStoreSize", function () {

        var shape = new Shape();

        shape.binaryStoreSize().should.be.greaterThan(10);

    });
});

describe("Factories: testing encodingDefaultBinary and constructObject", function () {

    it("a factory object should have a encodingDefaultBinary", function () {

        var company = new Company({name: "ACME"});
        company.encodingDefaultBinary.should.eql(ec.makeExpandedNodeId(Company_Schema.id));

    });

    it("should create a object from a encodingDefaultBinaryId", function () {

        var getObjectClassName = require("lib/misc/utils").getObjectClassName;

        var obj = factories.constructObject(ec.makeExpandedNodeId(Company_Schema.id));

        should(obj).have.property("_schema");
        obj._schema.name.should.equal("Company");

        getObjectClassName(obj).should.equal("Object");

    });


    it("should encode and decode a Object containing ByteString", function (done) {

        factories.unregisterObject(FakeBlob_Schema, "tmp");

        createObject(FakeBlob_Schema, "tmp", "_schema");

        var Blob = factories.registerObject(FakeBlob_Schema, "tmp");

        var blob = new Blob({buffer0: new Buffer(0), buffer1: new Buffer(1024)});

        encode_decode_round_trip_test(blob);

        factories.unregisterObject(FakeBlob_Schema, "tmp");
        done();
    });
    it("should pretty print an object ", function () {

        redirectToFile("pretty_print.log", function () {
            var company = new Company({name: "ACME"});
            var employee = new Employee({lastName: "John", service: "R&D"});
            company.employees.push(employee);
            company.employees.push(new Employee({lastName: "Peter", service: "R&D"}));

            var str = company.explore();

            console.log(str);

        });

    });


});

describe("PacketAnalyzer", function () {

    it("should analyse a encoded object", function (done) {
        var analyze_object_binary_encoding = require("lib/misc/packet_analyzer").analyze_object_binary_encoding;

        var redirectToFile = require("lib/misc/utils").redirectToFile;

        var company = new Company({
            name: "ACME",
            employees: [
                {lastName: "John", age: 25, service: "R&D"},
                {lastName: "Peter", age: 56, service: "R&D"}
            ]
        });
        var stream = new BinaryStream(company.binaryStoreSize());
        company.encode(stream);

        redirectToFile("analyze_object_binary_encoding", function () {
            analyze_object_binary_encoding(company);
        }, done);
    });
});


describe("Testing that objects created by factory can be persisted as JSON string", function () {


    it("should persist and restore a object in JSON ", function () {

        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});

        var str = JSON.stringify(shape);

        var obj = new Shape(JSON.parse(str));

        obj.should.eql(shape);

    });

    it("should persist and restore a object in JSON when field has a special toJSON behavior", function () {

        factories.unregisterObject(FakeBlob2_Schema, "tmp");
        createObject(FakeBlob2_Schema, "tmp", "_schema");

        var Blob = factories.registerObject(FakeBlob2_Schema, "tmp");

        var blob = new Blob({
            buffer0: new Buffer("00FF00AA", "hex"),
            nodeId: "ns=1;s=toto"
        });
        var str = JSON.stringify(blob);

        var obj = new Blob(JSON.parse(str));

        obj.should.eql(blob);
        factories.unregisterObject(FakeBlob2_Schema, "tmp");
    });

    it("should persist and restore a object in JSON when field is a array of value with special toJSON behavior", function () {

        factories.unregisterObject(FakeBlob3_Schema, "tmp");
        
        createObject(FakeBlob3_Schema, "tmp", "_schema");

        var Blob = factories.registerObject(FakeBlob3_Schema, "tmp");

        var blob = new Blob({
            buffer0: [new Buffer("01020304", "hex"), [0, 1, 2, 3, 4]],
            nodeId: ["ns=1;s=toto", "ns=2;i=1234"]
        });

        blob.buffer0[0].should.be.instanceOf(Buffer);
        blob.buffer0[1].should.be.instanceOf(Buffer);

        var str = JSON.stringify(blob);

        console.log("JSON string".yellow, str.cyan);

        var obj = new Blob(JSON.parse(str));

        obj.buffer0[0].should.eql(blob.buffer0[0]);
        obj.buffer0[1].should.eql(blob.buffer0[1]);
        obj.should.eql(blob);

        factories.unregisterObject(FakeBlob3_Schema, "tmp");

    });


    it("should persist and restore a object in JSON when field has a null value", function () {

        factories.unregisterObject(FakeQualifiedName_Schema, "tmp");
        
        createObject(FakeQualifiedName_Schema, "tmp", "_schema");

        var QualifiedName = factories.registerObject(FakeQualifiedName_Schema, "tmp");


        var qname = new QualifiedName({
            namespaceIndex: 0
        });

        qname.toString().should.eql("ns=0 name=null");

        should(_.isFinite(qname.namespaceIndex)).be.equal(true);
        qname.namespaceIndex.should.equal(0);

        var str = JSON.stringify(qname);
        str.should.eql("{\"namespaceIndex\":0}");

        var obj = new QualifiedName(JSON.parse(str));
        obj.namespaceIndex.should.equal(0);
        should(_.isFinite(obj.namespaceIndex)).be.equal(true);

        obj.should.eql(qname);

        encode_decode_round_trip_test(qname);

        factories.unregisterObject(FakeQualifiedName_Schema, "tmp");
    });
});
describe("factories testing advanced cases", function () {

    it("should set a field to null when default value is specifically null and no value has been provided", function () {

        factories.unregisterObject(Blob4_Schema, "tmp");
        createObject(Blob4_Schema, "tmp", "_schema");
        var Blob4 = factories.registerObject(Blob4_Schema, "tmp");

        var blob4 = new Blob4({
            createdOn: null
        });
        should(blob4.createdOn).be.eql(null);
        factories.unregisterObject(Blob4_Schema, "tmp");

    });

    it("should accept all basic types as field scalar or field arrays", function () {

        var utils = require("lib/misc/utils");
        var fs = require("fs");
        // delete existing file if any
        var filename = utils.getTempFilename("_auto_generated_Blob6.js");
        if (fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }

        var ExtensionObject = require("lib/misc/extension_object").ExtensionObject;


        var _defaultTypeMap = require("lib/misc/factories_builtin_types")._defaultTypeMap;
        var findBuiltInType = require("lib/misc/factories_builtin_types").findBuiltInType;

        Object.keys(_defaultTypeMap).forEach(function (key) {
            if (key === "Any") { return; }

            Blob6_Schema.fields.push({name: "value_" + key, fieldType: key});
            Blob6_Schema.fields.push({name: "array_" + key, fieldType: key, isArray: true});
        });


        var options = {};
        Object.keys(_defaultTypeMap).forEach(function (key) {
            if (key === "Any" || key === "Null" || key === "AccessLevelFlag") { return; }
            var type = _defaultTypeMap[key];

            var random = type.random || ec["random" + type.name];

            if (_.isFunction(random)) {
                options["value_" + key] = random();
                options["array_" + key] = [random(), random()];
            }
        });       
        createObject(Blob6_Schema, "tmp", "_schema");
        var Blob6 = factories.registerObject(Blob6_Schema, "tmp");

        var blob = new Blob6(options);
        //xx console.log(blob);
        encode_decode_round_trip_test(blob);

        factories.unregisterObject(Blob6_Schema, "tmp");
    });

    it("should help JSON.stringify", function () {

        var someArray = [new Person({})];

        var str = JSON.stringify({stuff: someArray}, null, " ");
        //xx console.log("xxxx str =",str);

    });
});

describe("BaseUAObject#clone ",function() {

    function compare_obj_by_encoding(obj1,obj2) {
        function encoded(obj) {
            var stream = new BinaryStream(obj.binaryStoreSize());
            obj.encode(stream);
            return stream._buffer.toString("hex");
        }
        encoded(obj1).should.eql(encoded(obj2));

    }

    it("should clone an object ", function () {
        var company = new Company({name: "ACME"});
        var employee = new Employee({lastName: "John", service: "R&D"});
        company.employees.push(employee);
        company.employees.push(new Employee({lastName: "Peter", service: "R&D"}));

        var company_copy = company.clone();

        company_copy.constructor.name.should.eql("Company");
        company_copy.name.should.eql("ACME");
        company_copy.employees.length.should.eql(2);
        company_copy.employees[0].lastName.should.eql("John");
        company_copy.employees[0].service.should.eql("R&D");
        company_copy.employees[1].lastName.should.eql("Peter");
        company_copy.employees[1].service.should.eql("R&D");
        compare_obj_by_encoding(company,company_copy);
    });

    it("should clone a Shape",function() {
        var shape = new Shape({name: "yo", shapeType: ShapeType.HEXAGON, inner_color: Color.RED, color: Color.BLUE});
        var shape_clone = shape.clone();
        compare_obj_by_encoding(shape,shape_clone);
    });



});
