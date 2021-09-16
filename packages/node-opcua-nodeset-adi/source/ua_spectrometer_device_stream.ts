// ----- this file has been automatically generated - do not edit
import { UAObject } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { EUInformation } from "node-opcua-data-access"
import { UInt32, Int32, UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { DTAxisInformation } from "node-opcua-nodeset-ua/source/dt_axis_information"
import { UAYArrayItem } from "node-opcua-nodeset-ua/source/ua_y_array_item"
import { UADataItem } from "node-opcua-nodeset-ua/source/ua_data_item"
import { UAStream_parameterSet, UAStream_configuration, UAStream_acquisitionSettings, UAStream_acquisitionStatus, UAStream_acquisitionData, UAStream, UAStream_Base } from "./ua_stream"
export interface UASpectrometerDeviceStream_parameterSet extends UAStream_parameterSet { // Object
      activeBackground: UAYArrayItem<number, /*z*/DataType.Float>;
      activeBackground1?: UAYArrayItem<number, /*z*/DataType.Float>;
      spectralRange?: UADataItem<DTRange[], /*z*/DataType.ExtensionObject>;
      resolution?: UADataItem<any, any>;
      requestedNumberOfScans?: UADataItem<Int32, /*z*/DataType.Int32>;
      gain?: UADataItem<any, any>;
      transmittanceCutoff?: UADataItem<DTRange, /*z*/DataType.ExtensionObject>;
      absorbanceCutoff?: UADataItem<DTRange, /*z*/DataType.ExtensionObject>;
      numberOfScansDone?: UADataItem<Int32, /*z*/DataType.Int32>;
      totalNumberOfScansDone: UADataItem<Int32, /*z*/DataType.Int32>;
      backgroundAcquisitionTime: UADataItem<Date, /*z*/DataType.DateTime>;
      pendingBackground: UAYArrayItem<number, /*z*/DataType.Float>;
      pendingBackground1?: UAYArrayItem<number, /*z*/DataType.Float>;
}
export interface UASpectrometerDeviceStream_configuration extends UAStream_configuration { // Object
      activeBackground: UAYArrayItem<number, /*z*/DataType.Float>;
      activeBackground1?: UAYArrayItem<number, /*z*/DataType.Float>;
}
export interface UASpectrometerDeviceStream_acquisitionSettings extends UAStream_acquisitionSettings { // Object
      spectralRange?: UADataItem<DTRange[], /*z*/DataType.ExtensionObject>;
      resolution?: UADataItem<any, any>;
      requestedNumberOfScans?: UADataItem<Int32, /*z*/DataType.Int32>;
      gain?: UADataItem<any, any>;
      transmittanceCutoff?: UADataItem<DTRange, /*z*/DataType.ExtensionObject>;
      absorbanceCutoff?: UADataItem<DTRange, /*z*/DataType.ExtensionObject>;
}
export interface UASpectrometerDeviceStream_acquisitionStatus extends UAStream_acquisitionStatus { // Object
      numberOfScansDone?: UADataItem<Int32, /*z*/DataType.Int32>;
}
export interface UASpectrometerDeviceStream_acquisitionData extends UAStream_acquisitionData { // Object
      totalNumberOfScansDone: UADataItem<Int32, /*z*/DataType.Int32>;
      backgroundAcquisitionTime: UADataItem<Date, /*z*/DataType.DateTime>;
      pendingBackground: UAYArrayItem<number, /*z*/DataType.Float>;
      pendingBackground1?: UAYArrayItem<number, /*z*/DataType.Float>;
}
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:SpectrometerDeviceStreamType ns=2;i=1030        |
 * |isAbstract      |false                                             |
 */
export interface UASpectrometerDeviceStream_Base extends UAStream_Base {
    /**
     * parameterSet
     * Flat list of Parameters
     */
    parameterSet?: UASpectrometerDeviceStream_parameterSet;
    configuration: UASpectrometerDeviceStream_configuration;
    acquisitionSettings: UASpectrometerDeviceStream_acquisitionSettings;
    acquisitionStatus: UASpectrometerDeviceStream_acquisitionStatus;
    acquisitionData: UASpectrometerDeviceStream_acquisitionData;
    factorySettings: UAObject;
}
export interface UASpectrometerDeviceStream extends Omit<UAStream, "parameterSet"|"configuration"|"acquisitionSettings"|"acquisitionStatus"|"acquisitionData">, UASpectrometerDeviceStream_Base {
}