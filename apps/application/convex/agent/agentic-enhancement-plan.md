# IALEX Agent Enhancement Plan
## Planning & Document Creation System

### Overview
This document outlines the strategic enhancement of the IALEX Legal Assistant Agent to make it more agentic through intelligent planning, todo tracking, and document creation capabilities.

---

## Core Enhancement: Unified Planning & Todo System

### **planAndTrackTool**
A comprehensive tool that combines task planning with goal orientation and user visibility.

#### **Primary Functions**
1. **Task Analysis & Decomposition**
   - Analyzes complex legal requests
   - Breaks down into actionable steps
   - Identifies dependencies between tasks
   - Estimates complexity and time requirements

2. **Todo List Management**
   - Creates visible todo lists for users
   - Tracks progress in real-time
   - Allows user interaction and modification
   - Provides status updates (Pending → In Progress → Completed → Blocked)

3. **Adaptive Planning**
   - Dynamic replanning based on new information
   - Error recovery and alternative approaches
   - Context integration from tool results
   - Priority adjustment based on urgency

#### **Tool Schema**
```typescript
planAndTrackTool = {
  description: "Plan complex legal tasks and track progress with user-visible todo lists",
  args: {
    task: "Complex legal request to analyze and plan",
    context: {
      caseType: "Type of legal case",
      urgency: "low|medium|high",
      deadline: "Optional deadline",
      userExperience: "User's experience level"
    },
    planningMode: "detailed|quick|template",
    existingTodos: "Optional existing todo list to update"
  }
}
```

#### **Planning Intelligence**
- **Legal Task Recognition**: Identifies task types (research, drafting, analysis, review, communication)
- **Dependency Mapping**: Understands sequential vs parallel task execution
- **Resource Estimation**: Estimates time/complexity for each subtask
- **Template Matching**: Uses case-type templates for common scenarios

#### **Todo List Features**
- **Real-time Updates**: Live progress tracking as agent completes tasks
- **User Interaction**: Users can modify priorities, add tasks, mark completion
- **Progress Visualization**: Progress bars and completion percentages
- **Task Details**: Expandable descriptions with sub-steps and requirements
- **Status Management**: Clear status indicators for each task

---

## Document Creation Tools

### **createDocumentTool**
Creates new documents and stores them in the documents system.

#### **Primary Functions**
1. **Document Generation**
   - Creates various document types (contracts, letters, reports, etc.)
   - Uses templates and case context for customization
   - Ensures proper formatting and legal structure

2. **Storage Integration**
   - Automatically saves to Convex documents table
   - Links to appropriate case and user
   - Sets proper metadata and permissions

3. **Content Intelligence**
   - Incorporates case-specific information
   - Uses relevant legal precedents and legislation
   - Ensures compliance with jurisdiction requirements

#### **Tool Schema**
```typescript
createDocumentTool = {
  description: "Create and store legal documents in the documents system",
  args: {
    documentType: "contract|letter|report|memo|notice|other",
    title: "Document title",
    content: "Document content (can be generated or provided)",
    caseId: "Associated case ID",
    template: "Optional template to use",
    recipients: "Optional recipients for letters/notices",
    metadata: {
      jurisdiction: "Legal jurisdiction",
      urgency: "low|medium|high",
      confidentiality: "public|confidential|restricted"
    }
  }
}
```

#### **Document Types Supported**
- **Contracts**: Agreements, terms and conditions, NDAs
- **Letters**: Demand letters, client communications, official notices
- **Reports**: Case analysis, research summaries, status reports
- **Memos**: Internal memos, legal opinions, case notes
- **Notices**: Court filings, legal notices, service documents
- **Custom**: User-defined document types

### **createEscritoTool**
Creates new escritos (legal briefs/writings) in the escritos system.

#### **Primary Functions**
1. **Escrito Generation**
   - Creates structured legal writings and briefs
   - Uses ProseMirror format for rich text editing
   - Incorporates legal citations and references

2. **Case Integration**
   - Links to specific cases and contexts
   - Incorporates case facts and legal arguments
   - Maintains proper legal document structure

3. **Template System**
   - Uses existing modelo templates when available
   - Creates custom structures based on document type
   - Ensures proper legal formatting and citation style

#### **Tool Schema**
```typescript
createEscritoTool = {
  description: "Create new escritos (legal briefs/writings) in the escritos system",
  args: {
    title: "Escrito title",
    type: "demanda|contestacion|alegatos|recurso|informe|other",
    caseId: "Associated case ID",
    content: "Initial content (can be empty for template-based creation)",
    template: "Optional modelo template to use",
    structure: {
      sections: "Array of section definitions",
      citations: "Required citation format",
      jurisdiction: "Legal jurisdiction"
    },
    metadata: {
      status: "borrador|terminado",
      priority: "low|medium|high",
      deadline: "Optional deadline"
    }
  }
}
```

#### **Escrito Types Supported**
- **Demanda**: Legal complaints and petitions
- **Contestación**: Responses and answers to complaints
- **Alegatos**: Legal arguments and briefs
- **Recurso**: Appeals and legal remedies
- **Informe**: Legal reports and analyses
- **Custom**: User-defined escrito types

---

## Integration with Existing System

### **Tool Integration**
- **Planning Tool**: Coordinates with all existing tools to execute planned tasks
- **Document Tools**: Integrate with existing document processing and storage
- **Search Tools**: Use existing search capabilities for research tasks
- **Edit Tools**: Leverage existing escrito editing capabilities

### **Context Integration**
- **Case Context**: Uses existing case information for document creation
- **User Context**: Incorporates user preferences and experience level
- **Client Context**: Includes client information in document generation
- **Activity Context**: Tracks document creation in activity logs

### **UI Integration**
- **Todo Dashboard**: New UI component for todo list visualization
- **Document Creation**: Enhanced document creation workflows
- **Progress Tracking**: Real-time progress indicators
- **Task Management**: User controls for task modification

---

## Implementation Phases

### **Phase 1: Core Planning System**
1. Implement `planAndTrackTool` with basic task decomposition
2. Create todo list UI components
3. Add basic progress tracking
4. Integrate with existing agent tools

### **Phase 2: Document Creation**
1. Implement `createDocumentTool`
2. Implement `createEscritoTool`
3. Add document templates and formatting
4. Integrate with existing document storage

### **Phase 3: Advanced Planning**
1. Add intelligent dependency detection
2. Implement parallel task execution
3. Add dynamic replanning capabilities
4. Enhance task templates for different case types

### **Phase 4: Full Integration**
1. Advanced UI components for task management
2. Team collaboration features
3. Template library expansion
4. Performance optimization and learning

---

## User Experience Benefits

### **Transparency**
- Users always know what the agent is working on
- Clear visibility into task progress and completion
- Understanding of timeline and scope upfront
- Ability to intervene or redirect when needed

### **Efficiency**
- Automated task planning reduces manual overhead
- Parallel task execution speeds up complex workflows
- Template-based document creation accelerates drafting
- Intelligent replanning handles unexpected changes

### **Collaboration**
- Multiple team members can see case progress
- Clear handoff points for human review
- Shared understanding through visible todo lists
- Accountability through task completion tracking

### **Quality**
- Structured planning ensures comprehensive coverage
- Template-based creation maintains consistency
- Automatic validation and compliance checks
- Learning from successful patterns and templates

---

## Technical Considerations

### **Database Schema Updates**
- Add todo lists table with task tracking
- Extend documents table for new document types
- Add planning metadata to existing tables
- Create task templates and patterns storage

### **API Enhancements**
- New endpoints for todo management
- Enhanced document creation APIs
- Progress tracking and status updates
- Template management and retrieval

### **Performance Optimization**
- Efficient todo list updates and synchronization
- Optimized document generation and storage
- Caching for frequently used templates
- Background processing for complex tasks

### **Security and Permissions**
- Proper access control for todo lists
- Document creation permissions
- Case-based access restrictions
- Audit trails for all planning and creation activities

---

## Success Metrics

### **User Adoption**
- Percentage of users actively using todo lists
- Frequency of document creation tool usage
- User satisfaction with planning accuracy
- Reduction in manual task management overhead

### **Efficiency Gains**
- Time saved in task planning and execution
- Faster document creation and review cycles
- Reduced errors through structured planning
- Improved task completion rates

### **Quality Improvements**
- Consistency in document formatting and structure
- Reduced legal errors through template usage
- Better compliance with jurisdiction requirements
- Enhanced client satisfaction with deliverables

---

## Future Enhancements

### **Advanced AI Features**
- Natural language task interpretation
- Automatic deadline detection and scheduling
- Intelligent resource allocation
- Predictive task completion estimates

### **Integration Opportunities**
- Calendar integration for deadline management
- Email integration for document delivery
- Court filing system integration
- Client portal integration for document sharing

### **Learning and Adaptation**
- Pattern recognition from successful cases
- Automatic template improvement
- User preference learning
- Jurisdiction-specific optimization

---

## Additional Agent Enhancement Recommendations

### **System Reliability & Performance**

#### **1. Tool Reliability Layer**
Add comprehensive error handling and resilience to all agent tools:
- **Timeout Management**: Per-tool timeouts with jittered retries to prevent cascading failures
- **Circuit Breakers**: Automatic tool disabling when failure rates exceed thresholds
- **Call Deduplication**: Fingerprint-based deduplication using (input+thread+step) to prevent redundant operations
- **Centralized Wrapper**: Create a `createReliableTool` wrapper around `createTool` that all tools inherit for consistent behavior and telemetry

#### **2. Context Pruning & Long-Thread Memory**
Optimize context management for better performance and reduced token costs:
- **Thread Summarization**: Automatic summarization of older thread content while preserving key decisions
- **Pinned Case Facts**: Store and prioritize frequently referenced case facts, latest decisions, and active artifacts
- **Context Bias**: Enhance `ContextService.gatherAutoContext` to favor pinned facts and recent activity
- **Memory Refresh**: Implement refreshable summaries per thread/case to prevent context drift

#### **3. Caching & Result Reuse**
Implement intelligent caching to reduce redundant operations:
- **Legislation Cache**: Short-TTL caches for legislation reads keyed by (sourceId, section/article)
- **Document Snippet Cache**: Cache frequent document snippets and query results
- **Thread Query Memoization**: Avoid repeated Qdrant calls within minutes for similar queries
- **Smart Invalidation**: Context-aware cache invalidation based on case updates

### **Citation & Quality Assurance**

#### **4. Citation Enforcement Gate**
Ensure all tool-derived content is properly cited:
- **Post-Response Validator**: Check if tool-derived content appears without `[CIT:…]` format
- **Blocking Mechanism**: Prevent finalization of responses missing required citations
- **Standardized Returns**: Require all tools to return `citations: Array<{id, kind, title?, section?}>`
- **UI Integration**: Enable reliable citation rendering in the frontend

#### **5. Tool Decision Rationales & Audit**
Add transparency and traceability to agent decision-making:
- **Reasoning Logs**: Require each tool call to include "why now" and "expected outcome" strings
- **Metadata Storage**: Save decision rationales to message metadata for audit trails
- **UI Display**: Collapsible "reasoning log" in the UI for user transparency
- **Performance Tracking**: Monitor tool usage patterns and success rates

### **Document Editing Precision**

#### **6. Deterministic Document Editing Outputs**
Improve document editing with structured, auditable changes:
- **Structured Edits**: Return insert/replace-with-ranges instead of full-text blobs
- **Diff Integration**: Leverage existing `packages/shared/diff` utilities for precise change tracking
- **Merge Conflict Prevention**: Reduce conflicts through granular edit operations
- **Audit Trail**: Enable precise "what changed" UI with before/after comparisons

### **Adaptive Intelligence**

#### **7. Adaptive Model & Step Budgeting**
Optimize resource usage based on task complexity:
- **Intent-Based Routing**: Use cheaper models for browsing/listing, stronger models for analysis/editing
- **Dynamic Step Limits**: Adjust `stopWhen` based on task difficulty, cost so far, and user urgency
- **Provider Fallbacks**: Automatic fallback across providers on rate limits or failures
- **Cost Monitoring**: Track and optimize token usage per task type

### **Security & Permissions**

#### **8. Permission-First Tool Guards**
Implement comprehensive access control for all agent operations:
- **Pre-Authorization**: Standardize `preAuthorize({userId, caseId, permission})` helper for all tools
- **Output Redaction**: Apply redaction policies for client-facing contexts
- **Audit Events**: Emit audit events for all sensitive read/write operations
- **Case-Based Access**: Enforce case-based access restrictions consistently

### **User Experience**

#### **9. Streaming UX Upgrades**
Enhance real-time user experience during agent operations:
- **Progressive Results**: Stream partial tool results (e.g., top-3 then full list)
- **Inline Citations**: Show progressive citations as they're discovered
- **Actionable Repairs**: When `experimental_repairToolCall` fires, present "Try with suggested parameters" chips
- **Interactive Recovery**: Allow users to click to continue streams after tool call failures

### **Testing & Quality Assurance**

#### **10. Evaluation Harness**
Implement systematic testing and quality monitoring:
- **Scenario Runner**: Ship a small scenario runner with golden prompts (research, draft, edit, cite)
- **Quality Assertions**: Verify citations present, tool usage matches policy, no unauthorized reads
- **Performance Thresholds**: Assert latency stays under defined limits
- **CI Integration**: Run evaluation harness in CI to catch regressions
- **Success Metrics**: Track citation accuracy, tool usage efficiency, and user satisfaction

---

## Implementation Priority

### **Phase 1: Foundation (Immediate)**
- Tool reliability layer (#1)
- Citation enforcement gate (#4)
- Permission-first tool guards (#8)

### **Phase 2: Performance (Short-term)**
- Context pruning & memory (#2)
- Caching & result reuse (#3)
- Adaptive model routing (#7)

### **Phase 3: Quality (Medium-term)**
- Tool decision rationales (#5)
- Deterministic editing outputs (#6)
- Evaluation harness (#10)

### **Phase 4: Experience (Long-term)**
- Streaming UX upgrades (#9)
- Advanced context intelligence
- Comprehensive audit trails

---

This enhancement plan transforms the IALEX agent from a reactive assistant into a proactive, planning-oriented legal partner that can break down complex tasks, track progress transparently, and create professional legal documents efficiently.
