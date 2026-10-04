# Research and decisions: Nearby in-network dentists

## Directory source

**Decision**: Use a versioned fictional office fixture and a small lookup of
supported ZIP centers. During fixture preparation, inspect only the distinct
ZIPs saved in current team test accounts; seed nearby offices for those areas,
including North Carolina when present.

**Rationale**: The app already uses fictional company plans. A curated office
list gives consistent sample network membership and predictable demo results.
It requires no provider API or new cloud resource.

**Alternatives considered**: A live directory cannot establish membership in
fictional plans. The existing frontend placeholder appends each user's
state/ZIP to generic street names and reuses fixed distances, so it cannot
support honest map links or ranking.

## Account and plan context

**Decision**: The backend route reads the authenticated account's saved company
and ZIP from its existing profile. It maps the company to its one fictional
plan and never accepts company, user, or ZIP override parameters.

**Rationale**: Results follow the current user's context and cannot be
changed by picking another demo employee or crafting a query parameter.

**Alternatives considered**: Frontend-only filtering would expose all sample
network relationships and could drift from the saved profile.

## Distance and maps

**Decision**: Rank by Haversine straight-line miles from a seeded ZIP center
to office coordinates. Keep the unrounded distance for sorting and show one
decimal place. Break equal-distance ties by stable office ID. Return a
Google Maps URL with `api=1` and an encoded `query=latitude,longitude`,
which [Google's Maps URL documentation](https://developers.google.com/maps/documentation/urls/get-started)
says opens a location pin without needing a business listing.

**Rationale**: Approximate ranking is enough for a small demo. Coordinates
make the map link land on a definite pin. The URL does not claim that a
fictional office exists as a verified business.

**Alternatives considered**: Driving distance and browser geolocation would
add paid or permission-dependent integrations. Static per-office distances
would be wrong for different users.

Use phone numbers in the 555-0100 through 555-0199 range. [NANPA's 555
reference](https://www.nanpa.com/numbering/555-line-numbers) reserves this
range for fictitious, non-working numbers.

## User interface

**Decision**: Add a Find in-network dentists action to the signed-in chat.
Render up to five cards in that chat. The onboarding office picker consumes
the same directory results after the user's location is saved, preventing
conflicting addresses.

**Rationale**: Chat-only placement matches the user's decision and uses the
existing interaction. A separate map page or profile section is unnecessary.

**Alternatives considered**: A new directory page would add navigation and
duplicate the chat's selection context. A profile-only list would miss the
requested chat experience.

## Failure behavior

**Decision**: Return explicit missing ZIP, unsupported ZIP, unknown plan, and
no matching offices states. A transient backend failure shows a retry control.
No fallback generates office names, addresses, ratings or distances.

**Rationale**: The small fixture must not masquerade as a nationwide
directory or as verified provider information.
# Seeded test areas

Read-only inspection of current test-account profiles found North Carolina ZIPs
27519, 27577, 27858, and 27863. Only ZIP, state, and company IDs were used;
no names, emails, or account IDs were retained. The approximate centers for
these four ZIP areas come from the [2026 Census ZCTA Gazetteer](https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.html).
