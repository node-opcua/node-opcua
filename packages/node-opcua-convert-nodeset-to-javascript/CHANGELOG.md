# Changelog

## [Unreleased]

### Fixed

#### Fix #1: Inherited member type compatibility

**Problem:**  
When a derived class overrides a member without adding new sub-members, the generator used the raw TypeDefinition type instead of the specialized type from the base class.

**Example:**
```typescript
// Base class defines specialized type:
interface UAIJoiningSystemAsset_identification 
    extends Omit<UAMachineryItemIdentification, "manufacturer"|"serialNumber"> { ... }

// BEFORE (wrong): Generator used generic type
identification: UAMachineryItemIdentification;

// AFTER (correct): Generator uses specialized type from base class  
identification: UAIJoiningSystemAsset_identification;
```

This caused TS2430 errors in some NodeSets (e.g., LADS):
```
error TS2430: Interface 'UAMultiSensorFunction_Base' incorrectly extends interface 'UABaseSensorFunction_Base'.
```

**Solution:**  
If the base class has a specialized type for a member, use that type to maintain compatibility in the inheritance chain.

---

#### Fix #2: Correct type arguments for inherited generic types

**Problem:**  
When `childType` was inherited from the base class (via Fix #1), the type arguments (suffix) were still computed based on the TypeDefinition, not the inherited type.

**Example:**
```typescript
// Base class: (with Fix #1)
currentValue: UADiscreteItem<any, any>;        // 2 type args (generic)

// TypeDefinition (TwoStateDiscreteType) has dataType=Boolean, so only 1 param

// BEFORE (wrong): 
currentValue: UADiscreteItem<boolean>;         // 1 arg - TS2314 error!

// AFTER (correct):
currentValue: UADiscreteItem<boolean, DataType.Boolean>;  // 2 args, specific ✓
```

**Solution:**  
When inheriting `childType` from the base class, recalculate the type arguments based on the base type's generic parameters, combined with the current node's specific dataType.

---

### Affected NodeSets

The fixes correct type generation in the following existing NodeSets:
- node-opcua-nodeset-ua (3 files)
- node-opcua-nodeset-ijt-base (14 files)
- node-opcua-nodeset-scales-v-2 (7 files)
- node-opcua-nodeset-glass-flat (2 files)
- node-opcua-nodeset-machine-tool (1 file)
- node-opcua-nodeset-padim (1 file)
