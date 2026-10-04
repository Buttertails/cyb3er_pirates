# Research and decisions

- **Intent location**: Put a `dentists.find` intent on the CX flow so users can ask from the menu, procedure, network, or estimate stage. A dentist page makes the branch visible in the agent and offers a path back to procedure questions.
- **Data source**: Reuse the authenticated, fictional directory from feature 006; a chat message cannot override saved company or ZIP.
- **Transport**: Return a typed `dentist_directory` webhook payload through the existing chat API. React renders the existing `DentistResults` component. Plain text alone would lose rating, phone, map links, and ranking.
- **Alternative**: A React keyword shortcut would be faster but would leave the cloud agent unchanged and miss the requested chatbot branch.
- **CX form precedence**: A focused live probe showed “find in-network dentists near me” at the Network page becomes `PARAMETER_FILLING` and moves to Estimate before the intent route can run. Add a narrow backend phrase recognizer that sends a custom CX event for clear dentist directory requests, with a flow event handler targeting the same Dentists page. The CX intent remains available for other natural phrasings. The event path preserves the real agent branch and avoids changing the existing network form.
