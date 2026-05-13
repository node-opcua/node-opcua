import type { UAObject } from "node-opcua-address-space-base";
import type { Int32 } from "node-opcua-basic-types";
import type { DTRange } from "node-opcua-nodeset-ua/dist/dt_range";
import type { UADataItem } from "node-opcua-nodeset-ua/dist/ua_data_item";
import type { UAYArrayItem } from "node-opcua-nodeset-ua/dist/ua_y_array_item";
import type { DataType } from "node-opcua-variant";

import type { UAStream, UAStream_acquisitionData, UAStream_acquisitionSettings, UAStream_acquisitionStatus, UAStream_Base, UAStream_configuration, UAStream_parameterSet } from "./ua_stream";

// ----- this file has been automatically generated - do not edit

export interface UASpectrometerDeviceStream_parameterSet extends UAStream_parameterSet { // Object
      activeBackground: UAYArrayItem<number, DataType.Float>;
      activeBackground1?: UAYArrayItem<number, DataType.Float>;
      spectralRange?: UADataItem<DTRange[], DataType.ExtensionObject>;
      resolution?: UADataItem<any, any>;
      requestedNumberOfScans?: UADataItem<Int32, DataType.Int32>;
      gain?: UADataItem<any, any>;
      transmittanceCutoff?: UADataItem<DTRange, DataType.ExtensionObject>;
      absorbanceCutoff?: UADataItem<DTRange, DataType.ExtensionObject>;
      numberOfScansDone?: UADataItem<Int32, DataType.Int32>;
      totalNumberOfScansDone: UADataItem<Int32, DataType.Int32>;
      backgroundAcquisitionTime: UADataItem<Date, DataType.DateTime>;
      pendingBackground: UAYArrayItem<number, DataType.Float>;
      pendingBackground1?: UAYArrayItem<number, DataType.Float>;
}
export interface UASpectrometerDeviceStream_configuration extends UAStream_configuration { // Object
      activeBackground: UAYArrayItem<number, DataType.Float>;
      activeBackground1?: UAYArrayItem<number, DataType.Float>;
}
export interface UASpectrometerDeviceStream_acquisitionSettings extends UAStream_acquisitionSettings { // Object
      spectralRange?: UADataItem<DTRange[], DataType.ExtensionObject>;
      resolution?: UADataItem<any, any>;
      requestedNumberOfScans?: UADataItem<Int32, DataType.Int32>;
      gain?: UADataItem<any, any>;
      transmittanceCutoff?: UADataItem<DTRange, DataType.ExtensionObject>;
      absorbanceCutoff?: UADataItem<DTRange, DataType.ExtensionObject>;
}
export interface UASpectrometerDeviceStream_acquisitionStatus extends UAStream_acquisitionStatus { // Object
      numberOfScansDone?: UADataItem<Int32, DataType.Int32>;
}
export interface UASpectrometerDeviceStream_acquisitionData extends UAStream_acquisitionData { // Object
      totalNumberOfScansDone: UADataItem<Int32, DataType.Int32>;
      backgroundAcquisitionTime: UADataItem<Date, DataType.DateTime>;
      pendingBackground: UAYArrayItem<number, DataType.Float>;
      pendingBackground1?: UAYArrayItem<number, DataType.Float>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                            |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SpectrometerDeviceStreamType i=1030                         |
 * |isAbstract      |false                                                       |
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
export interface UASpectrometerDeviceStream extends Omit<UAStream, "parameterSet"|"configuration"|"acquisitionSettings"|"acquisitionStatus"|"acquisitionData">, UASpectrometerDeviceStream_Base {}