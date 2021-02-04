import { AddressSpace, nodesets, generateAddressSpace, Variant, DataType, StatusCodes } from "node-opcua";

(async () => {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, [nodesets.standard]);

    const ownNameSpace = addressSpace.registerNamespace("urn:mynamespace");

    const fruitEnumType = ownNameSpace.addEnumerationType({
        browseName: "Fruits",
        enumeration: ["apple", "pear", "strawberry", "pineapple"]
    });

    let selected = "apple";

    const myObject = ownNameSpace.addObject({ browseName: "MyObject", organizedBy: addressSpace.rootFolder.objects });
    const v1 = ownNameSpace.addVariable({
        browseName: "Fruit",
        componentOf: myObject,
        dataType: fruitEnumType,
        value: {
            get: () =>
                new Variant({
                    dataType: DataType.String,
                    value: selected
                }),
            set: (value: Variant) => {
                selected = value.value;
                return StatusCodes.Good;
            }
        }
    });

    const fruit2 = ownNameSpace.addVariable({
        browseName: "Fruit2s",
        componentOf: myObject,
        dataType: fruitEnumType
    });
    fruit2.writeEnumValue("strawberry");
    console.log("enum value       = ", fruit2.readEnumValue());
    console.log("enum value name  = ", fruit2.readEnumValue().name);
    console.log("enum value value = ", fruit2.readEnumValue().value);

    console.log("dataValue is  ", fruit2.readValue().toString());
})();
