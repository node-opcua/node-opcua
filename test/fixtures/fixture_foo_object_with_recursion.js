import { FooWithRecursion_Schema } from './fixture_foo_object_with_recursion_schema';
import { registerObject } from "lib/misc/factories";
import createObject from "lib/misc/create-factory";

createObject(FooWithRecursion_Schema, "tmp", "_schema");

exports.FooWithRecursion = registerObject(FooWithRecursion_Schema, "tmp");
