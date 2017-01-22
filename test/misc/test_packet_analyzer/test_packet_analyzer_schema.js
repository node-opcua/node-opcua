import {
  next_available_id
} from "lib/misc/factories";

const Person2_Schema = {
    id: next_available_id(),
    name: "Person2",
    fields: [
        {name: "lastName", fieldType: "UAString"},
        {name: "address", fieldType: "UAString"},
        {name: "age", fieldType: "Int32", defaultValue: 25}
    ]
};

export { Person2_Schema }