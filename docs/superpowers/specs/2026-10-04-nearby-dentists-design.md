# Nearby in-network dentists in chat

## Goal

Help a signed-in employee find a nearby dentist in their current company plan's
network. Show a short list in the chat, ordered by approximate distance from the
ZIP code already saved in their Firebase profile. Each result shows an office
name, rating, phone number, distance, address, and a link that opens its map
location.

## Scope and data

- Use fictional dentist offices and fictional network membership, consistent
  with the project's example company plans. Keep one plan per company.
- Seed offices around the ZIP codes already present in the team's current test
  accounts, including North Carolina ZIPs where present. Store only the ZIPs
  needed for this sample directory, not copies of user profiles. An account
  outside the seeded areas sees an honest no-results message.
- Each office record has a stable ID, display name, address, map coordinates,
  sample rating, sample phone number, and the company-plan IDs for which it is
  in network. Map links open a location pin; they do not imply a verified
  business listing. Use reserved fictional phone numbers.
- The signed-in user's saved company and ZIP determine which offices are
  eligible and how they are ranked. The user does not select another employee
  or company. A missing ZIP prompts the user to provide one through the
  existing profile/location flow.
- Approximate straight-line miles between the ZIP center and office
  coordinates are enough for this demo. Label the value as approximate; no
  browser location, driving distance, live provider directory, or paid maps
  service is required.

## Experience and data flow

1. The signed-in employee asks for nearby in-network dentists in ordinary chat
   text. Dialogflow CX recognizes this request from the current conversation
   and enters a dentist-finding branch. The separate button under the chat is
   removed.
2. The branch requests the directory for the signed-in employee and displays
   the result card in the conversation. Afterward, the employee can ask another
   benefits question without restarting the chat.
   The existing signed chat request reaches Dialogflow first; a CX intent for
   dentist lookup invokes a webhook fulfillment. Flask uses the signed session
   context to resolve the account and returns directory data in a structured
   payload. The chat API passes that payload to React for the existing result
   card. Other chat intents keep their current behavior.
3. React requests a signed-in Flask endpoint for nearby offices. Flask reads
   the caller's Firebase profile, resolves their single company plan, filters
   the curated office list by network membership, calculates approximate
   distances, and returns the closest matches in ascending order.
4. Each card shows name, sample rating, phone number, approximate miles,
   address, and **Open in Maps**. The maps URL targets the stored coordinates.
5. The chat provides clear states for missing ZIP, unsupported ZIP area, no
   in-network office, and temporary request failure. It does not invent a
   nearby office or claim that a provider's network status has been verified.

The existing onboarding office picker currently fabricates the same three
addresses and distances for every ZIP. Replace that placeholder source with
the curated office data where the new directory applies, so the chat does not
show contradictory locations. Keep the new ranked result list accessible only
in chat, as requested.

## Validation

- Backend tests cover authentication, company-plan filtering, distance order,
  unsupported and missing ZIPs, and the shape of map/phone/rating fields.
- Frontend tests cover rendering and empty/error states, and confirm that the
  action requests results for the signed-in user without a demo employee
  selector.
- A manual check with existing test accounts in the seeded ZIPs confirms the
  results appear in chat and map links open their intended coordinates.

## Limits

Office names, ratings, phone numbers, and network membership are sample data.
The feature is a hackathon demonstration, not a provider directory. Coverage
and appointment availability still require confirmation with the dentist and
insurer.
