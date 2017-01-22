import { registerObject } from "lib/misc/factories";
import createObject from "lib/misc/create-factory";


import { 
    DummyObject_Schema,
    SomeEnumeration,
    FooBar_Schema,
    FooBarDerived_Schema 
} from './fixture_dummy_object_schema';

createObject(FooBar_Schema, "tmp", "_schema");
exports.FooBar = registerObject(FooBar_Schema, "tmp");

createObject(DummyObject_Schema, "tmp", "_schema");
exports.DummyObject = registerObject(DummyObject_Schema, "tmp");

createObject(FooBarDerived_Schema, "tmp", "_schema");

exports.FooBarDerived = registerObject(FooBarDerived_Schema, "tmp");
