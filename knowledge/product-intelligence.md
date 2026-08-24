# Sarvam Studio Product Intelligence

> **SYNTHETIC/DEMO DATA ONLY**  
> This document is derived entirely from fictional product-usage records created for demonstration and testing. It does not describe real Sarvam Studio customers, usage, revenue, or performance.

## Snapshot context

- Dataset: 30 synthetic product signals; 10 each for creators, media agencies, and enterprises.
- Observation timestamp: `2026-08-20 19:55:37`.
- Source labels: `synthetic-demo:creator`, `synthetic-demo:media-agency`, and `synthetic-demo:enterprise`.
- Signal-strength scale: 1–5, where 5 represents the strongest individual signal.
- Coverage: signup, activation, dubbing, translation, text-to-speech, speech-to-text, project creation, repeat usage, usage intensity, and conversion.

## Executive synthesis

Across all three segments, the synthetic usage journey follows the same broad sequence: a segment-specific use case drives signup, users create a multilingual project quickly, several speech or localization capabilities are combined, repeat activity develops, and conversion follows a meaningful pilot or usage threshold. The strongest product signals are the three conversion events (5/5). Repeat usage and activation are also consistent across every segment (4/5), suggesting that first value and recurring workflow fit are the central behavioural patterns in this demo dataset.

The way value appears differs by segment. Creators focus on individual content output and watch-time potential. Agencies organize work around client campaigns, review cycles, and multiple deliverables. Enterprises concentrate usage in onboarding, compliance, customer education, and cross-department expansion.

## Creator segment

### Key observed behaviours and patterns

- Activation is fast in the example journey: a Hindi tutorial was uploaded within 20 minutes of signup.
- Usage spans the complete content workflow rather than a single feature: Tamil dubbing, Marathi caption translation, Kannada text-to-speech, and podcast speech-to-text all appear.
- Multilingual project organization is visible through a project containing Hindi, Tamil, and Telugu outputs.
- Repeat behaviour appears within days and across multiple sessions, culminating in five exports and four active days in one week.
- Conversion occurs after the creator reaches the included monthly dubbing limit, suggesting usage intensity rather than time alone drives purchase.

### Repeated signals

- Dubbing appears in both first-session activation and subsequent return usage.
- Regional-language output is repeated across multiple formats: short-form video, educational video, product review, and podcast content.
- Repeat usage is supported by both a three-day return and four revisits within one week.

### Supporting evidence

- Fast activation: uploaded a four-minute Hindi tutorial within 20 minutes. `[activation; strength 4/5; synthetic-demo:creator; 2026-08-20 19:55:37]`
- Repeat use: five exports and four active days in one week. `[repeat_usage; strength 4/5; same source/timestamp]`
- Commercial outcome: converted after reaching the monthly dubbing allowance. `[conversion; strength 5/5; same source/timestamp]`
- Workflow breadth: used dubbing, translation, text-to-speech, and speech-to-text. `[four usage signals; strength 3/5 each; same source/timestamp]`

### Contradictory evidence

No direct contradictory product behaviour is present. This is a usage-only demo sample and does not include abandoned projects, failed exports, churn, or creators who reached a limit but did not convert.

### Important unknowns

- Whether the observed first-week activity persists after one month or one quarter.
- Whether the monthly dubbing limit caused conversion or merely coincided with existing purchase intent.
- Output-quality, editing-time, and failed-generation rates.
- The share of signed-up creators who never activate or create a second project.
- Whether each capability contributes to retention or whether dubbing alone drives most value.

## Media-agency segment

### Key observed behaviours and patterns

- Activation is collaborative: the agency invites two editors and creates a client campaign immediately.
- The core workflow is campaign localization at breadth and volume—six-language advertising, multilingual scripts, voice variants, interview transcription, and 42 minutes of dubbing across nine assets.
- Project structure maps to client delivery, with separate projects for three clients and language-specific deliverables.
- Repeat usage occurs weekly for four consecutive weeks.
- Conversion follows a successful client pilot, linking purchase to demonstrated delivery value.

### Repeated signals

- Dubbing appears in both first-session activity and a high-volume campaign-launch week.
- Multi-language output recurs across advertising, scripts, and voice approvals.
- Client-oriented project organization and repeated weekly localization reinforce a workflow-level pattern rather than isolated feature use.

### Supporting evidence

- Collaborative activation: two editors invited and a campaign project created. `[activation; strength 4/5; synthetic-demo:media-agency; 2026-08-20 19:55:37]`
- Repeat adoption: weekly usage for four consecutive weeks. `[repeat_usage; strength 4/5; same source/timestamp]`
- Volume: 42 dubbing minutes across nine campaign assets. `[dubbing_usage; strength 3/5; same source/timestamp]`
- Commercial outcome: paid conversion after a successful client pilot. `[conversion; strength 5/5; same source/timestamp]`

### Contradictory evidence

No failed agency pilots, inactive invited editors, or non-converting high-volume accounts are included. The product dataset therefore supports workflow adoption but cannot establish conversion rates or collaboration quality.

### Important unknowns

- How much review, approval, and revision work happens outside Sarvam Studio.
- Whether all invited editors become active users.
- Margin and turnaround effects for high-revision client projects.
- Retention after the initial four-week campaign window.
- Whether project-level access controls and client review are sufficient for larger agencies.

## Enterprise segment

### Key observed behaviours and patterns

- Evaluation begins with a company email and a multilingual training use case.
- Activation involves five reviewers and an uploaded compliance module, indicating broader stakeholder participation than other segments.
- Usage covers onboarding, compliance, safety training, customer education, and support-call transcription.
- Daily activity for two weeks and 18 localized exports indicate the highest operational intensity in the product sample.
- A request for access by another department suggests potential account expansion.
- Conversion follows security review and a 30-day pilot rather than a simple usage limit.

### Repeated signals

- Training and compliance recur across dubbing, translation, text-to-speech, project creation, and repeat usage.
- Multi-reviewer activity appears at activation and again through 18 reviewed exports.
- The journey repeatedly links sustained pilot use with organizational expansion and eventual purchase.

### Supporting evidence

- Multi-stakeholder activation: five reviewers invited for the first compliance module. `[activation; strength 4/5; synthetic-demo:enterprise; 2026-08-20 19:55:37]`
- High-frequency adoption: daily use for two weeks. `[repeat_usage; strength 4/5; same source/timestamp]`
- Expansion indicator: 18 exports followed by an access request from another department. `[usage_intensity; strength 4/5; same source/timestamp]`
- Commercial outcome: paid conversion after security review and a 30-day pilot. `[conversion; strength 5/5; same source/timestamp]`

### Contradictory evidence

The product data contains no stalled security reviews, rejected outputs, failed pilots, or enterprises that use the product heavily but do not purchase. It therefore overrepresents successful progression.

### Important unknowns

- Security, governance, data-residency, and procurement requirements encountered during the pilot.
- The accuracy threshold needed for compliance and technical terminology.
- Time from initial evaluation to contract signature.
- Whether department expansion results in additional revenue or only more users under the same contract.
- Long-term adoption after localization backlogs are completed.

## Cross-segment changes and trends

- **Value shifts from output to workflow as account complexity rises.** Creators produce individual assets; agencies coordinate campaigns and clients; enterprises coordinate reviewers, departments, and governed content programs.
- **Conversion triggers differ.** Creator conversion follows a usage limit, agency conversion follows client proof, and enterprise conversion follows security review plus a formal pilot.
- **Repeat cadence intensifies.** Creator revisits occur several times in a week, agencies return weekly over a month, and enterprises work daily during a pilot.
- **Multimodal usage is common in the demo data.** Every segment uses dubbing, translation, text-to-speech, and speech-to-text, suggesting potential value in an integrated workflow proposition.

## Knowledge Base guidance

Treat these patterns as hypotheses grounded in synthetic behavioural examples—not measured adoption rates. An external agent should distinguish the observed demo records from assumptions about causality, retention, willingness to pay, or market size.
