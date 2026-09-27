# Product Requirements Document: TaskMaster

**Product Name:** TaskMaster\
**Version:** 2.0\
**Platform:** Responsive Web Application\
**Product Type:** AI-powered personal productivity and execution system\
**Primary Audience:** Busy individuals juggling multiple areas of work
and life\
**Core Requirement:** Turn an unstructured workload into a realistic,
prioritised plan and continuously help the user decide what to do next.

------------------------------------------------------------------------

## 1. Overview

### 1.1 Purpose

TaskMaster helps busy people turn mental clutter into clear action.

Users can give TaskMaster tasks, responsibilities, goals, deadlines,
ideas, worries, and incomplete thoughts in natural language without
organising them first. TaskMaster identifies what needs doing,
structures the work, detects important dates and dependencies,
recommends priorities, creates a realistic plan, and helps the user work
through that plan until completion.

TaskMaster is not intended to be another passive to-do list. Its main
job is to reduce the decision-making burden involved in answering:

-   What do I actually need to do?
-   What matters most?
-   What should I do next?
-   What can wait?
-   Is my plan realistic?
-   What should I postpone, simplify, delegate, or drop?
-   Am I making progress on what actually matters?

### 1.2 Core Product Promise

> **Tell TaskMaster everything you need to get done. It will work out
> what matters, build you a realistic plan, and tell you what to do
> next.**

Core transformation:

**Messy Thoughts → Organised Work → Prioritised Actions → Realistic Plan
→ Focus → Completion**

### 1.3 Target Audience

TaskMaster is initially designed for **busy individuals juggling
multiple areas of work and life who have too much competing for their
attention and struggle to decide what to focus on next**.

Typical users may be balancing:

-   work
-   family
-   personal administration
-   appointments
-   finances
-   household responsibilities
-   side projects
-   learning
-   health and fitness commitments
-   longer-term goals

The initial product is for individuals rather than enterprise
project-management teams.

### 1.4 Primary User Problem

The target user's problem is not simply that they need somewhere to
store tasks.

Their commitments are often scattered across their memory, notes,
messages, email, calendars, existing lists, unfinished projects, and
goals. Even when everything is written down, they still have to decide
what deserves attention.

This creates:

-   overwhelm
-   forgotten commitments
-   poor prioritisation
-   procrastination
-   unrealistic daily plans
-   excessive task switching
-   neglected long-term goals
-   repeated rescheduling
-   uncertainty about what to do next

TaskMaster should reduce this mental load by doing much of the
organisation and planning work for the user.

### 1.5 Product Principles

1.  **Reduce Mental Load** --- Users should not need to organise their
    thoughts before entering them.
2.  **AI Recommends; User Decides** --- TaskMaster can organise,
    prioritise, challenge, and recommend, but the user retains final
    control.
3.  **Action Over Administration** --- Users should spend more time
    doing work than maintaining a productivity system.
4.  **Realistic Planning** --- Plans must respect limited time,
    deadlines, effort, changing circumstances, and interruptions.
5.  **Explain Important Recommendations** --- TaskMaster should briefly
    explain why something is being prioritised or changed.
6.  **Flexible, Not Rigid** --- The product should not force every user
    into one productivity methodology.
7.  **Fast Time to Value** --- New users should experience the core
    value within minutes.
8.  **Challenge, Don't Control** --- When a workload is unrealistic,
    TaskMaster should surface the trade-off rather than silently
    accepting it.

### 1.6 Core User Journey

1.  **Capture** --- User enters a Brain Dump, Quick Add, or manual task.
2.  **Understand** --- TaskMaster identifies tasks, projects, deadlines,
    goals, notes, and relevant context.
3.  **Organise** --- Related work is grouped and structured.
4.  **Break Down** --- Large or vague work can be converted into smaller
    actions.
5.  **Prioritise** --- TaskMaster evaluates what matters using multiple
    signals.
6.  **Plan** --- A realistic daily/near-term plan is created.
7.  **Focus** --- The user is shown the most useful next action.
8.  **Adapt** --- TaskMaster helps reorganise when circumstances change.
9.  **Review** --- The user can see progress and improve future
    planning.

### 1.7 First-Time User Experience

The recommended first-run journey is:

**Sign Up → Short Introduction → Brain Dump → AI Organises → User
Reviews/Approves → Build My Plan → Next Best Action**

The product should not begin with a large configuration process or an
empty dashboard.

Suggested opening prompt:

> **What's taking up space in your head right now?**\
> Add work, personal tasks, deadlines, things you've been putting off,
> projects, or anything else you need to get done. Don't organise it
> first.

TaskMaster should then show what it understood before committing
important changes.

### 1.8 Platform Architecture

TaskMaster will be a **cloud-based responsive web application** designed
for desktop and mobile.

High-level architecture:

**Responsive Web App → Authentication → Cloud Database → Application/API
Layer → AI Service**

Future phases add:

**Calendar / Email / Notification / Billing / Collaboration
Integrations**

Unlike a local-only prototype, production TaskMaster should support
secure user accounts, persistent cloud data, and cross-device access.

### 1.9 Technical Requirements

Exact vendors and frameworks may be selected during implementation. The
product architecture must support:

-   responsive web UI
-   authenticated user accounts
-   secure per-user cloud data
-   cross-device persistence
-   structured task/project/goal data
-   server-side AI requests
-   schema migrations
-   background-safe integration architecture for later phases
-   export/delete account data
-   observability for application errors
-   environment-based secret management
-   no API keys exposed to the client

### 1.10 Initial Data Model

Core entities:

#### User

-   id
-   name
-   email
-   timezone
-   preferences
-   createdAt
-   updatedAt

#### Task

-   id
-   userId
-   title
-   description
-   status
-   priority
-   urgency
-   importance
-   dueDate
-   estimatedMinutes
-   energyRequirement
-   projectId
-   goalId
-   source
-   createdAt
-   updatedAt
-   completedAt

#### Project

-   id
-   userId
-   name
-   description
-   status
-   dueDate
-   goalId
-   createdAt
-   updatedAt

#### BrainDump

-   id
-   userId
-   rawText
-   processingStatus
-   createdAt

#### Goal

-   id
-   userId
-   title
-   description
-   targetDate
-   status
-   createdAt
-   updatedAt

#### Plan

-   id
-   userId
-   date
-   mode
-   availableMinutes
-   generatedAt
-   updatedAt

#### PlanItem

-   id
-   planId
-   taskId
-   position
-   scheduledStart
-   scheduledEnd
-   recommendationReason

### 1.11 Non-Functional Requirements

-   **Security:** Users may only access their own private productivity
    data.
-   **Privacy:** AI processing and connected services must be clearly
    disclosed.
-   **Reliability:** Core task data must persist safely across sessions
    and devices.
-   **Accessibility:** Target WCAG 2.1 AA for core flows.
-   **Responsiveness:** Core functionality must work on modern desktop
    and mobile browsers.
-   **Performance:** Common navigation and task interactions should feel
    immediate; AI operations should expose clear processing states.
-   **Recoverability:** Failed AI processing must not destroy or
    silently alter user input.
-   **Explainability:** Important AI recommendations should have short
    human-readable reasons.
-   **User Control:** Destructive or materially consequential AI
    suggestions require user confirmation.

------------------------------------------------------------------------

## 2. Phase 1 --- Core MVP

**Goal:** Prove that users will trust TaskMaster to turn an unstructured
workload into an organised, realistic plan and help them decide what to
do next.

### 2.1 Feature Priorities

Priority definitions:

-   **P0** --- TaskMaster should not launch without it.
-   **P1** --- Important enhancement, but the core launch can function
    without the complete version.
-   **P2** --- Planned improvement after the central experience is
    validated.

### 2.2 Features

#### Capture & Organisation

  -----------------------------------------------------------------------
  Feature                 Description             Priority
  ----------------------- ----------------------- -----------------------
  Brain Dump              Free-text capture of    P0
                          multiple messy thoughts 
                          and commitments at once 

  AI Task Extraction      Convert unstructured    P0
                          Brain Dump content into 
                          proposed structured     
                          items                   

  Review Before Commit    User confirms/corrects  P0
                          AI-extracted work       
                          before saving           

  Quick Add               Fast natural-language   P0
                          task entry such as      
                          "Call John tomorrow at  
                          2pm"                    

  Manual Task Creation    Traditional structured  P0
                          task entry/editing      

  Inbox                   Universal place for     P0
                          captured/unprocessed    
                          work                    

  Project Organisation    Group related tasks     P0
                          into projects; AI may   
                          suggest grouping        

  Notes vs Tasks          Avoid turning every     P1
  Detection               thought into an action  
  -----------------------------------------------------------------------

#### Dates, Priorities & Planning

  -----------------------------------------------------------------------
  Feature                 Description             Priority
  ----------------------- ----------------------- -----------------------
  Deadline Detection      Detect explicit         P0
                          dates/times in          
                          natural-language input  

  Priority Recommendation Recommend relative      P0
                          priority using multiple 
                          signals                 

  User Priority Override  User can change any AI  P0
                          priority                

  Next Best Action        Recommend the most      P0
                          useful task to work on  
                          now                     

  Recommendation Reason   Explain briefly why the P0
                          action is recommended   

  Daily Plan              Produce a manageable    P0
                          set/sequence of work    
                          for today               

  Flexible Plan View      Priority-ordered plan   P0
                          without rigid time      
                          blocks                  

  Basic Scheduled View    Place selected work     P1
                          into estimated time     
                          blocks                  

  Available-Time Input    User can say "I have 20 P1
                          minutes" and receive    
                          suitable work           

  Basic Capacity Warning  Warn when today's       P1
                          planned work exceeds    
                          stated/estimated        
                          capacity                
  -----------------------------------------------------------------------

#### Execution

  -----------------------------------------------------------------------
  Feature                 Description             Priority
  ----------------------- ----------------------- -----------------------
  Task Completion         Complete a task and     P0
                          update plan/progress    

  Focus Mode              Show one current task   P0
                          with essential context  
                          and minimal             
                          distractions            

  Postpone                Move unfinished work    P0
                          without deleting it     

  Basic Recovery          Ask what to do with     P1
                          affected work when the  
                          plan falls behind       

  Task Breakdown          Turn a large/vague task P1
                          into smaller actionable 
                          steps                   
  -----------------------------------------------------------------------

#### Account & Core Product

  -----------------------------------------------------------------------
  Feature                 Description             Priority
  ----------------------- ----------------------- -----------------------
  User Account            Sign up, sign in, sign  P0
                          out                     

  Cloud Persistence       Store user data         P0
                          securely in cloud       
                          database                

  Cross-Device Access     Same account/data       P0
                          accessible from desktop 
                          and mobile browsers     

  Responsive UI           Core journeys usable on P0
                          mobile and desktop      

  Basic Preferences       Timezone and essential  P0
                          planning preferences    

  Account/Data Deletion   User can remove their   P0
                          account/data            
  -----------------------------------------------------------------------

### 2.3 Prioritisation Model

TaskMaster should not use one simple priority label as its entire
decision engine.

Initial signals may include:

-   explicit user priority
-   urgency
-   importance
-   deadline proximity
-   overdue status
-   dependencies
-   estimated duration
-   available time
-   project relevance
-   goal relevance

The AI/system may recommend strongly, but the user always retains final
control.

Example:

> **Work on the client proposal next.**\
> It is due tomorrow, is marked important, and two other tasks depend on
> it.

The exact scoring formula is an implementation detail and may evolve
through testing.

### 2.4 User Experience

#### User Flow 1: First Brain Dump

1.  User signs up.
2.  TaskMaster gives a short explanation of its core promise.
3.  User is taken directly to Brain Dump.
4.  User enters messy natural-language commitments.
5.  TaskMaster processes the input.
6.  Review screen shows proposed tasks, projects, dates, and other
    detected information.
7.  User edits, removes, or approves proposed items.
8.  User selects **Build My Plan**.
9.  TaskMaster creates the first daily plan.
10. Next Best Action is prominently displayed with a short reason.
11. User can start Focus Mode.

#### User Flow 2: Quick Add

1.  User activates Quick Add.
2.  Enters: "Send Sarah the figures Friday morning."
3.  TaskMaster extracts title and date/time.
4.  User saves immediately or corrects the interpretation.
5.  Task is incorporated into the current plan when relevant.

#### User Flow 3: What Should I Do Next?

1.  User opens Today.
2.  TaskMaster displays Next Best Action.
3.  Recommendation includes a short reason.
4.  User can start it, choose another task, or change priority.
5.  TaskMaster respects the user's choice.

#### User Flow 4: Focus

1.  User starts Focus Mode.
2.  The current task becomes the primary interface.
3.  User sees task title, essential context, and completion/postpone
    actions.
4.  Wider backlog stays out of the way.
5.  User completes or postpones.
6.  TaskMaster updates the plan and recommends the next action.

#### User Flow 5: Plan Falls Behind

1.  A planned task remains unfinished.
2.  TaskMaster does not silently keep rearranging everything
    indefinitely.
3.  It asks what should happen where the decision matters.
4.  User can keep or postpone the work; later phases add richer
    simplify/drop/delegate actions.
5.  TaskMaster rebuilds the affected plan.

### 2.5 Main Navigation

Recommended MVP areas:

-   **Today** --- daily plan, Next Best Action, capacity status
-   **Inbox** --- quick captures and unprocessed work
-   **Projects** --- grouped multi-step work
-   **Focus** --- current task execution
-   **More/Settings** --- preferences and account controls

Goals, Reviews, Insights, Habits, and Integrations do not need to be
primary MVP navigation items.

### 2.6 AI Behaviour

For Phase 1, TaskMaster AI should:

-   extract actionable items from messy text
-   distinguish likely tasks from notes where possible
-   detect explicit deadlines
-   suggest project grouping
-   suggest priorities
-   break down large tasks when requested
-   recommend Next Best Action
-   explain important recommendations briefly
-   ask a clarifying question only when uncertainty materially affects
    the plan
-   accept user corrections
-   never silently delete commitments
-   never make important irreversible changes without confirmation

When AI confidence is low, the product should expose uncertainty instead
of pretending certainty.

### 2.7 Technical Details

Recommended implementation shape:

-   modern typed web framework
-   responsive component-based frontend
-   managed authentication
-   relational cloud database
-   server/API layer for protected data and AI calls
-   schema validation for AI output
-   structured AI responses rather than free-form parsing where
    practical
-   database migrations under version control
-   secure environment variables for AI/provider credentials
-   logging/error monitoring without exposing private task content
    unnecessarily

AI extraction should follow:

**Raw Brain Dump → AI/Parser → Validated Structured Proposal → User
Review → Database Commit**

The raw AI response must not directly mutate stored user data without
validation.

### 2.8 Design System --- Phase 1

The visual direction should support TaskMaster's product principle:
**clarity and action**.

#### Experience Principles

-   calm rather than busy
-   one obvious primary action per screen
-   strong hierarchy around "what next?"
-   minimal visual noise
-   short explanations
-   mobile-friendly touch targets
-   accessible contrast
-   destructive actions clearly differentiated
-   AI recommendations visually distinguishable from confirmed user
    decisions

#### Core Components

-   App Shell
-   Brain Dump Composer
-   AI Processing State
-   Extraction Review
-   Task Row/Card
-   Project Card
-   Next Best Action Card
-   Daily Plan
-   Priority/Deadline Indicators
-   Focus Mode
-   Quick Add
-   Confirmation Dialog
-   Toast/Feedback
-   Empty State
-   Loading/Error State

Exact colour tokens, typography, spacing, radii, and component
specifications should be finalised during the design phase rather than
invented in the PRD before design approval.

### 2.9 MVP Success Metrics

Initial product metrics should focus on whether TaskMaster creates
useful action, not vanity usage.

  -----------------------------------------------------------------------
  Metric                              Initial Success Signal
  ----------------------------------- -----------------------------------
  Onboarding completion               User reaches first generated plan

  Brain Dump conversion               Submitted Brain Dump produces
                                      reviewable structured work

  Plan activation                     User starts at least one
                                      recommended task

  Recommendation usefulness           User accepts or intentionally
                                      overrides Next Best Action

  Task completion                     Users complete tasks from generated
                                      plans

  Repeat planning                     Users return to Today/plan on later
                                      days

  Time to first value                 User reaches first Next Best Action
                                      within a few minutes

  AI correction rate                  Track how often extracted
                                      items/dates/priorities require
                                      correction

  Recovery engagement                 Users resolve unfinished planned
                                      work rather than abandoning the
                                      plan
  -----------------------------------------------------------------------

Numeric commercial targets should be set after baseline
prototype/user-testing data exists.

### 2.10 MVP Acceptance Criteria

-   [ ] User can create an account and sign in/out.
-   [ ] User data persists securely across sessions.
-   [ ] User can access the same account from mobile and desktop
    browsers.
-   [ ] User can submit a multi-item Brain Dump.
-   [ ] Brain Dump produces separate proposed tasks rather than one text
    blob.
-   [ ] User can review and edit AI-extracted items before saving.
-   [ ] Explicit deadlines can be detected and corrected.
-   [ ] Related tasks can be assigned/grouped into projects.
-   [ ] User can create a task with Quick Add.
-   [ ] User can create/edit a task manually.
-   [ ] TaskMaster can recommend task priorities.
-   [ ] User can override a recommended priority.
-   [ ] TaskMaster can generate a daily plan.
-   [ ] Today clearly displays a Next Best Action.
-   [ ] Next Best Action includes a short explanation.
-   [ ] User can enter Focus Mode for the recommended task.
-   [ ] User can complete a task.
-   [ ] Completion updates the plan and progress.
-   [ ] User can postpone a task.
-   [ ] Failed AI processing does not lose the original Brain Dump.
-   [ ] Core flows are usable on mobile and desktop.
-   [ ] User can delete their account/data.

------------------------------------------------------------------------

## 3. Phase 2 --- Intelligent Planning

**Goal:** Make TaskMaster substantially better at creating realistic
plans and helping users handle overload, changing circumstances,
procrastination, and longer-term priorities.

### 3.1 Features

#### Realistic Planning

  -----------------------------------------------------------------------
  Feature                 Description             Priority
  ----------------------- ----------------------- -----------------------
  Advanced Capacity       Compare planned effort  P0
  Awareness               with realistically      
                          available time          

  Reality Check           Challenge plans that    P0
                          cannot realistically    
                          fit                     

  Keep / Postpone / Drop  Resolve overloaded or   P0
                          missed commitments      
                          explicitly              

  Simplify Suggestion     Suggest reducing scope  P1
                          when appropriate        

  Delegate Suggestion     Suggest delegation as   P1
                          an option; user decides 

  Energy-Aware Planning   Match demanding/simple  P1
                          tasks to stated energy  

  Improved Duration       Learn/correct task      P1
  Estimates               duration estimates      

  Flexible vs Scheduled   Stronger switching      P1
  Modes                   between ordered and     
                          time-based planning     
  -----------------------------------------------------------------------

#### Goals & Responsibilities

  -----------------------------------------------------------------------------
  Feature                 Description                   Priority
  ----------------------- ----------------------------- -----------------------
  Goals                   Store important longer-term   P0
                          outcomes                      

  Goal Breakdown          Convert goals into            P1
                          milestones/projects/actions   

  Goal Alignment          Identify when daily work is   P1
                          neglecting important goals    

  Recurring               Manage repeating obligations  P0
  Responsibilities        without cluttering ordinary   
                          tasks                         

  Responsibility Areas    Work, Family, Home, Finance,  P1
                          etc.                          
  -----------------------------------------------------------------------------

#### Reviews & Behaviour

  -----------------------------------------------------------------------
  Feature                 Description             Priority
  ----------------------- ----------------------- -----------------------
  Daily Review            Quick review of         P1
                          completed, missed,      
                          changed, and            
                          carried-forward work    

  Weekly Review           Review progress,        P1
                          priorities,             
                          bottlenecks, and        
                          upcoming deadlines      

  Procrastination Assist  Detect repeated         P1
                          postponement and help   
                          identify the blocker    

  Basic Productivity      Turn recurring patterns P2
  Insights                into practical          
                          suggestions             

  Adaptive Planning       Learn useful working    P2
                          patterns over time      
  -----------------------------------------------------------------------

### 3.2 User Experience

#### User Flow 1: Reality Check

1.  TaskMaster calculates that the user has substantially more planned
    work than available capacity.
2.  It explains the mismatch plainly.
3.  It proposes realistic choices such as postpone, simplify, delegate,
    or drop.
4.  The user chooses what changes.
5.  TaskMaster rebuilds the plan.

Example:

> You have about 9 hours of planned work and roughly 5 hours available.
> Something needs to move. I recommend postponing the garage task and
> reducing the scope of the presentation review. You decide.

#### User Flow 2: Procrastination Assist

1.  TaskMaster detects repeated postponement of the same task.
2.  It asks a short useful question about the blocker.
3.  It may offer to break the task down, clarify the next action, reduce
    scope, change timing, reconsider priority, or remove it.
4.  User selects the useful intervention.
5.  Plan updates.

#### User Flow 3: Weekly Review

1.  User opens Weekly Review.
2.  TaskMaster summarises meaningful progress and missed commitments.
3.  It highlights upcoming deadlines and neglected priorities.
4.  User confirms priorities for the coming week.
5.  TaskMaster incorporates them into planning.

### 3.3 Technical Details

Phase 2 introduces richer planning signals and behavioural history.

Requirements include:

-   task event/history records
-   recurring-task rules
-   goal/task/project relationships
-   planning-capacity calculations
-   duration feedback
-   postponement history
-   explainable recommendation metadata
-   controlled personalisation based on user behaviour

Behavioural signals should inform recommendations without automatically
overriding explicit user choices.

### 3.4 Success Metrics

-   reduction in obviously overloaded generated days
-   percentage of Reality Checks resolved
-   repeated-postponement tasks receiving an intervention
-   weekly review completion
-   percentage of important goals receiving planned actions
-   improved estimated-vs-actual duration accuracy
-   repeat use of planning features

### 3.5 Acceptance Criteria

-   [ ] TaskMaster detects when planned effort exceeds available
    capacity.
-   [ ] Reality Check explains the conflict.
-   [ ] User can Keep, Postpone, or Drop affected work.
-   [ ] TaskMaster can suggest Simplify or Delegate without acting
    automatically.
-   [ ] User can create goals.
-   [ ] Tasks/projects can connect to goals.
-   [ ] Recurring responsibilities can generate/manage future work.
-   [ ] User can complete a Daily Review.
-   [ ] User can complete a Weekly Review.
-   [ ] Repeated postponement can trigger Procrastination Assist.
-   [ ] User corrections influence subsequent planning where
    appropriate.

------------------------------------------------------------------------

## 4. Phase 3 --- Integrations & Automation

**Goal:** Reduce manual capture and make TaskMaster aware of commitments
that already exist in the user's working life.

### 4.1 Features

  -----------------------------------------------------------------------
  Feature                 Description             Priority
  ----------------------- ----------------------- -----------------------
  Calendar Integration    Read relevant meetings, P0
                          appointments, blocked   
                          time, and availability  

  Calendar-Aware Planning Build plans around      P0
                          existing calendar       
                          commitments             

  Email Integration       Identify possible       P1
                          commitments, deadlines, 
                          follow-ups, and         
                          requests                

  Commitment Review Queue User approves           P0
                          externally detected     
                          commitments before      
                          adding them             

  Automatic Commitment    Reduce manual entry     P1
  Capture                 from approved connected 
                          sources                 

  Smart Notifications     Selective alerts for    P1
                          meaningful              
                          deadlines/plan changes  

  Waiting On              Track actions owned by  P1
                          someone else            

  Lightweight Delegation  Assign responsibility   P2
                          without becoming        
                          enterprise PM software  

  Accountability          Useful follow-up on     P2
  Check-Ins               meaningful commitments  
  -----------------------------------------------------------------------

### 4.2 Integration Principles

-   Connecting external accounts is optional.
-   Core TaskMaster remains useful without integrations.
-   Imported commitments must be reviewable/correctable.
-   TaskMaster should request only permissions needed for the selected
    feature.
-   Connected data must be handled according to provider requirements
    and the product privacy policy.
-   Email/calendar content should not be treated as a confirmed task
    merely because AI detects one.
-   Users can disconnect integrations.

### 4.3 User Experience

#### User Flow: Calendar-Aware Day

1.  User connects a calendar.
2.  TaskMaster sees relevant busy/free periods.
3.  Existing appointments are reflected in available capacity.
4.  TaskMaster places or recommends tasks around those commitments.
5.  User can override the resulting plan.

#### User Flow: Email Commitment Detection

1.  Connected email contains a likely request or deadline.
2.  TaskMaster places the candidate in a review queue.
3.  User accepts, edits, or dismisses it.
4.  Accepted item becomes structured TaskMaster work.
5.  It enters normal prioritisation/planning.

### 4.4 Technical Details

-   OAuth-based integrations where applicable
-   encrypted provider credentials/tokens
-   server-side integration processing
-   token refresh/revocation handling
-   sync status/error handling
-   external source identifiers to prevent duplicates
-   audit trail for imported commitments
-   notification preference model

### 4.5 Acceptance Criteria

-   [ ] User can connect/disconnect a supported calendar.
-   [ ] Calendar commitments affect available planning capacity.
-   [ ] Integration failure does not break manual planning.
-   [ ] External candidate commitments can be reviewed before becoming
    tasks.
-   [ ] Duplicate imported items are prevented or surfaced.
-   [ ] Users can control notification preferences.
-   [ ] Revoked integration access is handled safely.

------------------------------------------------------------------------

## 5. Phase 4 --- Commercial & Advanced Features

**Goal:** Turn validated TaskMaster behaviour into a sustainable paid
product while deepening automation and intelligence without weakening
the simple core experience.

### 5.1 Commercial Model

The free product should demonstrate TaskMaster's complete central value:

**Capture → Organise → Prioritise → Plan → Next Action**

Premium should primarily answer:

> **How can TaskMaster do more of this automatically and intelligently
> for me?**

Potential model:

#### Free

-   core task/project management
-   Brain Dump with reasonable usage limits
-   Quick Add/manual capture
-   basic AI extraction
-   basic prioritisation
-   daily plan
-   Next Best Action
-   Focus Mode
-   basic cloud sync

#### Pro

-   higher AI usage
-   calendar integration
-   email integration
-   advanced planning
-   automatic commitment capture
-   advanced insights
-   deeper history
-   more automation
-   richer goal/review intelligence

#### Future Team/Business

Only after individual product-market fit:

-   shared projects
-   enhanced delegation
-   shared responsibility
-   team planning/visibility
-   administrative controls

TaskMaster should not become a full enterprise project-management suite
by accident.

### 5.2 Advanced Features

  -----------------------------------------------------------------------
  Feature                 Description             Priority
  ----------------------- ----------------------- -----------------------
  Subscription/Billing    Paid plan management    P0 for commercial
                                                  launch

  Usage Entitlements      Enforce Free/Pro        P0
                          feature/AI limits       

  Advanced AI Planning    Richer multi-project    P1
                          and longer-horizon      
                          planning                

  Advanced Insights       Deeper workload and     P1
                          behavioural patterns    

  Expanded History        Longer-term             P1
                          productivity history    

  Advanced Automation     More routine planning   P1
                          handled automatically   

  Enhanced Collaboration  Shared                  P2
                          responsibility/team     
                          features                

  Multi-Device Native     Evaluate native apps    P2
  Experiences             after web validation    
  -----------------------------------------------------------------------

### 5.3 Commercial Success Metrics

-   free-to-paid conversion
-   trial-to-paid conversion if trials are used
-   paid retention
-   monthly recurring revenue
-   AI cost per active/paid user
-   percentage of paid users using premium automation/integrations
-   churn reasons
-   sustained use of core planning loop

Targets should be set after real usage and pricing tests rather than
invented before launch data exists.

### 5.4 Acceptance Criteria

-   [ ] User can upgrade/downgrade according to billing rules.
-   [ ] Paid entitlements are enforced server-side.
-   [ ] Failed payments are handled safely.
-   [ ] Cancellation does not destroy user-owned productivity data.
-   [ ] Free users continue to experience the core TaskMaster value.
-   [ ] Premium features materially reduce manual effort or deepen
    useful planning.

------------------------------------------------------------------------

## 6. Risks & Mitigations

  -----------------------------------------------------------------------------
  Risk              Likelihood        Impact            Mitigation
  ----------------- ----------------- ----------------- -----------------------
  AI extracts tasks High              High              Review-before-commit,
  incorrectly                                           editable output, schema
                                                        validation

  AI gives poor     Medium            High              Explain
  priorities                                            recommendations, user
                                                        override, collect
                                                        correction signals

  Product becomes   Medium            High              Protect core Capture →
  another                                               Plan → Focus loop;
  complicated task                                      control feature growth
  manager                                               

  Users do not      Medium            High              Explain "why", preserve
  trust AI planning                                     control, avoid silent
                                                        changes

  Plans become      Medium            High              Capacity awareness,
  unrealistic                                           Reality Check, duration
                                                        estimates

  Too many          Medium            Medium            Minimal defaults,
  notifications                                         selective
  create stress                                         notifications, user
                                                        controls

  AI costs grow too Medium            High              Usage limits, model
  quickly                                               routing/caching where
                                                        appropriate, monitor
                                                        unit economics

  Sensitive         Low/Medium        Critical          Strong auth, access
  productivity data                                     controls, encryption,
  is exposed                                            least privilege,
                                                        security review

  External          Medium            High              Review queue, source
  integration                                           IDs, deduplication,
  errors create                                         audit trail
  duplicate/wrong                                       
  tasks                                                 

  Scope expands     High              High              Strict P0/P1/P2
  before core value                                     definitions and phased
  is proven                                             roadmap

  Collaboration     Medium            Medium            Keep individual
  turns product                                         execution as product
  into enterprise                                       centre; defer teams
  PM                                                    

  Users abandon     Medium            High              Fast first plan,
  after initial                                         obvious Next Best
  Brain Dump                                            Action, strong return
                                                        experience
  -----------------------------------------------------------------------------

------------------------------------------------------------------------

## 7. Appendix

### 7.1 Product Positioning

**Short Positioning Statement**

> **TaskMaster turns everything on your mind into a clear, realistic
> plan and helps you focus on what matters next.**

**Long Positioning Statement**

TaskMaster is an intelligent productivity system for busy people who
have too much competing for their attention. Users unload tasks, goals,
responsibilities, deadlines, and ideas in their own words. TaskMaster
organises the mess, recommends what matters, creates a realistic plan,
and helps the user adapt and follow through until the work gets done.

### 7.2 North Star

TaskMaster should repeatedly create this feeling:

> **"I know what matters, I know what to do next, and I trust that
> everything else is under control."**

### 7.3 What TaskMaster Should Avoid Becoming

TaskMaster should not initially become:

-   a complicated enterprise project-management suite
-   a social productivity network
-   a heavily gamified habit tracker
-   an endless analytics dashboard
-   a calendar replacement
-   a heavyweight note-taking system
-   an AI assistant that changes important commitments without approval
-   a product that requires constant administration to remain useful

### 7.4 Core Terminology

**Brain Dump** --- unstructured natural-language capture containing
multiple thoughts or commitments.

**Quick Add** --- rapid entry of a single commitment using natural
language.

**Inbox** --- captured work not yet fully processed or organised.

**Project** --- a multi-step outcome containing related tasks.

**Goal** --- a larger desired outcome that may contain
milestones/projects/actions.

**Daily Plan** --- TaskMaster's realistic recommendation for what should
receive attention today.

**Next Best Action** --- the task TaskMaster currently recommends doing
next.

**Focus Mode** --- distraction-minimised execution view for one current
task.

**Reality Check** --- intervention shown when planned work does not
realistically fit available capacity.

**Recovery Check-In** --- explicit decision point for work affected by a
disrupted plan.

### 7.5 AI Decision Rules

1.  Do not automatically delete a user's commitment.
2.  Do not treat AI confidence as certainty.
3.  Ask questions only when the answer materially affects the plan.
4.  Prefer short explanations over long AI commentary.
5.  Preserve user overrides.
6.  When a plan cannot fit, expose the trade-off.
7.  Recommend postponing, simplifying, delegating, or dropping where
    useful; user confirms.
8.  Avoid allowing every urgent item to permanently crowd out important
    long-term work.
9.  Prioritisation should consider context rather than only due date.
10. AI should reduce administration, not create more of it.

### 7.6 Phase Summary

  -----------------------------------------------------------------------
  Phase                   Focus                   Primary Outcome
  ----------------------- ----------------------- -----------------------
  Phase 1                 Core MVP                Messy workload becomes
                                                  a useful plan and Next
                                                  Best Action

  Phase 2                 Intelligent Planning    Plans become more
                                                  realistic, adaptive,
                                                  and goal-aware

  Phase 3                 Integrations &          Manual capture
                          Automation              decreases and
                                                  real-world commitments
                                                  inform planning

  Phase 4                 Commercial & Advanced   Sustainable paid
                                                  product with deeper
                                                  intelligence and
                                                  automation
  -----------------------------------------------------------------------

### 7.7 MVP Boundary

The Phase 1 MVP is intentionally narrower than the full TaskMaster
vision.

The MVP must prove:

> **Can TaskMaster take a person's messy workload, organise it well
> enough to earn trust, create a realistic plan, and help that person
> confidently start the right next action?**

If a proposed Phase 1 feature does not materially help prove that
hypothesis, it should normally be P1/P2 or moved to a later phase.

### 7.8 Change Log

#### Version 2.0 --- PRD Restructure

**Decision:** Rebuilt the TaskMaster PRD around a phased,
implementation-oriented structure.

**Key changes:** - replaced the large flat feature catalogue with phased
development - introduced P0/P1/P2 priorities - narrowed the true launch
MVP - made Brain Dump the signature capture experience - retained Quick
Add and manual task creation - established AI-recommends/user-decides
behaviour - established responsive cloud web architecture - added user
accounts and cross-device persistence to the production architecture -
separated intelligent planning, integrations, and commercial features
into later phases - moved technical prototype/assessment history out of
the main product specification - added measurable acceptance criteria to
each development phase

------------------------------------------------------------------------

**End of TaskMaster PRD v2.0**
