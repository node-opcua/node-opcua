<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xs="http://www.w3.org/2001/XMLSchema"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
    <xsl:output method="xml" version="1.0" encoding="utf-8" indent="yes"/>
    <xsl:strip-space elements="*"/>
    <!--recurse all result node-->
    <xsl:template match="ResultNode" name="testcase">
        <xsl:param name="classname"/>
        <xsl:for-each select="ResultNode">
            <xsl:choose>
                <xsl:when test="contains(@name, '.js')">
                    <xsl:element name="testcase">
                        <xsl:attribute name="name">
                            <xsl:value-of select="translate(@name,' .','__')"/>
                        </xsl:attribute>
                        <xsl:attribute name="classname">
                            <xsl:value-of select="$classname"/>
                        </xsl:attribute>
                        <xsl:variable name="testResultString">
                            <xsl:choose>
                                <xsl:when test="contains(@testresult, '0')">Fail/Error</xsl:when>
                                <xsl:when test="contains(@testresult, '1')">Warning</xsl:when>
                                <xsl:when test="contains(@testresult, '2')">Not Implemented
                                </xsl:when>
                                <xsl:when test="contains(@testresult, '3')">Skipped</xsl:when>
                                <xsl:when test="contains(@testresult, '4')">Not Supported</xsl:when>
                                <xsl:when test="contains(@testresult, '5')">OK/Log</xsl:when>
                                <xsl:when test="contains(@testresult, '6')">Back-Trace</xsl:when>
                                <xsl:otherwise>result type unknown</xsl:otherwise>
                            </xsl:choose>
                        </xsl:variable>
                        <xsl:if test="@testresult = '0'">
                            <xsl:element name="failure">
                                <xsl:attribute name="type">CTT failure</xsl:attribute>
                                <xsl:value-of select="ResultNode/@status"/>
                                <xsl:value-of select="ResultNode/@description"/>
                            </xsl:element>
                        </xsl:if>
                        <xsl:element name="system-out">
                            <xsl:value-of select="@timestamp"/>
                        </xsl:element>
                        <xsl:if test="@description != ''">
                            <xsl:element name="system-out">
                                <xsl:value-of select="@description"/>
                            </xsl:element>
                        </xsl:if>
                        <xsl:element name="system-out">
                            <xsl:value-of select="$testResultString"/>
                        </xsl:element>
                        <xsl:if test="@testresult = '3'">
                            <xsl:element name="system-out">
                                <xsl:value-of select="ResultNode/@description"/>
                            </xsl:element>
                        </xsl:if>
                    </xsl:element>
                </xsl:when>
                <xsl:otherwise>
                    <xsl:if test="ResultNode">
                        <xsl:call-template name="testcase">
                            <xsl:with-param name="classname">
                                <xsl:value-of
                                        select="concat($classname,'.',translate(@name,' .','__'))"/>
                            </xsl:with-param>
                        </xsl:call-template>
                    </xsl:if>
                </xsl:otherwise>
            </xsl:choose>
        </xsl:for-each>
    </xsl:template>
    <!--create the test suite-->
    <xsl:template match="UaCttResults" name="testsuite">
        <xsl:variable name="testCount">
            <xsl:value-of select="count(//*[contains(@name, '.js')])"/>
        </xsl:variable>
        <xsl:variable name="goodCount">
            <xsl:value-of
                    select="count(//*[contains(@name, '.js') and @testresult = '5'])"/>
        </xsl:variable>
        <xsl:variable name="skippedCount">
            <xsl:value-of
                    select="count(//*[@testresult = 3])"/>
        </xsl:variable>
        <xsl:variable name="errorCount">
            <xsl:value-of select="$testCount - $goodCount - $skippedCount"/>
        </xsl:variable>
        <xsl:element name="testsuite">
            <xsl:attribute name="name">CTT_Test</xsl:attribute>
            <xsl:attribute name="tests">
                <xsl:value-of select="$testCount"/>
            </xsl:attribute>
            <xsl:attribute name="timestamp">
                <xsl:value-of select="ResultNode/@timestamp"/>
            </xsl:attribute>
            <xsl:attribute name="errors">
                <xsl:value-of select="$errorCount"/>
            </xsl:attribute>
            <xsl:attribute name="skipped">
                <xsl:value-of select="$skippedCount"/>
            </xsl:attribute>
            <xsl:call-template name="testcase">
                <xsl:with-param name="classname">CTT_Test</xsl:with-param>
            </xsl:call-template>
        </xsl:element>
    </xsl:template>
</xsl:stylesheet>
