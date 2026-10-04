# Requirements quality checklist

- [x] Four user stories, each with an independent test and acceptance scenarios.
- [x] The 90-day boundary, window dates and the 90%-remaining threshold are exact and testable.
- [x] At most one email per campaign period is specified for overlapping and retried runs.
- [x] The two campaigns are independent (owner decision: two separate emails).
- [x] Email content excludes amounts and dental history (owner decision).
- [x] The unverified-address behavior is explicit and configurable (owner decision).
- [x] Benefit figures come from the shared calculator (constitution II).
- [x] Unknown companies are excluded instead of using fallback data (constitution III).
- [x] Scheduler identity, secrets handling and production-safe tooling are specified.
- [x] Out of scope: review records, event IDs, bounce handling, unsubscribe, repeat nudges.
