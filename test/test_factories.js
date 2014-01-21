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

describe("testing object factory",function() {

    it("should construct a new factory from a Class Description",function(){


        var Person = factories.UAObjectFactoryBuild(Person_Description);
        var person = new Person({lastName:"Joe"});

        person.lastName.should.equal("Joe");
        person.address.should.equal("");
        person.age.should.equal(25);
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