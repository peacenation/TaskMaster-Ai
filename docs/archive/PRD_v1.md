> # ⚠️ SUPERSEDED — ARCHIVED DOCUMENT
>
> **This is TaskMaster PRD v1. It is no longer the specification and must not be
> used as a build target.**
>
> Superseded by **[`../PRD_v2.md`](../PRD_v2.md)** (v2.0),
> which is the authoritative source of truth for scope, priorities, architecture
> and acceptance criteria.
>
> **Why it was archived.** This document gives architecture instructions that
> directly contradict v2.0:
>
> | Topic | v1 (this document) | v2.0 (authoritative) |
> |---|---|---|
> | Architecture | Local prototype (§23.4) | Cloud web app (§1.8) |
> | User accounts | "Not required" (§23.4) | **P0** (§2.2) |
> | Database | "A database is **not** required" (§23.4) | **P0** — cloud persistence (§2.2) |
> | Cross-device | Not addressed | **P0** (§2.2) |
> | Storage | localStorage | Relational cloud database |
> | Acceptance criteria | C1–C11 (11 items, §23.3) | 22 items (§2.10), plus per-phase sets |
>
> Building from this document would fail 4 of v2.0's 22 acceptance criteria on
> day one.
>
> **What is still worth keeping.** §1–§22 remain a good record of product
> thinking — vision, principles, the 49-feature catalogue, responsibility areas,
> free-vs-premium positioning, and the "what TaskMaster should avoid becoming"
> constraints. Most of that substance was carried forward into v2.0. Read it for
> context; do not quote it as a requirement.
>
> §23 additionally records a prior AI Foundry Lesson 6 assessment scope. That
> was a deliberately narrowed prototype exercise, not the product roadmap.
>
> Archived per decision D1 in
> [`../IMPLEMENTATION_PLAN.md`](../IMPLEMENTATION_PLAN.md) §1.2.

---

# **TaskMaster — Product Requirements Document**

## **1\. Product Overview**

**Product Name:** TaskMaster

**Product Type:** AI-powered personal productivity and planning application

**Primary Audience:** Busy individuals managing multiple responsibilities, goals, projects, routines, and personal commitments.

### **Product Vision**

TaskMaster helps people turn mental clutter into clear action.

Users can give TaskMaster messy thoughts, responsibilities, goals, ideas, deadlines, and tasks in natural language. TaskMaster organises that information into a realistic plan, identifies what matters most, and helps the user work through it until completion.

The product should reduce the amount of time users spend deciding:

* What do I need to do?  
* What matters most?  
* What should I work on now?  
* How does this fit into everything else?  
* What should I postpone?  
* What should I stop doing?  
* Am I actually making progress?

TaskMaster should behave like an intelligent personal productivity partner rather than simply another task list.

---

# **2\. Core Product Promise**

TaskMaster turns:

**Messy Thoughts → Organised Projects → Prioritised Actions → Practical Plan → Focus → Completion**

The user should be able to move from feeling overwhelmed to knowing exactly what to do next.

---

# **3\. Product Principles**

## **3.1 Reduce Mental Load**

The user should not need to manually organise every thought before entering it into TaskMaster.

TaskMaster should do as much organisational work as possible.

## **3.2 User Always Decides**

TaskMaster can recommend, challenge, prioritise, and reorganise, but important decisions remain with the user.

The product should **challenge, not control**.

## **3.3 Action Over Administration**

TaskMaster should minimise the amount of productivity-system maintenance required from users.

Users should spend more time completing work than managing TaskMaster.

## **3.4 Realistic Planning**

TaskMaster should consider limited time, changing priorities, deadlines, energy, and unexpected interruptions.

The goal is not to produce an ideal schedule. The goal is to produce a plan the user can realistically follow.

## **3.5 Explain Recommendations**

When TaskMaster makes an important recommendation, the user should be able to understand why.

Explanations should be short by default.

## **3.6 Flexible Rather Than Rigid**

Different users and different days require different planning styles.

TaskMaster should support structure without forcing the user into a single productivity methodology.

---

# **4\. Target User**

TaskMaster is initially designed for **busy individuals**.

Typical users may be balancing several areas of life simultaneously, including:

* work  
* family  
* personal goals  
* household responsibilities  
* appointments  
* finances  
* health  
* side projects  
* learning  
* errands  
* ideas  
* recurring responsibilities

Their primary problem is not necessarily knowing how to create a task.

Their problem is deciding what deserves their attention among everything competing for it.

---

# **5\. Primary User Problem**

Users frequently have more commitments than they can comfortably hold in their heads.

Information may exist across:

* memory  
* notes  
* messages  
* emails  
* calendars  
* task lists  
* unfinished projects  
* personal goals

This leads to:

* overwhelm  
* forgotten commitments  
* poor prioritisation  
* procrastination  
* unrealistic daily plans  
* excessive task switching  
* neglected long-term goals  
* difficulty deciding what to do next

TaskMaster should reduce those problems by continuously turning commitments into clear, realistic actions.

---

# **6\. Core User Journey**

## **Stage 1 — Capture**

The user enters everything that is on their mind.

They should not need to organise it first.

## **Stage 2 — Understand**

TaskMaster identifies:

* tasks  
* projects  
* goals  
* deadlines  
* responsibilities  
* priorities  
* ideas  
* notes  
* recurring commitments

## **Stage 3 — Organise**

TaskMaster groups related work into projects and responsibilities.

## **Stage 4 — Break Down**

Large or unclear tasks are turned into smaller actionable steps.

## **Stage 5 — Prioritise**

TaskMaster evaluates what matters most based on:

* urgency  
* importance  
* deadlines  
* dependencies  
* available time  
* estimated effort  
* user priorities  
* current energy  
* broader goals

## **Stage 6 — Plan**

TaskMaster creates a practical plan.

The plan may be:

* flexible and priority-based  
* time-scheduled

## **Stage 7 — Focus**

TaskMaster helps the user concentrate on the most useful next action.

## **Stage 8 — Adapt**

When circumstances change, TaskMaster helps the user reorganise the plan.

## **Stage 9 — Review**

TaskMaster helps the user understand progress, missed commitments, behavioural patterns, and goal alignment.

---

# **7\. Complete Feature List**

# **CORE FEATURES**

These features represent the main TaskMaster experience and should deliver the core product promise.

---

## **7.1 Brain Dump**

Users can freely type or speak everything currently on their mind.

They should be able to include tasks, concerns, responsibilities, ideas, goals, reminders, and incomplete thoughts in one input.

TaskMaster then converts that information into structured, actionable work.

### **TaskMaster should identify:**

* tasks  
* projects  
* goals  
* deadlines  
* priorities  
* responsibilities  
* ideas  
* notes  
* recurring activities

The Brain Dump should be one of the fastest ways to experience the value of TaskMaster.

---

## **7.2 AI Task Identification**

TaskMaster automatically detects actionable items from unstructured input.

For example:

“I need to renew the insurance before Friday, sort the spare room sometime, and start planning Mum's birthday.”

TaskMaster should recognise these as separate commitments rather than requiring the user to enter each one manually.

---

## **7.3 Automatic Project Organisation**

Related tasks should be grouped into projects.

TaskMaster should be capable of identifying when multiple actions belong to a larger outcome.

Users can adjust the suggested structure whenever necessary.

---

## **7.4 Deadline Detection**

TaskMaster identifies dates, time-sensitive commitments, and implied deadlines from user input.

The user should be able to correct or confirm deadlines.

---

## **7.5 Intelligent Prioritisation**

TaskMaster should determine relative priority using multiple signals rather than a single priority label.

Relevant factors include:

* urgency  
* importance  
* deadlines  
* task dependencies  
* impact  
* available time  
* user goals  
* effort  
* current circumstances

---

## **7.6 Urgent vs Important Classification**

Tasks can be understood as:

* urgent and important  
* important but not urgent  
* urgent but less important  
* neither urgent nor important

TaskMaster should use this distinction when recommending work.

Important long-term work should not automatically lose to every urgent task.

---

## **7.7 Task Breakdown**

Large, vague, or intimidating tasks can be broken into smaller actions.

Example:

“Prepare annual tax return”

could become:

* gather income documents  
* collect expense records  
* review missing information  
* complete tax return  
* submit return  
* save confirmation

Task breakdown should be especially important when a user is procrastinating.

---

## **7.8 Next Best Action**

TaskMaster should continuously help answer:

**“What should I do next?”**

Recommendations should consider:

* importance  
* urgency  
* deadline proximity  
* dependencies  
* available time  
* task duration  
* current energy  
* broader priorities

TaskMaster should briefly explain its recommendation.

Example:

“Finish the proposal next because it is due tomorrow and two other tasks depend on it.”

---

## **7.9 Available Time Awareness**

Users can tell TaskMaster how much time they currently have.

TaskMaster should recommend work that realistically fits that window.

A 15-minute window should produce different recommendations from a two-hour focus period.

---

## **7.10 Energy-Aware Planning**

Users can indicate their current energy level.

TaskMaster should account for whether the user has:

* low energy  
* moderate energy  
* high energy

Low-energy periods may be better suited to simple administrative work.

High-energy periods may be better suited to demanding or creative work.

---

## **7.11 Flexible Planning Mode**

TaskMaster provides a prioritised sequence of work without assigning every item to a specific time.

This mode is useful for users whose days are unpredictable.

---

## **7.12 Scheduled Day Mode**

TaskMaster can create a time-based plan for the user's day.

The schedule should account for realistic task duration and avoid filling every available minute.

Users should be able to switch between Flexible Plan and Scheduled Day.

---

## **7.13 Daily Plan**

TaskMaster creates a manageable daily plan from the user's priorities and commitments.

The daily plan should answer:

* what matters today?  
* what should happen first?  
* what can wait?  
* what can realistically be completed?

---

## **7.14 Planning Horizons**

Users can view their commitments across:

* Today  
* This Week  
* This Month  
* Longer-Term Goals

These horizons should remain connected.

Today's actions should contribute to weekly priorities and longer-term goals wherever possible.

---

## **7.15 Capacity Awareness**

TaskMaster should recognise when the user is attempting to take on more work than available time allows.

Instead of simply accepting an overloaded plan, it should point out the conflict.

Example:

“You currently have around 11 hours of work planned for a day with 6 available hours.”

---

## **7.16 Reality Check**

When a plan is unrealistic, TaskMaster should challenge the user constructively.

It may suggest:

* postponing something  
* reducing scope  
* simplifying work  
* delegating  
* dropping a commitment

TaskMaster should explain the trade-off.

The user always makes the final decision.

---

## **7.17 Recovery Check-In**

When work has been missed or delayed, TaskMaster should not silently rearrange everything.

Instead it should ask the user what should happen to affected items.

Key options:

* Keep  
* Postpone  
* Drop

TaskMaster then rebuilds the plan based on those choices.

---

## **7.18 Focus Mode**

Focus Mode helps users concentrate on completing work rather than continually reconsidering their plan.

The primary experience should show:

* one main task  
* the immediate action required  
* essential context  
* optional focus timer  
* progress

The wider backlog should remain out of the way unless requested.

---

## **7.19 Procrastination Assist**

TaskMaster should recognise behavioural signals such as:

* repeatedly postponing the same task  
* repeatedly rescheduling work  
* opening a task without completing it  
* continually avoiding one project

When this happens, TaskMaster can ask what is blocking progress.

Potential responses include:

* break the task into smaller steps  
* clarify the next action  
* reduce the scope  
* schedule it differently  
* reconsider its priority  
* remove it entirely

---

## **7.20 Goals**

Users can create larger outcomes such as:

* launch a business  
* lose weight  
* save £10,000  
* change career  
* complete a qualification

TaskMaster should turn broad goals into manageable progress.

---

## **7.21 Goal Breakdown**

Goals can be divided into:

* milestones  
* projects  
* actions

TaskMaster should connect everyday work to those larger outcomes.

---

## **7.22 Goal Alignment Check**

TaskMaster should periodically evaluate whether the user's actual tasks are moving important goals forward.

It should be able to identify when low-value maintenance work is crowding out meaningful progress.

---

## **7.23 Recurring Responsibilities**

TaskMaster supports responsibilities that repeatedly return.

Examples include:

* paying bills  
* household cleaning  
* exercise  
* weekly reporting  
* budgeting  
* maintenance  
* regular appointments

These should not overwhelm the user's ordinary task list.

---

## **7.24 Responsibility Areas**

Users may organise recurring responsibilities around areas such as:

* Work  
* Health  
* Family  
* Home  
* Finances  
* Personal Development

These areas help TaskMaster understand how attention is distributed across the user's life.

---

## **7.25 Habits**

Habits should be treated separately from one-off or recurring tasks.

Examples:

* walk for 30 minutes  
* read every evening  
* meditate  
* exercise three times per week

Habit progress should focus on consistency rather than task completion alone.

---

## **7.26 Quick Capture Inbox**

Users should have a universal Inbox where anything can be captured immediately.

Users should not need to decide where an item belongs before saving it.

TaskMaster can help organise Inbox items afterward.

---

## **7.27 Notes & Ideas**

TaskMaster should provide a lightweight place to store:

* ideas  
* observations  
* reference notes  
* thoughts  
* future possibilities

Not every thought should automatically become a task.

TaskMaster may suggest converting appropriate notes into:

* tasks  
* projects  
* goals

---

## **7.28 Task Duration Estimation**

TaskMaster should estimate how long a task is likely to take.

Users can correct the estimate.

Over time, TaskMaster should improve its estimates based on the user's actual completion patterns.

---

## **7.29 Daily Review**

The Daily Review should focus on execution.

It may cover:

* what was completed  
* what was missed  
* what changed  
* what should carry forward  
* whether the day was realistic

The review should remain quick.

---

## **7.30 Weekly Review**

The Weekly Review should focus on direction.

It may include:

* progress toward goals  
* neglected priorities  
* important upcoming deadlines  
* recurring bottlenecks  
* postponed work  
* workload balance  
* priorities for the next week

---

## **7.31 Explain My Plan**

Users should be able to understand why TaskMaster made important recommendations.

Examples:

* why one task was prioritised  
* why a task was moved  
* why the plan is considered overloaded  
* why a specific action is recommended next

Explanations should be concise by default.

---

# **SUPPORTING FEATURES**

These features strengthen the core experience without defining the main product proposition.

---

## **7.32 Adaptive Planning**

TaskMaster should learn how the user prefers to work.

It may gradually recognise:

* preferred working times  
* high-energy periods  
* low-energy periods  
* typical availability  
* recurring routines  
* work patterns

These patterns should improve recommendations without creating a rigid schedule.

---

## **7.33 Personal Productivity Insights**

TaskMaster should identify useful behavioural patterns over time.

Examples:

* tasks frequently postponed  
* projects consistently underestimated  
* days routinely overloaded  
* common procrastination patterns  
* goals receiving too little attention  
* work types completed most successfully at certain times

Insights should lead to an actionable suggestion rather than simply presenting statistics.

---

## **7.34 Workload Optimiser**

TaskMaster should identify work that may no longer justify the user's time.

It can suggest considering whether an item should be:

* dropped  
* delegated  
* simplified  
* postponed

The user decides what happens.

---

## **7.35 Lightweight Delegation**

Users can assign responsibility for a task to another person.

The initial experience should remain simple rather than becoming a full team project-management tool.

---

## **7.36 Waiting On**

Users should be able to track things they are waiting for from other people.

The user can see:

* who owns the next action  
* what they are waiting for  
* when they expected it  
* whether follow-up may be needed

---

## **7.37 Accountability Check-Ins**

TaskMaster can periodically check on meaningful commitments.

Examples:

* “You planned to finish this today. Is it still a priority?”  
* “This goal hasn't moved for two weeks. Do you want to adjust the plan?”

Check-ins should feel useful rather than nagging.

---

## **7.38 Progress Encouragement**

TaskMaster can acknowledge meaningful progress.

The emphasis should be on genuine completion and progress rather than excessive praise, badges, or artificial gamification.

---

## **7.39 Reminder Preferences**

Users should be able to choose how actively TaskMaster contacts them.

Suggested modes:

### **Minimal**

Only important reminders and planning prompts.

### **Active Coaching**

More frequent prompts, accountability, and planning support.

### **Custom**

The user chooses exactly which reminders they want.

Minimal should be the default.

---

## **7.40 Smart Notifications**

Potential notifications include:

* important upcoming deadlines  
* daily plan ready  
* focus session approaching  
* plan needs attention  
* task is at risk  
* weekly review available

Notifications should be selective.

TaskMaster should avoid becoming another source of distraction.

---

## **7.41 Manual Capture First**

The initial TaskMaster experience should allow users to manually enter all commitments.

The core experience must remain useful even without external integrations.

---

# **PREMIUM FEATURES**

Premium features should primarily provide **automation, convenience, deeper intelligence, and reduced manual effort**.

The free experience should still demonstrate the complete core value of TaskMaster.

---

## **7.42 Calendar Integration**

Premium users can connect their calendar.

TaskMaster may use calendar information to understand:

* meetings  
* appointments  
* blocked time  
* availability  
* upcoming commitments

This should improve the realism of daily planning.

---

## **7.43 Email Integration**

Premium users can connect email.

TaskMaster may help identify:

* commitments  
* deadlines  
* follow-ups  
* tasks  
* requests  
* important unanswered messages

Users should remain in control over what becomes part of their plan.

---

## **7.44 Automatic Commitment Capture**

With integrations enabled, TaskMaster can reduce manual entry by recognising commitments from connected sources.

The user should be able to review or correct imported items.

---

## **7.45 Advanced AI Planning**

Premium users may receive more sophisticated planning support across:

* larger workloads  
* longer planning horizons  
* complex competing priorities  
* multiple projects  
* changing schedules

---

## **7.46 Advanced Productivity Insights**

Premium users can receive deeper analysis of:

* workload patterns  
* planning accuracy  
* procrastination patterns  
* capacity  
* goal allocation  
* recurring bottlenecks  
* behavioural trends

Insights should still remain practical and understandable.

---

## **7.47 Advanced Automation**

Premium users may receive additional automation around recurring planning and routine administrative organisation.

The focus should be on saving time rather than adding complexity.

---

## **7.48 Expanded History**

Premium users may have access to deeper historical productivity information and longer-term progress patterns.

---

## **7.49 Enhanced Collaboration**

If collaboration expands later, more advanced delegation and shared responsibility features could become part of the premium offering.

TaskMaster should avoid becoming a full enterprise project-management system unless the product strategy changes significantly.

---

# **8\. Free vs Premium Model**

## **Free/Core Experience**

The free version should provide enough value for users to genuinely organise their life and execute their plans.

Recommended free capabilities include:

* Brain Dump  
* task extraction  
* project organisation  
* priorities  
* deadline detection  
* task breakdown  
* Next Best Action  
* daily planning  
* flexible planning  
* scheduled planning  
* Focus Mode  
* basic reviews  
* habits  
* goals  
* recurring responsibilities  
* Inbox  
* Notes & Ideas  
* basic insights  
* task duration estimates  
* basic workload awareness

## **Premium Experience**

Premium should primarily answer:

**“How can TaskMaster do more of this automatically for me?”**

Premium areas include:

* calendar integration  
* email integration  
* automatic commitment capture  
* advanced AI planning  
* deeper insights  
* advanced automation  
* expanded history  
* enhanced collaboration

---

# **9\. Onboarding Experience**

TaskMaster onboarding should be **fast and outcome-driven**.

The user should experience value before being asked to configure many preferences.

## **Recommended Flow**

### **Step 1 — Simple Introduction**

Explain the core promise briefly:

“Tell TaskMaster everything that's on your mind. We'll help organise it and create a practical plan.”

### **Step 2 — Brain Dump**

The user immediately enters their current thoughts and commitments.

### **Step 3 — TaskMaster Organises It**

TaskMaster identifies:

* tasks  
* projects  
* deadlines  
* goals  
* priorities

### **Step 4 — Clarifying Questions**

TaskMaster asks only questions that materially improve the plan.

For example:

“Which is more important this week: finishing the proposal or preparing the presentation?”

### **Step 5 — First Plan**

TaskMaster creates the user's first practical plan.

### **Step 6 — Start Focus**

The user can immediately begin their recommended next action.

### **Step 7 — Gradual Personalisation**

TaskMaster learns more over time through normal usage rather than requiring extensive setup.

---

# **10\. AI Interaction Model**

TaskMaster should combine automation with selective questioning.

## **When TaskMaster is confident**

It should organise and recommend without asking unnecessary questions.

## **When uncertainty matters**

TaskMaster should ask a concise clarifying question.

Questions should only be asked when the answer could materially change the plan.

---

# **11\. AI Behaviour Principles**

TaskMaster should:

* organise proactively  
* avoid overwhelming the user  
* explain important recommendations  
* recognise uncertainty  
* ask useful questions  
* adapt to user corrections  
* respect final user decisions  
* challenge unrealistic plans  
* avoid automatically deleting important commitments  
* encourage realistic workloads  
* help users focus on outcomes rather than activity

---

# **12\. User Control**

Users should always be able to:

* change priorities  
* modify deadlines  
* reorganise projects  
* change task durations  
* override recommendations  
* postpone work  
* drop work  
* change planning mode  
* adjust TaskMaster's level of coaching

TaskMaster should learn from these corrections where appropriate.

---

# **13\. Product Differentiation**

TaskMaster should differentiate itself from traditional task managers by focusing less on storage and more on **decision-making**.

Traditional task managers answer:

“What tasks have I entered?”

TaskMaster should answer:

* What actually matters?  
* What should I do now?  
* Is this workload realistic?  
* What am I neglecting?  
* What should I postpone?  
* What could I stop doing?  
* Why am I avoiding this?  
* How do today's actions connect to my goals?  
* How should I recover when my plan falls apart?

---

# **14\. Primary Product Experiences**

The product should revolve around a small number of recognisable experiences.

## **Capture**

Get thoughts out of the user's head quickly.

## **Plan**

Turn those thoughts into an achievable course of action.

## **Focus**

Help the user execute one useful action at a time.

## **Recover**

Help the user adjust when reality disrupts the plan.

## **Review**

Help the user learn from what happened.

## **Improve**

Use behaviour and preferences to make future planning more realistic.

---

# **15\. Suggested Main Areas of the Product**

A simple product structure could include:

### **Today**

The immediate daily plan and current priorities.

### **Inbox**

Unprocessed thoughts, ideas, and tasks.

### **Projects**

Multi-step outcomes and related tasks.

### **Goals**

Longer-term outcomes and milestones.

### **Habits**

Repeatable behaviours.

### **Responsibilities**

Ongoing areas of life and recurring commitments.

### **Notes & Ideas**

Non-actionable information and future possibilities.

### **Reviews**

Daily and weekly reflection.

### **Insights**

Useful patterns and personalised recommendations.

---

# **16\. MVP Priorities**

TaskMaster should avoid launching with unnecessary complexity.

The first version should prove the central product hypothesis:

**Will users trust TaskMaster to turn an unstructured workload into a practical plan and help them decide what to do next?**

## **Highest-Priority MVP Features**

1. Brain Dump  
2. AI task identification  
3. deadline detection  
4. automatic project grouping  
5. task breakdown  
6. intelligent prioritisation  
7. Next Best Action  
8. daily planning  
9. flexible and scheduled plan views  
10. available-time awareness  
11. basic energy awareness  
12. Focus Mode  
13. Recovery Check-In  
14. Inbox  
15. goals  
16. recurring responsibilities  
17. basic daily and weekly reviews  
18. explainable recommendations  
19. workload Reality Check  
20. simple Notes & Ideas

---

# **17\. Features That Can Follow the MVP**

Once the central planning experience is validated, TaskMaster can deepen:

* habits  
* personalised productivity insights  
* procrastination detection  
* adaptive routines  
* detailed goal alignment  
* delegation  
* Waiting On tracking  
* advanced coaching  
* advanced workload optimisation

Premium integrations can then significantly expand automation.

---

# **18\. What TaskMaster Should Avoid Becoming**

TaskMaster should not initially become:

* a complicated enterprise project-management suite  
* a social productivity network  
* a heavily gamified habit app  
* an endless analytics dashboard  
* a calendar replacement  
* a note-taking system with hundreds of organisational options  
* an AI assistant that changes important commitments without user approval

Its strongest value proposition is **clarity and action**.

---

# **19\. Key Product Success Measures**

Product success should be evaluated around whether users become more capable of moving from intention to completion.

Important outcomes include:

* users regularly completing Brain Dumps  
* users accepting or adjusting generated plans  
* users starting recommended Next Best Actions  
* increased task completion  
* fewer repeatedly postponed tasks  
* improved completion of important goals  
* reduced daily over-planning  
* repeated use of Daily Plan  
* repeated use of Focus Mode  
* consistent Daily and Weekly Reviews  
* users returning because TaskMaster reduces planning effort

---

# **20\. Example User Experience**

A user opens TaskMaster and says:

“I've got loads going on. I need to finish the quarterly report by Thursday, book the dentist, start sorting the garage, go to the gym three times this week, call Mum, renew my car insurance before the end of the month, and I really need to start working on my side business again.”

TaskMaster identifies and organises this into:

### **Work Project**

Quarterly Report

* gather missing figures  
* draft report  
* review report  
* submit by Thursday

### **Personal Admin**

* book dentist  
* renew car insurance

### **Home**

Garage organisation project

### **Health**

Gym habit — 3 sessions this week

### **Family**

Call Mum

### **Goal**

Develop side business

TaskMaster might then say:

“You have several commitments, but the quarterly report has the closest important deadline. I recommend spending your next focused session on gathering the missing figures.

You also haven't allocated time to your side business recently. I've protected one session later this week so urgent work doesn't completely replace your longer-term goal.”

If the user only has 20 minutes and low energy, TaskMaster might instead suggest:

“You don't currently have enough time for meaningful progress on the report. Book the dentist now, then return to the report during your next longer focus period.”

This is the core TaskMaster experience.

---

# **21\. Product Positioning**

### **Short Positioning Statement**

**TaskMaster turns everything on your mind into a clear, realistic plan and helps you focus on what matters next.**

### **Longer Positioning Statement**

TaskMaster is an intelligent productivity system for busy people who have too much competing for their attention. Users can unload their tasks, goals, responsibilities, deadlines, and ideas in their own words. TaskMaster organises the mess, creates a realistic plan, recommends what to focus on next, and continuously helps the user adapt until the work gets done.

---

# **22\. North Star**

TaskMaster should aim to create one recurring feeling for the user:

**“I know what matters, I know what to do next, and I trust that everything else is under control.”**

The strongest next step would be turning this PRD into a **prioritised MVP roadmap with Version 1, Version 1.5, and Version 2 features**, so the scope stays realistic rather than trying to build the whole vision at once.

---

# **23\. AI Foundry Lesson 6 — Prototype Implementation**

> This section documents the Lesson 6 assessment scope. It **narrows** the full TaskMaster roadmap to a focused working local prototype; it does **not** replace the product vision, principles, feature catalogue, or MVPs defined above. Sections 1–22 of this PRD remain the source of truth for TaskMaster.

## **23.1 Assessment Prototype Objective**

Lesson 6 (*Full Stack Features and Data*) takes the existing TaskMaster product plan and turns it into a working local prototype built with an AI coding tool.

The prototype demonstrates the central TaskMaster value proposition already defined in this PRD:

**Messy Thoughts → Organised Projects → Prioritised Actions → Practical Plan → Focus → Completion**

It answers the central TaskMaster question: **"What should I do next, and why?"**

The prototype is a focused slice of the product — not the full V1 roadmap (PRD §16) and not the wider commercial roadmap (PRD §22, §16–§17). Success is measured by whether a user can move from an unstructured brain dump to a recommended, explainable next action and complete it.

## **23.2 Prototype Scope**

### Features included in this prototype

| Feature | PRD reference | Notes |
|---|---|---|
| Brain Dump free-text entry | §7.1 | Paste unstructured thoughts; confirm before commit |
| AI/heuristic task identification | §7.2 | LLM optional; local heuristic fallback always works |
| Basic deadline detection | §7.4 | Natural-language dates, correctable at review |
| Automatic project grouping | §7.3 | Suggested grouping, user-adjustable |
| Intelligent prioritisation | §7.5–§7.6 | Multi-signal scoring + urgent/important reasoning |
| Daily plan — flexible & scheduled views | §7.11–§7.13 | Toggle between both modes |
| Next Best Action + short reason | §7.8, §7.31 | Plain-English "why" |
| Focus Mode | §7.18 | Single task, timer, complete/postpone |
| Basic Recovery Check-In | §7.17 | Keep / Postpone / Drop on unfinished work |
| Inbox + Sample data | §7.26, §9 | Quick capture + demo plan |
| Simple Notes & Ideas | §7.27 | Lightweight storage |

### Features deferred to later phases (not required for Lesson 6)

Calendar integration, email integration, automatic commitment capture, collaboration/multi-user, advanced analytics & productivity insights, billing/premium, habits, delegation, Waiting On, smart notifications & reminders, accountability check-ins, advanced automation, expanded history, workload optimiser. These remain roadmap items (§17, §7.32–§7.49, §8) and are out of scope for the Lesson 6 prototype.

### Core user journey demonstrated

1. User pastes a messy brain dump (§20 example).
2. TaskMaster identifies tasks, deadlines, projects, goals, notes.
3. User confirms/corrects the structure.
4. TaskMaster prioritises and builds a practical daily plan.
5. TaskMaster recommends the **Next Best Action** and explains **why**.
6. User completes the task; progress updates.

## **23.3 Prototype Success Criteria**

Measurable acceptance criteria — verified in **Phase 4** (Section 23.5). A "Verification" column is completed during testing; nothing is pre-marked as passed.

| # | Acceptance criterion | How to verify | Verification |
|---|---|---|---|
| C1 | User can enter a Brain Dump | Paste text; submission succeeds | ☐ |
| C2 | Brain Dump produces structured tasks | Review screen lists individual tasks, not one blob | ☐ |
| C3 | Deadlines can be represented | "…by Friday" → a date shown on the task; editable | ☐ |
| C4 | Tasks can be grouped into projects | Related tasks appear under suggested projects | ☐ |
| C5 | Priorities can be displayed | Tasks show priority/urgency signals or a ranking | ☐ |
| C6 | Today's Focus / Focus Mode is shown | Single-task focus view reachable | ☐ |
| C7 | Next Best Action is clearly displayed | Prominent NBA card on Today | ☐ |
| C8 | Recommendation includes a short reason | NBA shows why (reason chips/sentence) | ☐ |
| C9 | User can complete a task | Complete action exists and works | ☐ |
| C10 | Progress changes after completion | Completed task leaves the open plan; counts update | ☐ |
| C11 | App fully works without an API key | Heuristic fallback path (PRD §7.41) verified end-to-end | ☐ |

## **23.4 Technical Implementation Review**

> Written from direct inspection of the current repository (git commit `7a5d079` "Initial version: TaskMaster V1", plus session additions). Nothing is assumed beyond what exists in the code.

### Framework

**Next.js 16.3.5 (App Router, Turbopack) + React 19.2.8 + TypeScript + Tailwind CSS v4.**

Appropriate because the app is a thin client over a local domain model: pages are lightweight views over a reducer store, server API routes exist only as AI proxies, most routes are statically prerendered, and the whole thing runs locally with `npm run dev`.

### Application structure

- `src/app/` — client routes: `/` (Today), `/inbox`, `/projects`, `/goals`, `/more`, `/design` (living design showcase); API routes `/api/extract` and `/api/breakdown`.
- `src/lib/` — domain logic: `types.ts`, `store.tsx` (reducer + Context), `storage.ts`, `id.ts`, `dates.ts` (deadline parsing), `extract.ts` (heuristic extractor), `ai.ts` (OpenAI-compatible client), `prioritize.ts` (scoring engine), `plan.ts` (daily planner), `breakdown.ts`, `sample.ts`, `events.ts`.
- `src/components/` — `Shell.tsx`, `TaskRow.tsx`, `FocusMode.tsx`, `BreakdownModal.tsx`, `ui.tsx`.

### Dependencies

- **Runtime:** `next` 16.3.5, `react` 19.2.8, `react-dom`, `lucide-react`.
- **Dev:** `typescript`, `eslint`, `eslint-config-next`, `tailwindcss` v4, `@tailwindcss/postcss`.
- **No test runner installed** — none of `dates.ts`, `extract.ts`, `prioritize.ts`, `plan.ts` has automated tests.

### Database / persistence

**localStorage, via a React reducer + Context store (`store.tsx` + `storage.ts`). No database server.**

A database is **not required** for the Lesson 6 prototype: the product is single-user and browser-resident, and PRD §7.41 (Manual Capture First) and §8 position the free experience as account-free. A Postgres database (e.g. Supabase/Neon) remains a roadmap decision for when accounts, sync, or multi-device support arrive — not for this prototype.

### Authentication

**None.** Not required — the prototype stores no data outside the browser and has no backend that holds user data. The only server routes are stateless AI proxies. Adding auth is a product-level decision tied to accounts, which is out of prototype scope.

### File storage

**None.** Not required — the prototype scope has no user uploads, attachments, or media. If image/file attachments become a feature, object storage (e.g. S3-compatible) would be evaluated then.

### AI integration

**Optional, OpenAI-compatible, with a zero-setup local fallback.** The `/api/extract` route proxies to an LLM via `ai.ts` (env: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `AI_MODEL`); `/api/breakdown` does the same for task steps. When no key is set, the UI silently uses the local heuristic extractor (`extract.ts`) and local splitter (`breakdown.ts`), so the prototype is **fully functional with zero configuration** (PRD §7.41). No API keys or credentials are committed.

## **23.5 Implementation Phases**

These phases describe the **Lesson 6 assessment workflow** only — they are distinct from the TaskMaster commercial roadmap (§22, §16–§17).

| Phase | Focus | Outcome |
|---|---|---|
| **Phase 1 — Review** | Review PRD (§1–§22) and the existing implementation plan and code (`IMPLEMENTATION_PLAN.md`, repo audit) | Confirmed scope, confirmed architecture (this section) |
| **Phase 2 — Design** | Produce/refine visual design; Product Owner design review (§23.7) | Approved design direction + recorded refinement |
| **Phase 3 — Build** | Harden the core prototype: fix audited gaps, add test harness, close the 4 partial features (§16: #10, #12, #17, #19) relevant to the core journey | Working local prototype |
| **Phase 4 — Test** | Verify against §23.3 acceptance criteria (C1–C11) | Criteria sheet completed |
| **Phase 5 — Demo** | Record demo run-through; prepare Lesson 6 submission | Demo + submission |

## **23.6 Agent Steering & Changes Log**

Structured log of AI-generated decisions and Product Owner changes. Only actual decisions are recorded; nothing is fabricated.

### Change 001 — Lesson 6 prototype scope narrowing

**AI Agent Original Proposal:** Implement the full commercial V1 build plan (`IMPLEMENTATION_PLAN.md`, milestones M0–M5, ~90–130 hours) covering the entire V1 MVP roadmap in PRD §16.

**Product Owner Decision:** Narrow Lesson 6 work to a focused working prototype that demonstrates only the central capture → organise → prioritise → plan → focus → complete journey, deferring everything else.

**Reason:** Lesson 6 is a course assessment requiring a working local prototype of the product's core promise — **"What should I do next, and why?"** — not a full product build. The PRD remains the source of truth; the prototype proves the central hypothesis (PRD §16).

**Implementation Impact:** Only the core journey is implemented/verified for the assessment. Calendar/email/collaboration/analytics/billing/habits/automation and the wider §17, §8 roadmap remain deferred.

**Files Affected:** `PRD.md` (this section); future prototype code built in Phase 3.

**Status:** Approved.

### Change 002 — Reality Check keeps Postpone / Simplify / Drop suggestions

**AI Agent Original Proposal:** The audited V1 Reality Check warns when workload exceeds available time but offers only reactive controls ("I'll make time" / "Show what fits"); the audit flagged the missing reduce actions as partial MVP feature #16 §19.

**Product Owner Decision:** Keep (and harden) the Reality Check so it actively suggests **Postpone**, **Simplify** and **Drop** when the user's workload does not realistically fit.

**Reason:** TaskMaster should help the user make workload decisions, not merely tell them their workload does not fit. This supports the existing product principles of reducing overload and challenging unrealistic plans while leaving the final decision with the user (PRD §3.2, §7.16).

**Implementation Impact:** The Reality Check surface will propose concrete reduce actions with a trade-off; the user always confirms before any change. Build in Phase 3.

**Files Affected:** *Future* — `src/app/page.tsx` (Reality Check UI), `src/lib/plan.ts` (capacity logic), `src/lib/store.tsx` (reduce actions).

**Status:** Approved (scheduled: Phase 3).

### Change 003 — Add Vitest with a small focused golden-test set

**AI Agent Original Proposal:** The commercial implementation plan called for per-milestone unit tests; the audit found zero test coverage in the repository, including no test runner.

**Product Owner Decision:** Add **Vitest** during the implementation phase and create a small, focused set of golden tests for the core pure planning logic. Priorities: date handling / next-weekday logic, recurring interval handling, planning capacity, prioritisation, and Next Best Action where appropriate. **Do not** build a large test suite for this assessment.

**Reason:** Evidence that the core planning logic works — particularly where defects were already identified — without expanding the assessment into a full testing project.

**Implementation Impact:** Add `vitest` as a dev dependency and a small `*.test.ts` set covering the identified logic. Build in Phase 3, run in Phase 4.

**Files Affected:** *Future* — `package.json`, focused tests near `src/lib/dates.ts`, `src/lib/plan.ts`, `src/lib/prioritize.ts`.

**Status:** Approved (scheduled: Phase 3).

### Change 004 — Keep the `/design` showcase page for the prototype

**AI Agent Original Proposal:** Offered to keep the `/design` living styleguide as a permanent asset or remove it once real screens shipped.

**Product Owner Decision:** **Keep** the `/design` page for the Lesson 6 prototype.

**Reason:** It provides evidence of the design-preview and refinement process required by the assessment. It can be removed or restricted later for a production release.

**Implementation Impact:** No application change required; `/design` remains as the styleguide reference for the design review (Phase 2).

**Files Affected:** `src/app/design/page.tsx` (unchanged).

**Status:** Approved (no implementation change required).

### Change 005 — Focus Mode stays intentionally simple (no breakdown inside)

**AI Agent Original Proposal:** Considered adding task-breakdown ("Create") inside Focus Mode to help when a user is procrastinating (PRD §7.7, §7.19).

**Product Owner Decision:** **Do not** add Create/task-breakdown functionality inside Focus Mode for this prototype. Focus Mode should remain intentionally simple: show the current task, allow completion, allow postponement, and help the user remain focused. Task breakdown stays elsewhere in TaskMaster (Breakdown Modal).

**Reason:** Additional planning controls inside Focus Mode increase cognitive load and conflict with TaskMaster's principle of helping the user focus on one useful action at a time (PRD §3.3, §7.18).

**Implementation Impact:** Focus Mode scope is fixed to: single current task, complete, postpone. No breakdown entry point is added within it.

**Files Affected:** *Future hardening only* — `src/components/FocusMode.tsx` unchanged in scope; no breakdown wiring.

**Status:** Approved (scheduled: Phase 3).

> Future entries will be added here as the Product Owner and AI agent make decisions during Phases 2–5. No earlier steering decisions are claimed beyond the ones documented above.

## **23.7 Design Review Record**

Placeholder section for the design review (Phase 2). A refinement will be recorded **only after** the Product Owner actually reviews the visual design and requests a change.

| Field | Record |
|---|---|
| **Initial design direction** | "Calm paper, one job at a time" — warm off-white surfaces, quiet green accent, typographic hierarchy that explains recommendations; living showcase at `/design`. See §23.4 framework note. |
| **Feedback from Product Owner** | *Pending review — Phase 2* |
| **Requested refinement** | *Pending review — Phase 2* |
| **Reason for refinement** | *Pending review — Phase 2* |
| **Resulting design changes** | *Pending review — Phase 2* |

---

*End of Section 23. This section is an assessment annex; the TaskMaster product definition remains Sections 1–22.*

