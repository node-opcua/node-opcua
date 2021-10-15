/**
 * @module node-opcua-data-model
 */
// tslint:disable:no-bitwise

// Specifies the NodeClasses of the TargetNodes. Only TargetNodes with the
// selected NodeClasses are returned. The NodeClasses are assigned the
// following bits:
// If set to zero, then all NodeClasses are returned.
// @example
//    var mask = NodeClassMask.get("Object |  ObjectType");
//    mask.value.should.eql(1 + (1<<3));

export enum NodeClassMask {
    Object = 1 << 0,
    Variable = 1 << 1,
    Method = 1 << 2,
    ObjectType = 1 << 3,
    VariableType = 1 << 4,
    ReferenceType = 1 << 5,
    DataType = 1 << 6,
    View = 1 << 7
}

interface Enum {
    [id: string]: number;
}

function makeFlagFromString<Type>(type: Enum, str: string): Type {
    const flags = str.split(" | ");
    let result: any = 0;
    for (const flag of flags) {
        result |= type[flag];
    }
    return result as Type;
}

// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
export function makeNodeClassMask(str: string): NodeClassMask {
    const classMask = makeFlagFromString<NodeClassMask>(NodeClassMask as any, str);
    /* istanbul ignore next */
    if (!classMask) {
        throw new Error(" cannot find class mask for " + str);
    }
    return classMask;
}
