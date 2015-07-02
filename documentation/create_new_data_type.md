

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
var temperatureSensorTypeNode = address_space.addObjectType( temperatureSensorTypeParams);

address_space.addVariable(temperatureSensorTypeNode,{
    browseName:     "Temperature",
    dataType:       "Double",
    modellingRule:  "Mandatory",
    value: { dataType: DataType.Double, value: 19.5}
});
```

### instantiate Object of type TemperatureSensorType

```javascript

var myTemperatureSensor = temperatureSensorTypeNode.instantiate();


```
