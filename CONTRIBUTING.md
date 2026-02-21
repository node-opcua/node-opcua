# Contributing to node-opcua

Thank you for your interest in contributing to node-opcua!
We welcome contributions from the community to help make this the most robust and complete OPC UA stack for Node.js (and the browser to some extent).

By participating in this project, you agree to abide by our Code of Conduct.

## Table of Contents

- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Code Review Process](#code-review-process)
- [Coding Standards](#coding-standards)
- [AI Coding Policy](#ai-coding-policy)
- [Testing](#testing)
- [Sustainability and Support](#sustainability-and-support)
- [Contributor License Agreement (CLA)](#contributor-license-agreement-cla)

## How to Contribute

### Reporting Bugs

- Search existing Issues to see if the bug has already been reported.
- If not, create a new issue. Include a clear description, steps to reproduce, and the version of node-opcua and node you are using.
- Provide a minimal reproducible example (code snippet or repository) whenever possible.

### Suggesting Enhancements & New Features

- **Discuss First**: Any addition of a feature must be discussed with the maintainer team first to validate a plan. This ensures that the proposal aligns with the project's roadmap, architectural goals, and security standards.
- **Open an Issue**: Use the "enhancement" tag to describe the feature, the use case, and how it aligns with the OPC UA specifications.
- **Governance**: Collaborative planning and validation of the implementation strategy are essential for good project governance. This prevents wasted effort and ensures that the contribution can be successfully integrated.

## Development Workflow

We use pnpm for package management and a monorepo structure.

- Plan and Validate: Before writing code, discuss your proposed changes in a GitHub issue to get validation from the maintainers.
- Fork the repository on GitHub.
- Clone your fork locally.
- Install dependencies:

```bash
npm install -g pnpm
pnpm install
```

- Create a branch for your fix or feature.
- Build the project: `pnpm run build`
- Run the tests:

```bash
pnpm run test
```

```bash
cd packages
node parallel_tests.js
```

- Submit a Pull Request.

## Code Review Process

Maintaining the highest quality for an industrial-grade OPC UA stack requires rigorous oversight. Please keep in mind:

- **Manual Human Review**: Every pull request is manually reviewed by project maintainers. This is a time-consuming process dedicated to ensuring that code follows the complex OPC UA specifications and does not introduce regressions.
- **Quality Bar**: We may ask for multiple rounds of changes regarding architecture, naming, or test coverage. This is not a reflection on your skill, but a necessity to maintain the project's long-term stability.
- **Patience**: Because reviews are thorough and performed by experts, they may take time. We appreciate your patience as we work together to merge high-quality contributions.

## Coding Standards

- **TypeScript**: The entire project is strictly typed.
- **Linting**: We use ESLint and Prettier. Run `pnpm run lint` before submitting.
- **Naming**: Follow naming conventions established in the OPC UA specification (e.g., CamelCase for Class names).

## AI Coding Policy

(Adapted from the Firefox AI Policy)

- **Philosophy**: AI tools present both opportunities and risks. We trust contributors to use these tools with care. AI can assist, but responsibility always stays with the human behind the change.
- **Responsibilities**: Maintain Quality and Scope: You are responsible for technical excellence.
- **Understand What You Submit**: You must be able to explain every change. Reviewers audit the human's logic, not the tool's output.
- **Protect Sensitive Data**: Never include private keys or confidential data in AI prompts.
- **Accountability**: You are accountable for all submitted changes.

## Testing

node-opcua relies on a massive suite of unit tests.

- **Run all tests**: `pnpm run test`. Every Pull Request must pass all existing tests and should include new tests for new features.
- We maintain a high code coverage (currently ~93%), this should be your target too when you submit a PR.

## Sustainability and Support

node-opcua is an ambitious, industrial-grade open-source project that requires significant resources to maintain, update, and secure. Unlike smaller libraries, implementing the OPC UA standard requires deep expertise and thousands of hours of development.

### The Critical Need for Sponsorship

- Open-source software only lives as long as it is supported. The time maintainers spend on code reviews, bug fixes, and ensuring strict specification compliance is immense.
- **If your organization relies on node-opcua for production environments, commercial products, or critical infrastructure, your financial support is essential.**
- **Sponsorship is not just a donation; it is an investment in the stability, security, and longevity** of the tools your business depends on.

Without this support, the project cannot stay active or respond to the latest security threats and industry standards.

### How to Support the Project

We offer several ways for individuals and organizations to contribute to the project's sustainability:

- **Professional Services & Support**: For production-grade assurance, consider a professional support contract or custom development services. [Learn more](https://www.sterfive.com/node-opcua-support)
- **Direct Inquiries**: For corporate sponsorship, licensing, or professional consultation, please contact us directly at [contact@sterfive.com](mailto:contact@sterfive.com).
- **Open Collective**: Transparently fund the project's community expenses and development. [Contribute on Open Collective](https://opencollective.com/node-opcua)
- **GitHub Sponsors**: Support the maintainers directly with a recurring contribution. [Sponsor on GitHub](https://github.com/sponsors/node-opcua)

## Contributor License Agreement (CLA)

All contributors are required to sign a CLA. After submitting your first PR, a bot will provide a link to the signing form. This protects both you and the project maintainers.
