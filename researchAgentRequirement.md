jAI Platform

*Deep Agents Integration*

**Requirements, User Stories & Build Tasks**

Middleware • Sub-Agents • Human-in-the-Loop • Long-Term Memory

Version 2.0 \| December 2024

1\. Executive Summary

This document defines comprehensive requirements for integrating
LangChain\'s Deep Agents architecture into jAI Platform, covering four
critical capabilities: Middleware Architecture, Sub-Agent Harness,
Human-in-the-Loop, and Long-Term Memory.

| **Capability**        | **Description**                                                                             |
|-----------------------|---------------------------------------------------------------------------------------------|
| **Middleware**        | Composable interceptors (before_model, modify_request, after_model) for context engineering |
| **Sub-Agent Harness** | Task tool for spawning specialized sub-agents with isolated context and custom tools        |
| **Human-in-the-Loop** | Interrupt configuration for sensitive tools with approve/edit/reject decisions              |
| **Long-Term Memory**  | Persistent storage via CompositeBackend routing /memories/ to durable stores                |

2\. Middleware Architecture

The middleware architecture provides fine-grained control over context
engineering through composable interceptors that hook into the agent
loop at key points.

2.1 Middleware Lifecycle Hooks

| **Hook**           | **When Called**                  | **Use Cases**                                                |
|--------------------|----------------------------------|--------------------------------------------------------------|
| **before_model**   | Before LLM invocation            | Inject RAG context, query Knowledge Graph, load preferences  |
| **modify_request** | Transform request before sending | Add tools dynamically, modify system prompt, inject examples |
| **after_model**    | After LLM response received      | Validate outputs, check compliance, log decisions, escalate  |

2.2 Built-in Middleware

TodoListMiddleware

- **Tool:** write_todos - Create/update task lists with status tracking

- **State:** Persists todo list in agent state for session continuity

- **Prompt:** Adds planning instructions to system prompt

FilesystemMiddleware

- **Tools:** ls, read_file, write_file, edit_file, glob, grep

- **Execute:** Available when backend implements SandboxBackendProtocol

- **Eviction:** Large tool results automatically dumped to filesystem

SubAgentMiddleware

- **Tool:** task(agent_name, instruction) - Delegate work to sub-agent

- **Isolation:** Sub-agent gets clean context, returns only results

- **Config:** Each sub-agent can have unique model, tools, middleware

2.3 Middleware Requirements

1.  AgentMiddleware Base Class with before_model, modify_model_request,
    after_model hooks

2.  Middleware Chain Executor with predictable ordering (LIFO for
    after_model)

3.  Dynamic Tool Injection via tools class attribute

4.  System Prompt Modification via middleware

5.  Custom Middleware Creation by subclassing AgentMiddleware

6.  Middleware Composition supporting multiple middleware stacking

2.4 Middleware User Stories

1.  **Knowledge Graph Context Injection**

> *As a* Claims Agent*, I want* relevant KG context injected before each
> model call *so that* I can reason about relationships without manual
> queries.

- AC: KnowledgeGraphMiddleware.before_model queries Neo4j for
  relationships

- AC: Related claims at same address auto-surfaced in context

2.  **Compliance Validation Middleware**

> *As a* Compliance Officer*, I want* all agent responses validated for
> regulatory compliance *so that* agents never provide non-compliant
> recommendations.

- AC: ComplianceMiddleware.after_model scans response for prohibited
  language

- AC: Fair lending violations trigger response modification

3\. Sub-Agent Harness

The Sub-Agent Harness enables spawning specialized sub-agents with
isolated context windows, critical for keeping main agent context clean
while allowing deep dives on specific subtasks.

3.1 Sub-Agent Architecture

| **Component**         | **Description**                                                        |
|-----------------------|------------------------------------------------------------------------|
| **task Tool**         | Main agent calls task(agent_name, instruction) to delegate work        |
| **SubAgent Config**   | name, description, system_prompt, tools, model, middleware             |
| **CompiledSubAgent**  | Pre-built LangGraph workflow as sub-agent: name, description, runnable |
| **Context Isolation** | Sub-agent gets fresh context; parent only receives synthesized result  |
| **Shared Workspace**  | Sub-agents write to shared /workspace/ filesystem for collaboration    |

3.2 Sub-Agent Patterns

Pattern 1: Parallel Domain Experts

task(\"claims-agent\", \"Validate coverage for claim \#AC-2024-78542\")

task(\"fraud-agent\", \"Analyze claim for fraud indicators\")

task(\"compliance-agent\", \"Verify FL regulatory requirements\")

Pattern 2: Deep Investigation

task(\"siu-investigator\", \"Deep fraud investigation on claim
\#12345\")

\# Sub-agent writes to /workspace/siu_investigation_12345.md

Pattern 3: Nested Sub-Agents

Orchestrator → Claims Agent → Document Analyzer → OCR Specialist

3.3 Sub-Agent Requirements

7.  Task Tool Implementation: task(agent_name, instruction) from
    SubAgentMiddleware

8.  SubAgent TypedDict: name, description, prompt, tools, model,
    middleware, interrupt_on

9.  CompiledSubAgent Support: name, description, runnable
    (CompiledGraph)

10. Context Isolation: Sub-agent execution must not pollute parent
    context

11. Shared Filesystem: Sub-agents inherit parent\'s filesystem backend

12. Model Override: Sub-agents can use different models than parent

13. Nested Spawning: Sub-agents can spawn sub-agents (depth limit: 5)

14. General Purpose Agent: Default sub-agent when
    general_purpose_agent=True

3.4 Sub-Agent User Stories

3.  **Parallel Insurance Claim Assessment**

> *As an* Orchestrator Agent*, I want* spawn claims, fraud, compliance
> sub-agents in parallel *so that* I can reduce processing time while
> maintaining deep analysis.

- AC: Claims Agent has get_policy, calculate_settlement tools

- AC: Fraud Agent has social_graph_query, claims_history_analysis tools

- AC: All sub-agents execute with isolated context windows

- AC: Processing time reduced from 12s to 4.2s

4.  **Banking Loan Pipeline**

> *As a* Loan Orchestrator*, I want* delegate to document, credit, KYC
> sub-agents *so that* I can process applications with domain experts.

- AC: Document Agent uses OCR, income_validation tools

- AC: Credit Agent uses pull_credit_bureau, calculate_dti tools

- AC: Credit Agent uses fine-tuned financial model

4\. Human-in-the-Loop (HITL)

Human-in-the-Loop enables pausing agent execution for human approval on
sensitive operations, critical for high-stakes decisions in insurance
and banking where regulatory requirements demand human oversight.

4.1 HITL Architecture

| **Component**         | **Description**                                          |
|-----------------------|----------------------------------------------------------|
| **interrupt_on**      | Parameter specifying which tools require human approval  |
| **allowed_decisions** | List of valid responses: approve, edit, reject           |
| **Checkpointing**     | LangGraph checkpointer saves state during human review   |
| **approve**           | Human approves; agent continues with original parameters |
| **edit**              | Human modifies parameters; agent uses edited values      |
| **reject**            | Human rejects; agent receives rejection and must replan  |

4.2 HITL Configuration

agent = create_deep_agent(

model=\'claude-sonnet-4-5-20250929\',

tools=\[approve_claim, deny_claim, transfer_funds\],

interrupt_on={

\'approve_claim\': {\'allowed_decisions\': \[\'approve\', \'edit\',
\'reject\'\]},

\'transfer_funds\': {\'allowed_decisions\': \[\'approve\', \'reject\'\]}

}

)

4.3 HITL Requirements

15. interrupt_on Parameter: Tool-level interrupt configuration

16. Decision Types: approve, edit, reject handlers with state management

17. LangGraph Checkpointing: Persist state during human review

18. Edit Parameter Handling: Agent uses modified values when edited

19. Rejection Handling: Agent receives clear rejection to replan

20. Timeout Configuration: Configurable timeout with escalation

21. Audit Logging: Log tool, parameters, decision, reviewer, timestamp

22. Trust Level Integration: Map jAI Trust Levels to interrupt
    requirements

4.4 HITL User Stories

5.  **High-Value Claim Approval**

> *As a* Senior Adjuster*, I want* review claims over \$50,000 before
> processing *so that* high-value decisions have human oversight.

- AC: approve_claim tool interrupts for amounts \>= \$50,000

- AC: Adjuster can approve, edit settlement, or reject

- AC: Agent state persisted during review (can take hours)

- AC: Decision logged with adjuster ID, timestamp, reason

6.  **Loan Approval Override**

> *As a* Loan Officer*, I want* approve borderline credit decisions *so
> that* I can apply human judgment to edge cases.

- AC: approve_loan interrupts when risk score is 65-75 (borderline)

- AC: Edit allows adjusting rate or terms

- AC: Reject sends back to agent with guidance

5\. Long-Term Memory

Long-term memory enables agents to persist and retrieve information
across conversation threads and sessions through CompositeBackend which
routes /memories/ paths to durable storage.

5.1 Memory Architecture

| **Component**           | **Description**                                                   |
|-------------------------|-------------------------------------------------------------------|
| **CompositeBackend**    | Routes filesystem operations by path prefix to different backends |
| **StateBackend**        | Ephemeral in-memory storage for session data (/workspace/)        |
| **StoreBackend**        | LangGraph Store for persistent cross-thread memory                |
| **S3Backend**           | Amazon S3 for durable long-term storage with versioning           |
| **/memories/ Path**     | Reserved path prefix routed to persistent storage                 |
| **Namespace Isolation** | Memories isolated by user_id, tenant_id, or agent_id              |

5.2 Memory Path Structure

/memories/

├── customer\_{id}/

│ ├── preferences.json

│ ├── interaction_history.json

│ └── policy_insights.json

├── patterns/

│ ├── fraud_indicators.json

│ └── repair_shops/{id}.json

└── decisions/

└── interpretations.json

5.3 Backend Configuration

backend = CompositeBackend(

default=StateBackend(),

routes={

\'/memories/\': StoreBackend(store=langraph_store),

\'/long-term/\': S3Backend(bucket=\'jai-memories\')

}

)

5.4 Long-Term Memory Requirements

23. CompositeBackend: Route operations by path prefix

24. StoreBackend: LangGraph Store for persistent key-value storage

25. S3Backend: S3 with versioning, encryption, lifecycle policies

26. /memories/ Default Route: Auto-route to persistent storage

27. Namespace Isolation: Isolate by user_id, tenant_id

28. Cross-Thread Access: Memories accessible across threads

29. TTL Support: Configurable time-to-live for expiration

30. Knowledge Graph Sync: Sync /memories/patterns/ to jAI KG

31. Semantic Search: Vector store integration for memory retrieval

5.5 Long-Term Memory User Stories

7.  **Customer Interaction History**

> *As a* Customer Service Agent*, I want* access previous conversation
> summaries *so that* I provide continuity without repetition.

- AC: Reads /memories/customer\_{id}/interaction_history.json on start

- AC: Writes conversation summary at conversation end

- AC: Proactively references: \'I see you had an issue with claim
  \#12345\'

8.  **Fraud Pattern Learning**

> *As a* Fraud Detection Agent*, I want* discovered patterns synced to
> knowledge graph *so that* other agents benefit from my discoveries.

- AC: Writes to /memories/patterns/repair_shops/{id}.json

- AC: Background sync imports to KG as VENDOR_RISK_PATTERN

- AC: Future agents see pattern via KGMiddleware injection

9.  **Policy Interpretation Precedents**

> *As an* Underwriting Agent*, I want* remember how ambiguous clauses
> were interpreted *so that* I maintain consistency in decisions.

- AC: Searches /memories/decisions/interpretations.json

- AC: Applies consistent interpretation with citation

6\. Build Tasks - Sprint Breakdown

6.1 Sprint 1: Middleware Foundation (Weeks 1-2)

1.  **AgentMiddleware Base Class \| 8 SP \| P0**

> Create abstract base with before_model, modify_model_request,
> after_model hooks. Include state_schema annotation. Implement
> middleware chain executor.

2.  **TodoListMiddleware \| 5 SP \| P0**

> Create write_todos tool with CRUD. Implement state persistence. Add
> system prompt injection. Support status tracking.

3.  **Backend Protocol Interface \| 5 SP \| P0**

> Define BackendProtocol with read, write, list, delete, exists.
> Implement StateBackend. Create BackendFactory.

4.  **Deep Agent Factory \| 8 SP \| P0**

> Implement create_deep_agent() accepting model, tools, system_prompt,
> middleware, subagents, interrupt_on, backend.

6.2 Sprint 2: Filesystem & Context (Weeks 3-4)

5.  **FilesystemMiddleware \| 8 SP \| P0**

> Create ls, read_file, write_file, edit_file, glob, grep tools.
> Integrate with Backend abstraction.

6.  **Large Result Eviction \| 5 SP \| P1**

> Add token counting. Auto-dump exceeding threshold to
> /workspace/tool_results/. Replace context with file path.

7.  **Context Summarization \| 8 SP \| P1**

> Monitor token usage. Trigger summarization when threshold exceeded.
> Compress while preserving key info.

8.  **CompositeBackend \| 5 SP \| P1**

> Route operations by path prefix. Support path-to-backend mapping.
> Default /memories/ to StoreBackend.

6.3 Sprint 3: Sub-Agent Harness (Weeks 5-6)

9.  **SubAgentMiddleware \| 13 SP \| P0**

> Create task tool for spawning sub-agents. Support SubAgent config.
> Implement context isolation. Handle result synthesis.

10. **CompiledSubAgent Support \| 8 SP \| P1**

> Allow pre-built LangGraph graphs as sub-agents. Register with name,
> description, runnable.

11. **Nested Sub-Agent Support \| 5 SP \| P2**

> Allow sub-agents to spawn sub-agents (depth limit: 5). Track
> hierarchy. Implement resource quotas.

12. **General Purpose Sub-Agent \| 3 SP \| P1**

> Create default sub-agent when general_purpose_agent=True. Share
> filesystem backend.

6.4 Sprint 4: Human-in-the-Loop (Weeks 7-8)

13. **Interrupt Configuration \| 8 SP \| P0**

> Add interrupt_on parameter. Support tool-level config. Integrate with
> LangGraph interrupt mechanism.

14. **Decision Handlers \| 5 SP \| P0**

> Implement approve, edit, reject decision handlers with proper state
> management.

15. **Checkpointing Integration \| 5 SP \| P0**

> Integrate with LangGraph checkpointer. Persist state during review.
> Support resume after decision.

16. **HITL Audit Logging \| 3 SP \| P1**

> Log all interrupt events: tool name, parameters, decision, reviewer
> ID, timestamp.

17. **Trust Level Integration \| 5 SP \| P1**

> Map jAI Trust Levels to interrupt requirements. LEVEL_4+ requires
> approval for financial operations.

6.5 Sprint 5: Long-Term Memory (Weeks 9-10)

18. **StoreBackend \| 5 SP \| P0**

> Implement BackendProtocol using LangGraph Store. Support cross-thread
> access. Namespace isolation.

19. **S3Backend \| 5 SP \| P1**

> Implement BackendProtocol using S3. Support versioning, encryption.
> Configure for /long-term/.

20. **Memory Path Routing \| 3 SP \| P0**

> Configure CompositeBackend: /workspace/ → StateBackend, /memories/ →
> StoreBackend.

21. **Knowledge Graph Sync \| 8 SP \| P1**

> Background job to sync /memories/patterns/ to jAI KG. Create
> VENDOR_RISK_PATTERN edges.

22. **Semantic Memory Search \| 8 SP \| P2**

> Integrate with vector store. Auto-embed memories on write. Implement
> semantic search tool.

23. **Memory TTL Support \| 3 SP \| P2**

> Configurable time-to-live per path. Automatic expiration via
> background cleanup.

6.6 Sprint 6: jAI Integration (Weeks 11-12)

24. **MCP Gateway Integration \| 8 SP \| P0**

> Connect to jAI MCP Gateway. Register agent tools as MCP servers.
> Enable MCP tool discovery.

25. **A2A Protocol Integration \| 8 SP \| P1**

> Register Deep Agents in A2A Registry. Enable sub-agent discovery.
> Route delegations.

26. **Insurance Domain Agents \| 13 SP \| P0**

> Build Claims, Fraud, Compliance Deep Agents with domain middleware,
> tools, prompts.

27. **Banking Domain Agents \| 13 SP \| P0**

> Build Credit, KYC/AML, Loan Origination Deep Agents per framework
> specs.

28. **Observability Integration \| 5 SP \| P1**

> Add OpenTelemetry tracing. Track token usage, latency, cost. Create
> Grafana dashboards.

7\. Sprint Summary

| **Sprint** | **Focus Area**           | **Points** | **Timeline** | **Tasks** |
|------------|--------------------------|------------|--------------|-----------|
| 1          | Middleware Foundation    | 26         | Weeks 1-2    | 4         |
| 2          | Filesystem & Context     | 26         | Weeks 3-4    | 4         |
| 3          | Sub-Agent Harness        | 29         | Weeks 5-6    | 4         |
| 4          | Human-in-the-Loop        | 26         | Weeks 7-8    | 5         |
| 5          | Long-Term Memory         | 32         | Weeks 9-10   | 6         |
| 6          | jAI Integration          | 47         | Weeks 11-12  | 5         |
| **TOTAL**  | **Complete Integration** | **186**    | **12 Weeks** | **28**    |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*End of Document*

© 2024 Jai Infoway \| info@jaiinfoway.com