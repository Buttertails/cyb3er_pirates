# Agent pages and reusable routes

Preserve existing Start/Procedure/Network/Estimate resource IDs when compatible.
Add Menu, Priorities, Coverage, Options, Timing, Review and Benefits pages in
separate backup/diff/apply batches. Start greets once and goes to Menu; start
context fulfillment uses benefits.summary. Menu choices enter requested branch;
known values fill form steps. Estimate-only path can skip optional Priorities.

Procedure form parameter procedure_id uses existing procedure entity with
supported synonyms. Ambiguous input clarifies supported choices. Network has
in/out-network plus unsure branch that explains or compares both; it never
stores unsure as an engine enum. Priorities collects optional budget, date and
deadline with explicit skip. Coverage/Estimate show backend explanations/costs.
Options calls benefits.alternatives. Timing calls benefits.timing after collecting
permitted date/stage choices. Review provides scenario changes/restore. Benefits
shows recorded usage/timeline and returns to saved active step.

Reusable flow routes: help, menu, back, why, change procedure/network/date/budget,
show options, show timing, show usage, new case and insurance-change guidance.
Help/why/usage save return_to and return to it; menu preserves current case.
New procedure clears dependent option/stage results; new case/employee requires
confirmation and resets treatment state. Back revisits previous applicable step.

Fallback prompts name supported actions and allow retry/menu. Unsupported
procedure offers catalog choices. Plan-change questions point to HR/employer
without changing plan. Missing backend setup/service failure is surfaced honestly;
no static dollar responses, generator, invented treatment or guaranteed savings.

Remote delivery: read full agent snapshot first, preserve IDs and current team
changes, preview one batch, save restore snapshot, apply only that batch. Validate
one focused live journey before next batch. Stop/rollback the failed batch;
do not replace entire agent from the older procedure-network snapshot.
