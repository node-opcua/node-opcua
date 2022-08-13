## introduction

this package provides an implementation of the OPCUA File Transfer
specification as per OPCUA 1.0.4 part 5 Annex C (page 99)
 

## installation

```bash
$ npm install node-opcua
$ npm install node-opcua-file-transfer
```

## exposing a File node in the addressSpace

```javascript
import { OPCUAServer, UAFile } from "node-opcua";
import { installFileType } from "node-opcua-file-transfer";

```

```typescript

const server = new OPCUAServer({

});

await server.initialize();


// let say we want to create a access to this file:
const my_data_filename = "/data/someFile.txt";
await promisify(fs.writeFile)(my_data_filename, "some content", "utf8");


// now add a file object in the address Space
const addressSpace = server.engine.addressSpace;

// retrieve the FileType UAObjectType
const fileType = addressSpace.findObjectType("FileType")!;

// create a instance of FileType 
const myFile = fileType.instantiate({
    nodeId: "s=MyFile",
    browseName: "MyFile",
    organizedBy: addressSpace.rootFolder.objects
}) as UAFile;

// now bind the opcuaFile object with our file
installFileType(opcuaFile, { 
    filename: my_data_filename
});

```


## accessing a File node from a node-opcua client : ClientFile

We assume that we have a valid OPCUA Client Session

```javascript
import { OPCUAClient } from "node-opcua";
import { ClientFile } from "node-opcua-file-transfer";

const client = OPCUAClient.create({});

await client.connect();
const session = await client.createSession();
```

Let's assume that the nodeId of the file object is "ns=1;s=MyFile"

```javascript
import {ClientFile,OpenFileMode } from "node-opcua-file-transfer";

// 
const fileNodeId = "ns=1;s=MyFile";

// let's create a client file object from the session and nodeId
const clientFile = new ClientFile(session, fileNodeId);

// let's open the file
const mode = OpenFileMode.ReadWriteAppend;
await clientFile.open(mode);

// ... do some reading or writing

// don't forget to close the file when done
await clientFile.close();
```

### operations

#### ClientFile#size(): Promise<UInt64> :  get file size

You can read the size of the file at any time.
``` javascript
const clientFile = new ClientFile(session, fileNodeId);

const size = await clientFile.size();
console.log("the current file size is : ",size," bytes);
```

#### ClientFile#open(mode: OpenFileMode) : open a file

```javascript 
const mode = OpenFileMode.ReadWriteAppend;
await clientFile.open(mode);
```

#### OpenFileMode enumeration

| Mode | Description |
|------|-------------|
| Read  |The file is opened for reading. The Write method cannot be executed. |
| Write|The file is opened for writing. The Read cannot be executed. |
| ReadWrite| The file is opened for reading and writing |
| WriteEraseExisting | File is open for writing only. The existing content of the file is erased and an empty file is provided. |
| WriteAppend | File is open for writing only and the position is set at the end of the file |
| ReadWriteAppend | File is opened for reading and writing and the position is set at the end of the file |
}
#### ClientFile#close() : close a file

```javascript 
const mode = OpenFileMode.ReadWriteAppend;
await clientFile.open(mode);

// ... do some reading or writing

// don't forget to close the file when done
await clientFile.close();
```
#### ClientFile#setPosition(pos: UInt64) :  Setting read/write position

Once the file is opened, the position for reading or writing can be set
using setPosition. 
* setPosition expect a UInt64 parameter (see note below)
* setPosition will throw an exception if file is not opened

``` javascript
const clientFile = new ClientFile(session, fileNodeId);

const mode = OpenFileMode.ReadWriteAppend;
await clientFile.open(mode);

await client.setPosition([0,32]);

```

#### ClientFile#getPosition(): Promise<UInt64> Getting read/write position
Once the file is opened, the position for reading or writing can be retrieved
using getPosition. 
* getPosition returns a UInt64 parameter (see note below)
* getPosition will throw an exception if file is not opened

``` javascript
const clientFile = new ClientFile(session, fileNodeId);

const mode = OpenFileMode.ReadWriteAppend;
await clientFile.open(mode);

await client.setPosition(32);

```

#### ClientFile#write(buf: Buffer) : Writing data to the file

Data can be writing to the file at the current cursor position.
Data must be passed in a buffer.
* write will throw an exception if file is not opened

```javascript
const dataToWrite = Buffer.from("Some data");

const mode = OpenFileMode.ReadWriteAppend;
await clientFile.open(mode);
await clientFile.write(dataToWrite);
```


#### ClientFile#read(): Promise<Buffer> :reading data to the file

Data can be written to the file at the current cursor position.
Data must be passed in a buffer.
* read will throw an exception if the file is not opened

```javascript

const mode = OpenFileMode.ReadWriteAppend;
await clientFile.open(mode);

// read 200 bytes from position 32
await clientFile.setPosition([0,32]);
const data: Buffer = await clientFile.read(200);
```

### notes

UInt64
* At this time BigInt, is not supported by all versions of nodeJs that are targeted by node-opcua.
UInt64 values are currently stored into an array of 2 32bits numbers : [ High,Low]


## Feature

|                                        |                          |                    |
|----------------------------------------|:------------------------:|--------------------|
| FileType                               |  :white_check_mark:      |                    |          
| FileDirectoryType                      |  :new_moon:              | (sponsor wanted)   |     
| FileTransferStateMachineType           |  :new_moon:              | (sponsor wanted)   |     
| TemporaryFileTransferType              |  :new_moon:              | (sponsor wanted)   |            
| AddressSpaceFileType                   |  :new_moon:              | (sponsor wanted)   | 

## Sponsors & Backers 

We appreciate that, once you have evaluated the software you consider supporting our effort by applying to our sponsor program:

  - https://github.com/sponsors/node-opcua
  - https://opencollective.com/node-opcua

Grants ensure the following:

- 🔨 Long term maintenance of the project
- ⚙️ maintain the website and continuous integration platform
- 🛣  Progress on the road-map
- 🐛 Quick responses to bug reports
- 🚀 New features & enhancements
- ⚖️ representing the node-opcua user community at the OPC Foundation

# Support 

Technical Support is exclusively provided to registered members of the NodeOPCUA Subscription (https://support.sterfive.com) or through dedicated Professional Services.

# License

Node-OPCUA is made available to you under the MIT open source license. 

See [LICENSE](./LICENSE) for details.


# value-added extensions

Contact Sterfive SAS (mailto:contact@sterfive.com) for additional companion modules that are available to registered members:

 - node-opcua-pub-sub : Part 14 implementation to develop OPC UA PubSub over MQTT applications
 - node-opcua-webproxy:  to operate node-opcua from within a web browser
 - node-opcua-optimized-client: super-charge OPC UA Client 
 - react-components:    a collection of React UI components 
 - aggregator:  a powerful OPC UA aggregator that can combine and monitored hundred of servers and millions of variables.
 - node-opcua-gds: a Global Discovery Server (Part 12)
 - node-opcua-modeler-ex: a powerful NO-GUI OPC UA modeler


# Copyright

Copyright (c) 2022  Sterfive SAS

Copyright (c) 2014-2022 Etienne Rossignon

