import "should";
import { DataType } from "node-opcua-variant";
import { AttributeIds } from "node-opcua-basic-types";
import {
    makeContentFilterElements,
    ofType,
    s,
    or,
    and,
    inList,
    l,
    lessThan,
    greaterThanOrEqual
} from "../source/make_content_filter";
import { ElementOperand, FilterOperand, FilterOperator, LiteralOperand, SimpleAttributeOperand } from "../dist";

describe("make where clause", () => {
    it("should createa  simple OfType clause", () => {
        const elements = makeContentFilterElements(ofType("ConditionType"));
        elements.length.should.eql(1);
        elements[0].filterOperator.should.eql(FilterOperator.OfType);
        elements[0].filterOperands?.length.should.eql(1);
        elements[0].filterOperands![0]!.should.be.instanceOf(LiteralOperand);
        (elements[0].filterOperands![0]! as LiteralOperand).value.dataType.should.eql(DataType.NodeId);
    });

    it("should createa  simple Or(OfType,OfType) clause", () => {
        const elements = makeContentFilterElements(or(ofType("ConditionType"), ofType("BaseEventType")));

        // xx console.log(elements[0].toString())
        // xx console.log(elements[1].toString())
        // xx console.log(elements[2].toString())
        elements.length.should.eql(3);

        elements[0].filterOperator.should.eql(FilterOperator.Or);
        elements[0].filterOperands?.length.should.eql(2);
        elements[0].filterOperands![0]!.should.be.instanceOf(ElementOperand);
        elements[0].filterOperands![1]!.should.be.instanceOf(ElementOperand);
        (elements[0].filterOperands![0]! as ElementOperand).index.should.eql(1);
        (elements[0].filterOperands![1]! as ElementOperand).index.should.eql(2);

        elements[1].filterOperator.should.eql(FilterOperator.OfType);
        elements[2].filterOperator.should.eql(FilterOperator.OfType);

        elements[1].filterOperands?.length.should.eql(1);
        elements[1].filterOperands![0]!.should.be.instanceOf(LiteralOperand);
        (elements[1].filterOperands![0]! as LiteralOperand).value.dataType.should.eql(DataType.NodeId);

        elements[2].filterOperands?.length.should.eql(1);
        elements[2].filterOperands![0]!.should.be.instanceOf(LiteralOperand);
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
        elements[0].filterOperands?.length.should.eql(4);
        elements[0].filterOperands![0]!.should.be.instanceOf(SimpleAttributeOperand);
        elements[0].filterOperands![1]!.should.be.instanceOf(LiteralOperand);
        elements[0].filterOperands![2]!.should.be.instanceOf(LiteralOperand);
        elements[0].filterOperands![3]!.should.be.instanceOf(LiteralOperand);
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
