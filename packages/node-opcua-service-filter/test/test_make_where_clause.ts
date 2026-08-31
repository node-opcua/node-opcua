import { AttributeIds } from "node-opcua-basic-types";
import { DataType } from "node-opcua-variant";
import should from "should";
import { ElementOperand, FilterOperator, LiteralOperand, SimpleAttributeOperand } from "../dist/index.js";
import {
    and,
    greaterThanOrEqual,
    inList,
    l,
    lessThan,
    makeContentFilterElements,
    ofType,
    or,
    s
} from "../dist/make_content_filter.js";

describe("make where clause", () => {
    it("should createa  simple OfType clause", () => {
        const elements = makeContentFilterElements(ofType("ConditionType"));
        elements.length.should.eql(1);
        elements[0].filterOperator.should.eql(FilterOperator.OfType);
        should(elements[0].filterOperands?.length).eql(1);
        should(elements[0].filterOperands?.[0]).be.instanceOf(LiteralOperand);
        (elements[0].filterOperands![0]! as LiteralOperand).value.dataType.should.eql(DataType.NodeId);
    });

    it("should createa  simple Or(OfType,OfType) clause", () => {
        const elements = makeContentFilterElements(or(ofType("ConditionType"), ofType("BaseEventType")));

        // xx console.log(elements[0].toString())
        // xx console.log(elements[1].toString())
        // xx console.log(elements[2].toString())
        elements.length.should.eql(3);

        elements[0].filterOperator.should.eql(FilterOperator.Or);
        should(elements[0].filterOperands?.length).eql(2);
        should(elements[0].filterOperands?.[0]).be.instanceOf(ElementOperand);
        should(elements[0].filterOperands?.[1]).be.instanceOf(ElementOperand);
        (elements[0].filterOperands![0]! as ElementOperand).index.should.eql(1);
        (elements[0].filterOperands![1]! as ElementOperand).index.should.eql(2);

        elements[1].filterOperator.should.eql(FilterOperator.OfType);
        elements[2].filterOperator.should.eql(FilterOperator.OfType);

        should(elements[1].filterOperands?.length).eql(1);
        should(elements[1].filterOperands?.[0]).be.instanceOf(LiteralOperand);
        (elements[1].filterOperands![0]! as LiteralOperand).value.dataType.should.eql(DataType.NodeId);

        should(elements[2].filterOperands?.length).eql(1);
        should(elements[2].filterOperands?.[0]).be.instanceOf(LiteralOperand);
        (elements[2].filterOperands![0]! as LiteralOperand).value.dataType.should.eql(DataType.NodeId);
    });

    it("should create a inList whereClause", () => {
        const elements = makeContentFilterElements(
            inList(s(AttributeIds.Value, "Backgroud.Color"), [
                l(DataType.String, "Red"),
                l(DataType.String, "Green"),
                l(DataType.String, "Blue")
            ])
        );

        elements.length.should.eql(1);
        elements[0].filterOperator.should.eql(FilterOperator.InList);
        should(elements[0].filterOperands?.length).eql(4);
        should(elements[0].filterOperands?.[0]).be.instanceOf(SimpleAttributeOperand);
        should(elements[0].filterOperands?.[1]).be.instanceOf(LiteralOperand);
        should(elements[0].filterOperands?.[2]).be.instanceOf(LiteralOperand);
        should(elements[0].filterOperands?.[3]).be.instanceOf(LiteralOperand);
    });

    it("should create a and whereClause", () => {
        const a = new SimpleAttributeOperand({
            attributeId: AttributeIds.Value,
            browsePath: ["Severity"]
        });
        const elements = makeContentFilterElements(
            and(lessThan(a, l(DataType.Int32, 10)), greaterThanOrEqual(a, l(DataType.Int32, 5)))
        );

        elements.length.should.eql(3);

        elements[0].filterOperator.should.eql(FilterOperator.And);
        elements[1].filterOperator.should.eql(FilterOperator.LessThan);
        elements[2].filterOperator.should.eql(FilterOperator.GreaterThanOrEqual);
    });
});
