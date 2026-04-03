/**
 * Discrete variable types: TwoStateDiscrete, MultiStateDiscrete, MultiStateValueDiscrete.
 */
import type { Int64, UInt64 } from "node-opcua-basic-types";
import type { Namespace, UAObject } from "node-opcua-address-space";

function getDADiscreteTypeFolder(namespace: Namespace, parentFolder: UAObject): UAObject {
    const name = "Simulation_DA_DiscreteType";
    const nodeId = "s=Simulation_DA_DiscreteType";

    let node = parentFolder.getFolderElementByName(name);
    if (!node) {
        node = namespace.addObject({
            organizedBy: parentFolder,
            typeDefinition: "FolderType",
            browseName: name,
            nodeId
        });
    }
    return node as UAObject;
}

export function addTwoStateDiscreteVariables(namespace: Namespace, parentFolder: UAObject): void {
    const DADiscreteTypeFolder = getDADiscreteTypeFolder(namespace, parentFolder);

    const twoStateDiscrete001 = namespace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=TwoStateDiscrete001",
        browseName: "TwoStateDiscrete001",
        trueState: "Enabled",
        falseState: "Disabled"
    });

    const twoStateDiscrete002 = namespace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=TwoStateDiscrete002",
        browseName: "TwoStateDiscrete002",
        trueState: "On",
        falseState: "Off",
        optionals: ["TransitionTime", "EffectiveDisplayName"]
    });

    const twoStateDiscrete003 = namespace.addTwoStateDiscrete({
        browseName: "twoStateDiscrete003",
        nodeId: "s=TwoStateDiscrete003",
        optionals: ["TransitionTime"],
        isTrueSubStateOf: twoStateDiscrete002
    });

    const twoStateDiscrete004 = namespace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=TwoStateDiscrete004",
        browseName: "TwoStateDiscrete004",
        trueState: "InProgress",
        falseState: "Stopped"
    });

    const twoStateDiscrete005 = namespace.addTwoStateDiscrete({
        organizedBy: DADiscreteTypeFolder,
        nodeId: "s=TwoStateDiscrete005",
        browseName: "TwoStateDiscrete005",
        trueState: "InProgress",
        falseState: "Stopped"
    });

    twoStateDiscrete001.setValueFromSource({ dataType: "Boolean", value: false });
    twoStateDiscrete002.setValueFromSource({ dataType: "Boolean", value: false });
    twoStateDiscrete003.setValueFromSource({ dataType: "Boolean", value: false });
    twoStateDiscrete004.setValueFromSource({ dataType: "Boolean", value: false });
    twoStateDiscrete005.setValueFromSource({ dataType: "Boolean", value: false });
}

export function addMultiStateDiscreteVariable(namespace: Namespace, parentFolder: UAObject): void {
    const DADiscreteTypeFolder = getDADiscreteTypeFolder(namespace, parentFolder);

    for (let i = 1; i <= 5; i++) {
        const name = `MultiStateDiscrete${i.toString().padStart(3, "0")}`;
        namespace.addMultiStateDiscrete({
            organizedBy: DADiscreteTypeFolder,
            nodeId: `s=${name}`,
            browseName: name,
            enumStrings: ["Red", "Orange", "Green"],
            value: 1 // Orange
        });
    }
}

export function addMultiStateValueDiscreteVariables(namespaceDemo: Namespace, parentFolder: UAObject): void {
    const multistateValueDiscreteTypeFolder = namespaceDemo.addObject({
        organizedBy: parentFolder,
        typeDefinition: "FolderType",
        browseName: "Simulation_DA_MultiStateValueDiscreteType",
        nodeId: "s=Simulation_DA_MultiStateValueDiscreteType"
    });

    function _add_multi_state_variable(
        folder: UAObject,
        dataType: string,
        _value: number | UInt64 | Int64,
        enumValues: Record<string, number>
    ) {
        const name = `${dataType}MultiStateValueDiscrete`;
        const nodeId = `s=${name}`;

        namespaceDemo.addMultiStateValueDiscrete({
            organizedBy: folder,
            browseName: name,
            nodeId,
            dataType,
            enumValues,
            value: 0x0000 // Zero
        });
    }

    const enumValueUnsigned = { Zero: 0x00, One: 0x01, Two: 0x02, Three: 0x03, Four: 0x04, Five: 0x05, Six: 0x06, Seven: 0x07 };
    const enumValueSigned = { MinusOne: -1, MinusTwo: -2, MinusThree: -3, ...enumValueUnsigned };

    const data = [
        { dataType: "Int16", value: -1, enumValue: enumValueSigned },
        { dataType: "UInt16", value: 10, enumValue: enumValueUnsigned },
        { dataType: "Int32", value: -1, enumValue: enumValueSigned },
        { dataType: "UInt32", value: 100, enumValue: enumValueUnsigned },
        { dataType: "Int64", value: [0, 0], enumValue: enumValueUnsigned },
        { dataType: "UInt64", value: [0, 0], enumValue: enumValueSigned },
        { dataType: "Byte", value: 1, enumValue: enumValueUnsigned },
        { dataType: "SByte", value: -1, enumValue: enumValueSigned }
    ];
    for (const e of data) {
        _add_multi_state_variable(multistateValueDiscreteTypeFolder, e.dataType, e.value, e.enumValue);
    }
}
