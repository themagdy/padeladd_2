# Padel ranking model

## Goal

Build a clear, implementation-ready ranking system for padel players.
The system must be easy for an AI coding model to translate into code using **HTML / CSS / jQuery / PHP / MySQL**.

This brief defines:
- how points are calculated after each match
- how eligible matches are determined
- how all calculations must be done using **integer-only math**
- how each player is evaluated **individually**, even when they play in the same team

---

## Core principles

- Strong new players should climb fast.
- Fake match farming should be difficult.
- Strong and weak teams should both still have incentive to play.
- Players should settle into their real level quickly.
- The implementation must use **no decimals and no rounding**.
- All divisions must use **integer division (floor)**.
- Any fractional result must be discarded.

---

## Math implementation rule

Use **integer-only math** everywhere.

That means:
- all factors are stored as whole numbers
- no decimal values are stored
- no floating point math should be used
- all divisions must return whole numbers using **floor / integer division**

### Fixed scale

Use this constant everywhere:

`SCALE = 1000000000000`

This scale is used in the final win/loss equations.

---

## Recommended defaults

Use these values as the default configuration:

- starting points = `50`
- base win = `8`
- base loss = `6`
- provisional period = first `20` matches
- integrity factor minimum = `10`

These are configuration values only.
They do **not** change the equations.

---

## Player data fields

For each player `i`:

- `P_i` = current ranking points
- `WR_i` = win rate percent from `0` to `100`
- `ST_i` = streak value
  - positive value = current win streak
  - negative value = current loss streak
  - `0` = no active streak
- `M_i` = number of matches already played before the current match

Each player is always calculated **individually**.
There are **no fixed teams in the system**.
A player can partner with any other player in any match.

---

## Match structure

For one match only:

- Team A players = `1` and `2`
- Team B players = `3` and `4`

### Team average points

Use integer division:

`TA = floor((P_1 + P_2) / 2)`

`TB = floor((P_3 + P_4) / 2)`

### Team difference

`D = abs(TA - TB)`

### Heavy loss flag

`H = 1` if the losing team had a heavy loss

`H = 0` if the losing team had a normal loss

### Heavy loss definition

A heavy loss must be explicitly defined in code.
Use this default rule unless changed later by product decisions:

`H = 1` when the losing team wins **2 games or less** in the match.

Otherwise:

`H = 0`

Example:
- score `6-0` or `6-1` or `6-2` -> heavy loss
- score `6-3` or closer -> normal loss

If the product team changes this threshold later, only the heavy-loss condition changes, not the equations.

---

## Important calculation logic

For each match:

1. Build the 2 temporary teams for that match.
2. Calculate team-level values once:
   - `TA`
   - `TB`
   - `D`
   - `H`
   - `MatchFactorWin`
   - `MatchFactorLoss`
   - `HeavyWinFactor`
   - `HeavyLossFactor`
3. Then loop through each of the 4 players separately.
4. For each player, calculate the player-specific factors individually.
5. If the player is on the winning team, apply the win equation.
6. If the player is on the losing team, apply the loss equation.
7. Update each player’s points individually.

Important result:
- 2 partners in the same winning team may gain different points
- 2 partners in the same losing team may lose different points

This is intentional.

---

## Team-level factors

These factors are calculated once per match based on the 2 temporary teams in that match.

### 1) Team strength factor

This keeps incentive for both stronger teams and weaker teams.

#### If the lower-rated team wins:

`MatchFactorWin = min(250, 100 + 5 * D)`

#### If the higher-rated team wins:

`MatchFactorWin = max(60, 100 - 2 * D)`

#### If the higher-rated team loses:

`MatchFactorLoss = min(250, 100 + 5 * D)`

#### If the lower-rated team loses:

`MatchFactorLoss = max(60, 100 - 2 * D)`

---

### 2) Heavy loss factor

For winners:

`HeavyWinFactor = 100 + 10 * H`

For losers:

`HeavyLossFactor = 100 + 25 * H`

---

## Player-level factors

These factors are calculated separately for each player.

### 3) Win rate factor

This helps correct players toward their real level.

`WRFactor_i = min(120, max(80, 100 + (50 - WR_i)))`

Examples:
- win rate `70` -> `80`
- win rate `50` -> `100`
- win rate `30` -> `120`

---

### 4) Streak factor

This slows inflated streaks and helps recovery after bad runs.

#### If player `i` wins:

`StreakWinFactor_i = min(120, max(85, 100 - 4 * ST_i))`

#### If player `i` loses:

`StreakLossFactor_i = min(120, max(85, 100 + 4 * ST_i))`

Examples:
- on `+3` streak and wins again -> `88`
- on `-3` streak and wins -> `112`
- on `+3` streak and loses -> `112`
- on `-3` streak and loses -> `88`

---

### 5) New player factor

This allows strong newcomers to move up faster.

`NewFactor_i = max(100, 220 - 6 * M_i)`

Examples:
- `0` matches -> `220`
- `10` matches -> `160`
- `20` matches -> `100`
- `30` matches -> `100`

This matches the recommended provisional period of **20 matches**.

---

### 6) Anti-farming factor

This is a protection against repeated farming of the same opponents.

`IntegrityFactor_i` must always stay between `10` and `100`

Suggested default rule based on repeated matches against the same opponent players in the last 30 days:

- 1st and 2nd time -> `100`
- 3rd time -> `75`
- 4th time -> `50`
- 5th time or more -> `25`

Optional additional reduction:
- if the same exact 4 players keep repeating suspiciously, reduce further
- but never let `IntegrityFactor_i` go below `10`

Final rule:

`IntegrityFactor_i = max(10, calculated_integrity_value)`

---

## Final point equations

Each player is always calculated separately.
Even if 2 players are partners in the same team, they may get different point changes.

### Winning player equation

`DeltaWin_i = (8 * MatchFactorWin * HeavyWinFactor * WRFactor_i * StreakWinFactor_i * NewFactor_i * IntegrityFactor_i) / SCALE`

### Losing player equation

`DeltaLoss_i = (6 * MatchFactorLoss * HeavyLossFactor * WRFactor_i * StreakLossFactor_i * NewFactor_i * IntegrityFactor_i) / SCALE`

### Mandatory implementation rule

- use integer division only
- discard any fraction
- do not round
- do not use decimals
- result must always be a whole number

---

## Player points update

For winners:

`NewPoints_i = P_i + DeltaWin_i`

For losers:

`NewPoints_i = P_i - DeltaLoss_i`

---

## Streak update after match

After calculating points, update streak values:

- if player wins and previous `ST_i >= 0`, then new streak = `ST_i + 1`
- if player wins and previous `ST_i < 0`, then new streak = `1`
- if player loses and previous `ST_i <= 0`, then new streak = `ST_i - 1`
- if player loses and previous `ST_i > 0`, then new streak = `-1`

This keeps streak logic consistent for future matches.

---

## Win rate update after match

After the match, update each player’s win rate based on full historical results.

Recommended implementation:

`WR_i = floor((TotalWins_i * 100) / TotalMatches_i)`

where:
- `TotalWins_i` = total wins after the current match
- `TotalMatches_i` = total matches after the current match

This keeps `WR_i` as a whole number from `0` to `100`.

---

## Eligible match logic

Do not match teams by points only.
Use an adjusted score that accounts for player confidence.

### 1) Confidence

`Confidence_i = min(100, 5 * M_i)`

So after `20` matches:

`Confidence_i = 100`

### 2) Player match score

Use this equation:

`PlayerMatchScore_i = floor((P_i * (300 + Confidence_i)) / 400)`

This is the cleaner integer-only form.

### 3) Team match score

Use integer division:

`TeamMatchScore = floor((PlayerMatchScore_p1 + PlayerMatchScore_p2) / 2)`

### 4) Eligible match rule

Two teams are eligible to play if:

`abs(TeamMatchScore_A - TeamMatchScore_B) <= 8 + floor((max(TeamMatchScore_A, TeamMatchScore_B) * 15) / 100)`

This creates:
- tighter matching at low levels
- more flexibility at higher levels
- safer handling for new players

---

## Why the model is fair

### Not fixed teams

Because padel partners can change every match, each player is calculated separately.
This is more fair than forcing both partners to always gain or lose the same points.

### New strong players

They move up faster because `NewFactor_i` is high early.

### Fake matches

They become much less effective because `IntegrityFactor_i` drops strongly.

### Weak team incentive

A weaker team gets much more reward for beating a stronger team.

### Strong team incentive

A stronger team still gets rewarded for winning, but not excessively.

### Fast correction

Win rate and streak help move players toward their real level faster.

---

## AI coding instructions

When implementing this model, the AI coding model must follow these rules exactly:

- use integer-only math everywhere
- use `SCALE = 1000000000000`
- never use decimals or floats
- always use floor / integer division
- compute team-level factors once per match
- compute player-level factors separately for each player
- apply win formula only to winners
- apply loss formula only to losers
- update points individually for all 4 players
- update streak after the result is applied
- update win rate after the match is completed
- update match count after the match is completed

---

## Final code-ready equations summary

### Team averages

`TA = floor((P_1 + P_2) / 2)`

`TB = floor((P_3 + P_4) / 2)`

`D = abs(TA - TB)`

### Team factors

If lower-rated team wins:

`MatchFactorWin = min(250, 100 + 5 * D)`

If higher-rated team wins:

`MatchFactorWin = max(60, 100 - 2 * D)`

If higher-rated team loses:

`MatchFactorLoss = min(250, 100 + 5 * D)`

If lower-rated team loses:

`MatchFactorLoss = max(60, 100 - 2 * D)`

`HeavyWinFactor = 100 + 10 * H`

`HeavyLossFactor = 100 + 25 * H`

### Player factors

`WRFactor_i = min(120, max(80, 100 + (50 - WR_i)))`

`StreakWinFactor_i = min(120, max(85, 100 - 4 * ST_i))`

`StreakLossFactor_i = min(120, max(85, 100 + 4 * ST_i))`

`NewFactor_i = max(100, 220 - 6 * M_i)`

`IntegrityFactor_i = max(10, calculated_integrity_value)`

### Final deltas

`DeltaWin_i = (8 * MatchFactorWin * HeavyWinFactor * WRFactor_i * StreakWinFactor_i * NewFactor_i * IntegrityFactor_i) / SCALE`

`DeltaLoss_i = (6 * MatchFactorLoss * HeavyLossFactor * WRFactor_i * StreakLossFactor_i * NewFactor_i * IntegrityFactor_i) / SCALE`

### Point update

`NewPoints_i = P_i + DeltaWin_i` for winners

`NewPoints_i = P_i - DeltaLoss_i` for losers

### Eligibility

`Confidence_i = min(100, 5 * M_i)`

`PlayerMatchScore_i = floor((P_i * (300 + Confidence_i)) / 400)`

`TeamMatchScore = floor((PlayerMatchScore_p1 + PlayerMatchScore_p2) / 2)`

A match is eligible if:

`abs(TeamMatchScore_A - TeamMatchScore_B) <= 8 + floor((max(TeamMatchScore_A, TeamMatchScore_B) * 15) / 100)`

---

This version is fully clarified, integer-safe, and written to be easy for AI coding models to understand and implement correctly.
