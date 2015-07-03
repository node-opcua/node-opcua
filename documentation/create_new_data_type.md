

# create a new DataType

![](http://yuml.me/diagram/scruffy/class/[BaseObjectType{bg:green}],
[BaseDataVariabeType{bg:green}],
[BaseVariabeType{bg:green}],
[TemperatureSensorType{bg:blue}],
[MachineType{bg:blue}],
[HeaterSwitch{bg:yellow}],
[Temperature{bg:yellow}],
[Temperature{bg:yellow}], ,
[BaseVariabeType]^[BaseDataVariabeType],
[BaseObjectType]^subTypeOf-[TemperatureSensorType],
[BaseObjectType]^subTypeOf-[MachineType],
[BaseDataVariabeType]^-instantiate-[Temperature],
[BaseDataVariabeType]^-instantiate-[HeaterSwitch],
[MachineType] ++--hasComponent [TemperatureSensor],
[MachineType] ++--hasComponent [HeaterSwitch],
[MachineType] ++--hasComponent [SetSwitchState{bg:orange}],
[TemperatureSensorType]^-instantiate-[TemperatureSensor],
[TemperatureSensorType] ++--hasComponent [Temperature]. )



## create new TemperatureSensorType

![](http://yuml.me/diagram/scruffy/class/[BaseObjectType{bg:green}],
[TemperatureSensorType{bg:blue}],
[BaseDataVariabeType{bg:green}],
[BaseVariabeType{bg:green}],
[Temperature{bg:yellow}],
[BaseVariabeType]^subTypeOf-[BaseDataVariabeType],
[BaseObjectType]^subTypeOf-[TemperatureSensorType],
[BaseDataVariabeType]^instantiate-[Temperature],
[TemperatureSensorType] ++--hasComponent [Temperature]. )

```javascript

var temperatureSensorTypeParams = {
    browseName: "TemperatureSensorType",
};

var temperatureSensorType = address_space.addObjectType(temperatureSensorTypeParams);

address_space.addVariable(temperatureSensorType,{
    browseName:     "Temperature",
    description:    "The temperature value measured by the sensor",
    dataType:       "Double",
    modellingRule:  "Mandatory",
    value: { dataType: DataType.Double, value: 19.5}
});

```

### instantiate Object of type TemperatureSensorType

```javascript

var parentFolder = address_space.findObject("RootFolder");

var temperatureSensor = temperatureSensorType.instantiate({
    organizedBy: "RootFolder",
    browseName:"MyTemperatureSensor"
});


```


### outputing the NodeSetXML file


```xml
<?xml version="1.0"?>
<UANodeSet xmlns:xs="http://www.w3.org/2001/XMLSchema-instance"
   xmlns:xsd="http://www.w3.org/2001/XMLSchema"
   Version="1.02" LastModified="2013-03-06T05:36:44.0862658Z"
    xmlns="http://opcfoundation.org/UA/2011/03/UANodeSet.xsd">
    <Aliases>
        <Alias Alias="HasSubtype">i=45</Alias>
        <Alias Alias="HasTypeDefinition">i=40</Alias>
        <Alias Alias="Organizes">i=35</Alias>
        <Alias Alias="HasProperty">i=46</Alias>
        <Alias Alias="undefined">i=12</Alias>
        <Alias Alias="HasModellingRule">i=37</Alias>
        <Alias Alias="HasComponent">i=47</Alias>
        <Alias Alias="HasEncoding">i=38</Alias>
        <Alias Alias="HasDescription">i=39</Alias>
    </Aliases>
    <UAVariable NodeId="ns=1;i=1001" BrowseName="Temperature" DataType="Double">
        <DisplayName>Temperature</DisplayName>
        <Description>the temperature value of the sensor in Celsius &lt;�C&gt;</Description>
        <References>
            <Reference ReferenceType="HasTypeDefinition">ns=0;i=63</Reference>
            <Reference ReferenceType="HasComponent" IsForward="false">ns=1;i=1000</Reference>
            <Reference ReferenceType="HasModellingRule">ns=0;i=78</Reference>
        </References>
    </UAVariable>
    <UAObjectType NodeId="ns=1;i=1000" BrowseName="TemperatureSensorType" IsAbstract="false">
        <DisplayName>TemperatureSensorType</DisplayName>
        <References>
            <Reference ReferenceType="HasSubtype" IsForward="false">ns=0;i=58</Reference>
        </References>
    </UAObjectType>
</UANodeSet>
```
