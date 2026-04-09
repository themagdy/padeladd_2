# Padeladd AI Phase Rules

## Notes for AI Vibe Coding

- Follow phases strictly and do not skip foundation work
- Complete one phase fully before starting the next phase
- Keep code modular and documented
- Update `documentation` folder with every change
- Maintain consistent UI and UX
- Do not invent extra features outside the current phase unless required for stability
- The important ranking, eligibility, and integrity logic is already embedded inside the relevant phases:
  - Phase 4: match eligibility and integrity checks
  - Phase 7: points calculation, streak update, win rate update, match count update
  - Phase 8: leaderboard based on stored ranking results
- Use integer-only math for ranking and eligibility logic
- Never use decimals or rounding for ranking and eligibility calculations
- The folder `briefing/sample_screens/` includes sample UI screens that represent the target look and feel of the app, and the implementation should follow that visual direction as closely as practical
- Prefer simple, maintainable solutions over overengineering

## Required AI Return Format After Each Phase

After completing any phase, the AI must return:
- Summary of what was completed
- List of created or updated files
- List of created or altered database tables
- List of created or updated API endpoints
- Manual test steps
- Known limitations or pending items
- Documentation files updated

## Priority Order

1. Phase 0 foundation
2. Phase 1 auth
3. Phase 2 profile
4. Phase 3 matches core
5. Phase 4 match rules
6. Phase 5 communication
7. Phase 6 notifications
8. Phase 7 scoring
9. Phase 8 leaderboard
10. Phase 9 admin
11. Phase 10 optimization
12. Phase 11 mobile
