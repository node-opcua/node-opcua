import * as fs from "fs";
import * as path from "path";

import { DataTypeFactory } from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import "node-opcua-data-model";
import "node-opcua-variant";
import { parseBinaryXSDAsync, toTypeScript, TypeDictionary } from "../source";
import { MockProvider } from "./mock_id_provider";

function n(i: number): NodeId {
    return new NodeId(NodeId.NodeIdType.NUMERIC, i, 1);
}

const idProvider = new MockProvider();

describe("CTS-1 convert Extension Object definition to Typescript 1", () => {
    let dataTypeFactory: DataTypeFactory;
    before(async () => {
        const sample_file = path.join(__dirname, "fixtures/sample_type.xsd");
        const sample = fs.readFileSync(sample_file, "ascii");

        dataTypeFactory = new DataTypeFactory([]);
        await parseBinaryXSDAsync(sample, idProvider, dataTypeFactory);
    });

    it("should convert a dynamic object definition to typescript - 1", () => {
        const str = toTypeScript(dataTypeFactory);
        str.should.eql( 
            `import {
    ByteString,
    DateTime,
    Double,
    Guid,
    Int32,
    LocalizedText,
    UAString
} from "node-opcua";
export enum HeaterStatus {
    Off = 0,
    Heating = 1,
    Cooling = 2,
}
export enum Priority {
    Low = 10,
    Normal = 40,
    High = 70,
    Urgent = 90,
    Immediate = 100,
}
interface AccessRights {
    value: ByteString;
    validBits: ByteString;
}
interface StructWithOnlyOptionals {
    optionalInt32?: Int32;
    optionalStringArray?: UAString[];
}
interface StructureWithOptionalFields {
    mandatoryInt32: Int32;
    optionalInt32?: Int32;
    mandatoryStringArray: UAString[];
    optionalStringArray?: UAString[];
}
interface UnionTest1 {
    switchField: 1;
    int32: Int32;
}
interface UnionTest2 {
    switchField: 2;
    string: UAString;
}
type UnionTest = UnionTest1 | UnionTest2;
interface Vector {
    x: Double;
    y: Double;
    z: Double;
}
interface WorkOrderStatusType {
    actor: UAString;
    timestamp: DateTime;
    comment: LocalizedText;
}
interface WorkOrderType {
    ID: Guid;
    assetID: UAString;
    startTime: DateTime;
    statusComments: WorkOrderStatusType[];
}`
        );
    });
});
describe("convert Extension Object definition to Typescript 2", () => {
    let dataTypeFactory: DataTypeFactory;
    before(async () => {
        const sample_file = path.join(__dirname, "fixtures/sample_type2.xsd");
        const sample = fs.readFileSync(sample_file, "ascii");
        dataTypeFactory = new DataTypeFactory([]);
        await parseBinaryXSDAsync(sample, idProvider, dataTypeFactory);
    });

    it("should convert a dynamic object definition to typescript - 2", () => {
        const str = toTypeScript(dataTypeFactory);

        str.should.eql(
            `import {
    ByteString,
    DateTime,
    Double,
    Int32,
    LocalizedText,
    UABoolean,
    UAString,
    Variant
} from "node-opcua";
export enum SystemStateDataType {
    PRD_1 = 1,
    SBY_2 = 2,
    ENG_3 = 3,
    SDT_4 = 4,
    UDT_5 = 5,
    NST_6 = 6,
}
export enum TriStateBooleanDataType {
    FALSE_0 = 0,
    TRUE_1 = 1,
    DONTCARE_2 = 2,
}
interface ConfigurationIdDataType {
    id: UAString;
    major?: Int32;
    minor?: Int32;
    version?: UAString;
    description?: LocalizedText;
}
interface ConfigurationDataType {
    externalId: ConfigurationIdDataType;
    internalId: ConfigurationIdDataType;
    lastModified: DateTime;
    hasTransferableDataOnFile?: UABoolean;
}
interface ConfigurationTransferOptions {
    internalId: ConfigurationIdDataType;
}
interface JobIdDataType {
    id: UAString;
}
interface MeasIdDataType {
    id: UAString;
    description?: LocalizedText;
}
interface PartIdDataType {
    id: UAString;
    description?: LocalizedText;
}
interface ProcessingTimesDataType {
    startTime: DateTime;
    endTime: DateTime;
    acquisitionDuration?: Double;
    processingDuration?: Double;
}
interface ProductIdDataType {
    id: UAString;
    description?: LocalizedText;
}
interface ProductDataType {
    externalId: ProductIdDataType;
}
interface RecipeIdBaseDataType {
    id: UAString;
    version?: UAString;
    hash?: ByteString;
    hashAlgorithm?: UAString;
    description?: LocalizedText;
}
// tslint:disable-next-line: no-empty-interface
interface RecipeIdExternalDataType extends RecipeIdBaseDataType {
}
// tslint:disable-next-line: no-empty-interface
interface RecipeIdInternalDataType extends RecipeIdBaseDataType {
}
interface RecipeTransferOptions {
    internalId: RecipeIdInternalDataType;
}
interface ResultIdDataType {
    id: UAString;
}
interface ResultDataType {
    id: ResultIdDataType;
    hasTransferableDataOnFile?: UABoolean;
    isPartial: UABoolean;
    isSimulated: UABoolean;
    resultState: Int32;
    measId?: MeasIdDataType;
    partId?: PartIdDataType;
    externalRecipeId?: RecipeIdExternalDataType;
    internalRecipeId?: RecipeIdInternalDataType;
    productId?: ProductIdDataType;
    jobId?: JobIdDataType;
    creationTime: DateTime;
    processingTimes?: ProcessingTimesDataType;
    resultContent?: Variant[];
}
interface ResultTransferOptions {
    id: ResultIdDataType;
}
interface SystemStateDescriptionDataType {
    state: SystemStateDataType;
    stateDescription?: UAString;
}`
        );
    });
});
