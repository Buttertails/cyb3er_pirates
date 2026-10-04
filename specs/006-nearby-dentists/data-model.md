# Data model: Nearby in-network dentists

## Existing account profile

Read from the existing signed-in profile: `uid` from verified authentication,
`company` as a supported company ID, and `state`/`zip` from saved location.
The directory does not create or update account records.

## Company-plan relationship

The existing fictional company fixture identifies each company and its one
sample plan. An office lists the company-plan IDs for which it is in network.
Unknown companies have no eligible offices.

## Supported ZIP center

- `zip`: five-digit ZIP, unique within the fixture.
- `state`: valid two-letter state code consistent with the ZIP.
- `latitude`, `longitude`: finite coordinates for approximate ranking.

Only ZIPs selected from current test account areas need fixture entries.
Fixtures contain no names, emails, account IDs, or saved profile snapshots.

## Fictional office

- `id`: unique stable ASCII identifier.
- `name`: nonempty sample office name.
- `address`: nonempty display address at the map pin.
- `latitude`, `longitude`: finite map pin coordinates.
- `rating`: sample numeric rating from 0 to 5 inclusive.
- `phone`: reserved fictional US phone number for display.
- `plan_ids`: nonempty list of known fictional plan IDs.

Reject duplicate IDs, invalid coordinates, unknown plan IDs, missing display
fields, non-finite ratings, and malformed phone numbers when loading fixtures.

## Nearby result

Derived, never stored: public office fields, `distance_miles` rounded to one
decimal, and `maps_url` for the stored pin. Sort by raw distance ascending,
then office ID ascending, and return no more than five. The result does not
include a user's ZIP, email, name or account ID.

## Directory outcome

`ok`, `missing_zip`, `unsupported_zip`, `unknown_plan`, or `no_offices`.
Non-`ok` outcomes carry an empty office list and a user-facing next step.
Authentication failure and temporary server failure are separate HTTP errors.
