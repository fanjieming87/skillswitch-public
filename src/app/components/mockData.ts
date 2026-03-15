import type { Slot, SlotAssignment, SkillPackage, SourceConfig } from "./types";

export const SOURCE_CONFIG: SourceConfig = {
  path: "",
};

// Source slot - always first in the list
export const SOURCE_SLOT: Slot = {
  id: "source",
  name: "Source",
  color: "#4b5563",  // gray-600, matching the copy button style
  dotColor: "#4b5563",
  filePath: SOURCE_CONFIG.path,
  shortLabel: "SRC",
  isSource: true,
};

export const SLOTS: Slot[] = [
  {
    id: "codebuddy",
    name: "Codebuddy",
    color: "#4f8ef7",
    dotColor: "#4f8ef7",
    filePath: "%USERPROFILE%\\.codebuddy\\skills",
    shortLabel: "CB",
  },
  {
    id: "gemini",
    name: "Gemini",
    color: "#a78bfa",
    dotColor: "#a78bfa",
    filePath: "%USERPROFILE%\\.gemini\\antigravity\\skills",
    shortLabel: "GM",
  },
  {
    id: "qoder",
    name: "Qoder",
    color: "#34d399",
    dotColor: "#34d399",
    filePath: "%USERPROFILE%\\.qoder\\skills",
    shortLabel: "QD",
  },
  {
    id: "copilot",
    name: "Copilot",
    color: "#fb923c",
    dotColor: "#fb923c",
    filePath: "%USERPROFILE%\\.copilot\\skills",
    shortLabel: "CP",
  },
  {
    id: "claude",
    name: "Claude",
    color: "#f59e0b",
    dotColor: "#f59e0b",
    filePath: "%USERPROFILE%\\.claude\\skills",
    shortLabel: "CL",
  },
];

interface MockSkillFile {
  id: string;
  name: string;
  extension: string;
  slots: SlotAssignment[];
  lastModified: string;
  code: string;
}

const MOCK_SKILL_FILES: MockSkillFile[] = [
  {
    id: "1",
    name: "text_summarizer",
    extension: ".skill",
    slots: [
      { slotId: "codebuddy", active: true },
      { slotId: "gemini", active: true },
      { slotId: "qoder", active: true },
      { slotId: "copilot", active: false },
      { slotId: "claude", active: false },
    ],
    lastModified: "2h ago",
    code: `# AI Skill Definition
name: "Text Summarizer"
version: "1.2.0"
description: >
  Summarizes long-form text into concise bullet
  points with actionable insights.

system_prompt: |
  You are an expert text summarizer. When given
  a piece of text, extract the key points and
  present them as clear, concise bullet points.
  Focus on actionable insights and main ideas.

parameters:
  max_bullets: 5
  language: "en"
  style: "professional"
  preserve_code_blocks: true

examples:
  - input: "Long article about AI trends..."
    output: |
      • AI adoption accelerating in enterprise
      • LLMs becoming commodity infrastructure
      • Edge inference gaining traction

metadata:
  author: "admin"
  created: "2024-01-15"
  updated: "2024-03-10"
  tags: ["summarization", "nlp", "productivity"]
  category: "text-processing"
`,
  },
  {
    id: "2",
    name: "code_reviewer",
    extension: ".skill",
    slots: [
      { slotId: "codebuddy", active: true },
      { slotId: "gemini", active: false },
      { slotId: "qoder", active: true },
      { slotId: "copilot", active: true },
      { slotId: "claude", active: false },
    ],
    lastModified: "5h ago",
    code: `# AI Skill Definition
name: "Code Reviewer"
version: "2.0.1"
description: >
  Performs thorough code reviews focusing on
  correctness, performance, and best practices.

system_prompt: |
  You are a senior software engineer performing
  a thorough code review. Analyze the provided
  code for:
  - Logic errors and bugs
  - Performance bottlenecks
  - Security vulnerabilities
  - Code style and readability
  - Test coverage gaps

parameters:
  severity_levels: ["critical", "warning", "info"]
  output_format: "inline-comments"
  language_detection: true

metadata:
  author: "dev-team"
  created: "2024-02-01"
  tags: ["code-review", "quality", "security"]
`,
  },
  {
    id: "3",
    name: "bug_fixer",
    extension: ".skill",
    slots: [
      { slotId: "codebuddy", active: false },
      { slotId: "gemini", active: true },
      { slotId: "qoder", active: true },
      { slotId: "copilot", active: false },
      { slotId: "claude", active: true },
    ],
    lastModified: "1d ago",
    code: `# AI Skill Definition
name: "Bug Fixer"
version: "1.5.3"
description: >
  Analyzes error messages, stack traces, and
  code context to diagnose and fix bugs.

system_prompt: |
  You are an expert debugger. Given an error
  message, stack trace, and surrounding code,
  identify the root cause and provide a fix.

  Always explain:
  1. What caused the bug
  2. Why your fix resolves it
  3. How to prevent similar issues

parameters:
  include_explanation: true
  suggest_tests: true
  show_diff: true

metadata:
  author: "admin"
  created: "2024-01-20"
  tags: ["debugging", "bug-fix", "diagnosis"]
`,
  },
  {
    id: "4",
    name: "doc_generator",
    extension: ".skill",
    slots: [
      { slotId: "codebuddy", active: false },
      { slotId: "gemini", active: false },
      { slotId: "qoder", active: false },
      { slotId: "copilot", active: false },
      { slotId: "claude", active: false },
    ],
    lastModified: "3d ago",
    code: `# AI Skill Definition
name: "Documentation Generator"
version: "1.0.0"
description: >
  Generates comprehensive documentation from
  source code, including API docs, README files,
  and inline comments.

system_prompt: |
  You are a technical documentation expert.
  Generate clear, comprehensive documentation
  for the provided code. Include:
  - Function/method descriptions
  - Parameter types and descriptions
  - Return value documentation
  - Usage examples

parameters:
  format: "jsdoc"
  include_examples: true
  verbosity: "detailed"

metadata:
  author: "docs-team"
  created: "2024-03-01"
  tags: ["documentation", "jsdoc", "readme"]
`,
  },
  {
    id: "5",
    name: "test_writer",
    extension: ".skill",
    slots: [
      { slotId: "codebuddy", active: true },
      { slotId: "gemini", active: true },
      { slotId: "qoder", active: false },
      { slotId: "copilot", active: true },
      { slotId: "claude", active: false },
    ],
    lastModified: "4h ago",
    code: `# AI Skill Definition
name: "Test Writer"
version: "1.8.0"
description: >
  Generates comprehensive unit and integration
  tests for given code with edge cases.

system_prompt: |
  You are a test-driven development expert.
  Write comprehensive tests for the provided
  code. Cover:
  - Happy path scenarios
  - Edge cases and boundary conditions
  - Error handling paths
  - Integration points

parameters:
  framework: "jest"
  coverage_target: 90
  include_mocks: true
  test_style: "describe-it"

metadata:
  author: "qa-team"
  created: "2024-02-15"
  tags: ["testing", "jest", "tdd", "coverage"]
`,
  },
  {
    id: "6",
    name: "refactor_helper",
    extension: ".skill",
    slots: [
      { slotId: "codebuddy", active: false },
      { slotId: "gemini", active: false },
      { slotId: "qoder", active: true },
      { slotId: "copilot", active: false },
      { slotId: "claude", active: false },
    ],
    lastModified: "6h ago",
    code: `# AI Skill Definition
name: "Refactor Helper"
version: "1.1.2"
description: >
  Suggests and applies code refactoring to improve
  maintainability, readability, and performance.

system_prompt: |
  You are a code refactoring specialist. Analyze
  the provided code and suggest improvements for:
  - Reducing complexity and cognitive load
  - Extracting reusable functions/components
  - Applying design patterns appropriately
  - Improving naming and clarity

parameters:
  refactor_level: "moderate"
  preserve_behavior: true
  explain_changes: true

metadata:
  author: "admin"
  created: "2024-01-25"
  tags: ["refactoring", "clean-code", "patterns"]
`,
  },
  {
    id: "7",
    name: "explain_code",
    extension: ".skill",
    slots: [
      { slotId: "codebuddy", active: true },
      { slotId: "gemini", active: true },
      { slotId: "qoder", active: true },
      { slotId: "copilot", active: true },
      { slotId: "claude", active: true },
    ],
    lastModified: "30m ago",
    code: `# AI Skill Definition
name: "Code Explainer"
version: "3.0.0"
description: >
  Explains code in plain language with varying
  levels of technical depth based on audience.

system_prompt: |
  You are an expert code educator. Explain the
  provided code clearly and concisely. Adapt
  your explanation to the requested audience
  level (beginner/intermediate/expert).

  Structure your explanation:
  1. High-level purpose
  2. Step-by-step walkthrough
  3. Key concepts used
  4. Potential improvements

parameters:
  audience: "intermediate"
  include_analogies: true
  highlight_patterns: true

metadata:
  author: "education-team"
  created: "2024-01-10"
  tags: ["explain", "education", "onboarding"]
`,
  },
  {
    id: "8",
    name: "regex_builder",
    extension: ".skill",
    slots: [
      { slotId: "codebuddy", active: false },
      { slotId: "gemini", active: true },
      { slotId: "qoder", active: false },
      { slotId: "copilot", active: false },
      { slotId: "claude", active: true },
    ],
    lastModified: "2d ago",
    code: `# AI Skill Definition
name: "Regex Builder"
version: "1.3.1"
description: >
  Constructs and explains regular expressions
  from natural language descriptions.

system_prompt: |
  You are a regex expert. Given a description
  of a pattern to match, construct an accurate
  regular expression and explain each component.

  Always provide:
  - The regex pattern
  - Component breakdown
  - Test cases showing matches/non-matches
  - Common pitfalls to avoid

parameters:
  flavor: "pcre"
  include_flags: true
  generate_tests: true

metadata:
  author: "admin"
  created: "2024-02-10"
  tags: ["regex", "patterns", "string-matching"]
`,
  },
  {
    id: "9",
    name: "api_designer",
    extension: ".skill",
    slots: [
      { slotId: "codebuddy", active: true },
      { slotId: "gemini", active: false },
      { slotId: "qoder", active: false },
      { slotId: "copilot", active: true },
      { slotId: "claude", active: false },
    ],
    lastModified: "1d ago",
    code: `# AI Skill Definition
name: "API Designer"
version: "2.1.0"
description: >
  Designs RESTful and GraphQL API schemas following
  industry best practices and OpenAPI standards.

system_prompt: |
  You are an API design expert specializing in
  RESTful and GraphQL architectures. Design APIs
  that are intuitive, consistent, and follow
  industry best practices.

  Include:
  - Endpoint structure and naming
  - Request/response schemas
  - Authentication patterns
  - Error response formats
  - Versioning strategy

parameters:
  style: "rest"
  output_format: "openapi-3.0"
  include_examples: true

metadata:
  author: "backend-team"
  created: "2024-03-05"
  tags: ["api", "rest", "graphql", "openapi"]
`,
  },
];

export const SKILL_PACKAGES: SkillPackage[] = MOCK_SKILL_FILES.map((file) => ({
  id: file.id,
  name: file.name,
  slots: file.slots,
  previewContent: file.code,
  lastModified: file.lastModified,
  packagePath: `mock/${file.name}`,
  previewPath: `mock/${file.name}/skill.md`,
}));
