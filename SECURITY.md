# Security Policy

Sterfive maintains `node-opcua`. We take security seriously. We fix security weaknesses quickly, and we disclose them openly and responsibly.

If you find a security weakness in a `node-opcua` repository, please report it to us as described below.

## Supported Versions

We fix security weaknesses in the latest release series.

We can also fix earlier versions of `node-opcua` for members of the NodeOPCUA Support Program ([https://support.sterfive.com](https://support.sterfive.com)).

| Version             | Supported          |
| ------------------- | ------------------ |
| 2@latest            | ✅ (master branch) |
| 2.163 to 2<@latest  | (for members only) |
| 0.x                 | :x:                |

## Experimental Features

`node-opcua` is released continuously, and some new features ship before they are complete. We mark such a feature as **Experimental**. Do not use an Experimental feature in production where security matters.

A feature is Experimental when all of these are true:

- Its API documentation says "Experimental".
- It is off by default. You must turn it on with an explicit option or class.
- The server writes a warning to its log when you turn it on.

These features are Experimental now:

| Feature | How you turn it on |
| --- | --- |
| Compact address space | the `compactAddressSpace` option of `OPCUAServer` |
| Front-thread engine (front threads and session workers) | the `FrontThreadEngine` class |

### How we handle a weakness in an Experimental feature

- Report it in the same way as any other weakness. We acknowledge it, confirm it and fix it with the same targets, and we add a regression test.
- We do not publish a security advisory and we do not request a CVE for it.
- The release notes name the fix and credit the reporter, unless the reporter asks to stay anonymous. The fix is not silent.
- Members of the NodeOPCUA Support Program receive the details in the next bulletin, because some of them test Experimental features.
- If the same weakness also affects a feature that is not Experimental, or a default configuration, it is an ordinary weakness: it gets an advisory and a CVE.

When a feature stops being Experimental, the release notes say so. From that release, the full policy applies to it.

This section applies to reports that we receive after the date this section is published. A report that we received before that date keeps the handling that we agreed with its reporter.

## How to Report a Security Weakness

Please do not report a security weakness in a public issue. Use one of these private channels.

### Method 1: GitHub Private Vulnerability Reporting (preferred)

1. Go to the main page of the **[node-opcua/node-opcua](https://github.com/node-opcua/node-opcua)** repository.
2. Click the **Security** tab.
3. In the left sidebar, click **Advisories**.
4. Click **Report a vulnerability**.
5. Give a description, the steps to reproduce, and a proof of concept if you have one. Then submit the form.

### Method 2: Email

Send a confidential report to **`security@sterfive.com`**. Include:

- A clear description of the weakness.
- The steps to reproduce it.
- Code, logs or screenshots that help.
- Your contact details, if you want credit.

### What makes a good report

- A proof of concept that runs against a released version of `node-opcua`.
- The affected version range, if you know it.
- The real impact: what an attacker can do, and what the attacker needs first.

We accept reports that use AI tools. Please check that the weakness is real and reproducible before you send the report.

## Our Commitments

| Step | Our target |
| --- | --- |
| Acknowledge your report | within 24 hours on business days |
| Confirm or reject the weakness | within 7 days |
| Release a fix | within 90 days of your report, and much faster for a severe weakness |
| Publish the public advisory | 90 days after we inform the members of the NodeOPCUA Support Program |

If we cannot release a fix within 90 days, we agree a disclosure date with you.

## Disclosure Policy

### 1. Investigation

We reproduce the weakness and assess its real impact. We can contact you for more information.

### 2. Fix and release

We fix the weakness and add a regression test. The fix ships in the next release of `node-opcua`. For a severe weakness, we make an emergency release.

The release notes describe the change in neutral words. The full details come with the advisory.

### 3. Member notification

On the day of the fixed release, we inform the members of the [NodeOPCUA Support Program](https://support.sterfive.com). We send them the details of the weakness and the steps to correct it. When several fixes ship close together, we send one bulletin, so that members update once.

### 4. Public advisory

We publish a GitHub security advisory **90 days after the member notification**. This gives members the time to update before the details are public. We request the CVE before that date; it stays reserved until we publish. The advisory gives the affected versions, the fixed version, the severity and the remediation steps. We credit the reporter, unless the reporter asks to stay anonymous.

### Exceptions

- **Critical or actively exploited weakness**: we publish the advisory on the day of the fixed release, at the same time as the member notification.
- **Weakness already public**: we publish the advisory as soon as the fix is available.

### No silent fixes

Every security fix gets an advisory. This includes weaknesses that we find ourselves, and weaknesses that a fix closes as a side effect. The only exception is a weakness that affects only an Experimental feature (see [Experimental Features](#experimental-features)): its fix is named in the release notes, with credit, but it gets no advisory.

## Receiving Security Updates

- Everyone: watch the [GitHub security advisories](https://github.com/node-opcua/node-opcua/security/advisories) of this repository, or use a dependency scanner (Dependabot, OSV, Snyk).
- Members of the [NodeOPCUA Support Program](https://support.sterfive.com): you also receive the details on the day of each fixed release, remediation guidance, and fixes for supported earlier versions.

## Contact

- Security questions: `security@sterfive.com`
- General questions, or to join the NodeOPCUA Support Program: `contact@sterfive.com`

Thank you for helping us keep `node-opcua` and its users safe.
