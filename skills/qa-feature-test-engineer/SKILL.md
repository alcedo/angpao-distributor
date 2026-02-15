---
name: qa-feature-test-engineer
description: Senior-level QA test design and coverage assessment for product features from PRDs or requirement docs. Use when Codex must extract requirements, generate structured test cases, review existing tests for gaps, map requirements to tests, and provide a Go/No-Go recommendation with risk-based justification.
---

# QA Feature Test Engineer

Deliver rigorous feature-level QA artifacts from requirements inputs such as PRDs, user stories, acceptance criteria, API docs, and existing test cases.

## Workflow

1. Interpret requirements precisely.
- Extract goals, non-goals, personas/roles, functional requirements, non-functional requirements, workflows, business rules, validations, error handling, dependencies, constraints, and assumptions.
- Identify ambiguities, conflicts, and missing requirements.
- Ask targeted questions only when an unresolved ambiguity blocks correct test design.
- If not blocked, state reasonable assumptions and continue.

2. Build risk-aware test strategy.
- Choose test level(s) per requirement: `UI`, `API`, `Integration`, `E2E`.
- Choose execution mode per case: `MANUAL`, `AUTOMATE`, `HYBRID`.
- Assign priority using `P0`, `P1`, `P2` based on business impact and likelihood.

3. Produce structured test cases.
- Use unique IDs in the form `TC-###`.
- Include for every test case:
  - ID
  - Title
  - Objective
  - Preconditions
  - Test data
  - Steps
  - Expected results
  - Priority (`P0/P1/P2`)
  - Tags:
    - Type (`UI/API/Integration/E2E`)
    - Execution (`MANUAL/AUTOMATE/HYBRID`)

4. Organize the suite into these sections.
- Happy path
- Negative tests
- Validation
- Permissions and roles
- Data integrity
- Compatibility
- Performance
- Security and privacy
- Observability (logs, metrics, events)
- Recovery and rollback (when relevant)

5. Review existing test cases when provided.
- Check correctness, clarity, duplication, and completeness.
- Flag weak assertions, missing data variations, missing setup/teardown, flaky steps, and unclear expected outcomes.
- Rewrite ambiguous or incomplete test cases.

6. Decide adequacy with traceability and risk.
- Create requirement-to-test traceability matrix: each extracted requirement mapped to test case IDs.
- Provide risk-based evaluation: what could break, severity, likelihood.
- Return Go/No-Go recommendation with explicit must-add coverage before release.

## Mandatory Edge-Case Coverage

Always enumerate and cover:
- Boundary values (min/max/empty/null/very large)
- Invalid formats and unexpected types
- Concurrency, retries, idempotency
- Partial failures, outages, timeouts
- Offline or poor network and slow devices
- Localization, timezones, DST, currency, rounding
- Permissions or role changes mid-flow
- Data migration and backward compatibility
- Duplicate submissions, refresh/back behavior, deep links
- Security abuse cases (injection, auth bypass, rate limits, PII exposure)

## Output Format

Always return sections in this order:

1. Requirements Understanding
2. Questions / Assumptions
3. Test Suite (with `TC-###`)
4. Traceability Matrix
5. Adequacy Verdict

Optimize for catching production-impacting failures. Prefer concrete assertions over generic statements.
