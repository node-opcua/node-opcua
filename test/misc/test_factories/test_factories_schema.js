import {
  next_available_id,
  registerEnumeration
} from "lib/misc/factories";

const Person_Schema = {
  id: next_available_id(),
  name: "Person",
  fields: [
    { name: "lastName", fieldType: "UAString" },
    { name: "address", fieldType: "UAString" },
    { name: "age", fieldType: "Int32", defaultValue: 25 }
  ]
};
const Role_Schema = {
  id: next_available_id(),
  name: "Role",
  fields: [
    { name: "title", fieldType: "UAString" },
    { name: "description", fieldType: "UAString" }
  ]
};

const Employee_Schema = {
  id: next_available_id(),
  name: "Employee",
  baseType: "Person",
  fields: [
    { name: "role", fieldType: "Role" },
    { name: "service", fieldType: "UAString" },
    { name: "salary", fieldType: "Double", defaultValue: 1000.00 }
  ]
};

const Company_Schema = {
  id: next_available_id(),
  name: "Company",
  fields: [
    { name: "name", fieldType: "String" },
    { name: "employees", isArray: true, fieldType: "Employee" },
    { name: "company_values", isArray: true, fieldType: "String" }
  ]
};

const ShapeType = registerEnumeration({
  name: "EnumShapeType",
  enumValues: {
    CIRCLE: 1,
    SQUARE: 2,
    RECTANGLE: 3,
    HEXAGON: 6
  }
});

const Color = registerEnumeration({
  name: "EnumColor",
  enumValues: {
    RED: 100,
    BLUE: 200,
    GREEN: 300
  }
});

const Shape_Schema = {
  id: next_available_id(),
  name: "Shape",
  fields: [
    {
      name: "name", fieldType: "String", defaultValue: function () {
        return "my shape";
      }
    },
    { name: "shapeType", fieldType: "EnumShapeType" },
    { name: "color", fieldType: "EnumColor", defaultValue: Color.GREEN },
    {
      name: "inner_color", fieldType: "EnumColor", defaultValue: function () {
        return Color.BLUE;
      }
    }
  ]
};

const MyStruct_Schema = {
  name: "MyStruct",
  id: next_available_id(),
  fields: [
    { name: "value", fieldType: "MyInteger" }
  ]
};
const MyStruct2_Schema = {
  name: "MyStruct2",
  id: next_available_id(),
  fields: [
    { name: "value", fieldType: "MyInteger" },
    { name: "statusCode", fieldType: "StatusCode" }
  ]
};
const FakeBlob_Schema = {
  id: next_available_id(),
  name: "FakeBlob",
  fields: [
    { name: "name", fieldType: "String" },
    { name: "buffer0", fieldType: "ByteString" },
    { name: "buffer1", fieldType: "ByteString" }
  ]
};
const FakeBlob2_Schema = {
  id: next_available_id(),
  name: "FakeBlob2",
  fields: [
    { name: "name", fieldType: "String" },
    { name: "buffer0", fieldType: "ByteString" },
    { name: "nodeId", fieldType: "NodeId" },
    { name: "createdOn", fieldType: "DateTime" }
  ]
};

const FakeBlob3_Schema = {
  id: next_available_id(),
  name: "FakeBlob3",
  fields: [
    { name: "name", fieldType: "String" },
    { name: "buffer0", isArray: true, fieldType: "ByteString" },
    { name: "nodeId", isArray: true, fieldType: "NodeId" }
  ]
};
const FakeQualifiedName_Schema = {
  name: "FakeQualifiedName",
  id: next_available_id(),
  fields: [
    { name: "namespaceIndex", fieldType: "UInt16", documentation: "The namespace index" },
    {
      name: "name", fieldType: "String", defaultValue: function () {
        return null;
      }, documentation: "The name"
    }
  ],

  toString: function () {
    return "ns=" + this.namespaceIndex + " name=" + this.name;
  }
};

const Blob4_Schema = {
  name: "Blob4",
  id: next_available_id(),
  fields: [
    { name: "createdOn", fieldType: "DateTime", defaultValue: null }
  ]
};
const Blob6_Schema = {
  name: "Blob6",
  id: next_available_id(),
  fields: []
};





////////


export { 
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
};





