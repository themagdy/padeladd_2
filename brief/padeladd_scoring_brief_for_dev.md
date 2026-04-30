# PadelAdd — Scoring, Ranking & Eligibility System
> Developer implementation brief. All rules are final and approved.

---

## Match Types

| Type | Affects Points | Affects Ranking | Eligibility | Partner Restriction |
|---|---|---|---|---|
| Friendly | No | No | Creator ±300 pts | Both in ±300 range + max 300 team avg diff |
| Competition | Yes | Yes | Creator ±100 pts (locked) | Both within locked range |

---

## Registration Starting Points

Assign once on registration. Never use level as a public label. After registration, use points only.

| Level | Starting Points |
|---|---|
| Beginner | 100 |
| Initiation Intermediate | 250 |
| Intermediate | 400 |
| Intermediate High | 550 |
| Advanced | 700 |
| Competition | 850 |
| Professional | 1000 |

---

## Points Formula (Competition Matches Only)

```
point_change = (base_result + strength_adj + heavy_modifier) * new_player_factor * integrity_factor
point_change = round(point_change)
point_change = clamp(point_change, -15, +15)
player.points = max(0, player.points + point_change)
```

---

## Formula Components

### Base Result
| Result | Value |
|---|---|
| Win | +4 |
| Loss | -4 |

---

### Strength Difference Adjustment

```
team_avg = (player1.points + player2.points) / 2
diff = abs(team_a_avg - team_b_avg)
```

| Diff Range | Adjustment |
|---|---|
| 0 – 50 | 0 |
| 51 – 100 | 1 |
| 101 – 200 | 2 |
| 201+ | 3 |

```
if lower_rated_team wins:
    winner_adj = +adjustment
    loser_adj  = -adjustment

if higher_rated_team wins:
    winner_adj = -adjustment
    loser_adj  = +adjustment
```

---

### Heavy Win / Loss Modifier

```
total_game_diff = abs(set1_winner_games - set1_loser_games)
                + abs(set2_winner_games - set2_loser_games)

if match went to 3 sets:
    heavy_modifier = 0  # never applies in 3-set matches

elif total_game_diff >= 7:
    winner_modifier = +1
    loser_modifier  = -1

else:
    heavy_modifier = 0
```

---

### New Player Factor (per player individually)

| Competition Matches Played | Factor |
|---|---|
| 0 – 5 | 1.5 |
| 6 – 15 | 1.2 |
| 16+ | 1.0 |

---

### Integrity Factor

| Situation | Factor |
|---|---|
| Normal trusted match | 1.0 |
| Repeated same players too often | 0.7 |
| Big mismatch / suspicious setup | 0.5 |
| Suspicious new accounts | 0.3 |
| Clearly fake or invalid | 0.0 |

```
if integrity_factor == 0:
    skip point calculation entirely — match has no effect
if integrity_factor < 0.5:
    skip point calculation — match does not count
```

> No separate partner farming flag. Partner abuse is prevented by eligibility rules.

---

## Points Change — Full Example

```
# Example: lower-rated team wins, heavy win, new player
base          = +4
strength_adj  = +2   # lower-rated team wins with 101–200 pt diff
heavy_mod     = +1   # total game diff >= 7, 2-set match
subtotal      = 4 + 2 + 1 = 7
new_factor    = 1.5  # player has played 3 competition matches
integrity     = 1.0  # normal match

point_change  = round(7 * 1.5 * 1.0) = round(10.5) = 11
point_change  = clamp(11, -15, +15)  = 11
```

---

## Minimum Points Floor

```
player.points = max(0, player.points + point_change)

# Example:
# player.points = 8, point_change = -15
# result = max(0, 8 - 15) = max(0, -7) = 0
```

---

## Competition Match — Eligibility

### Creating a match
```
match.target_points   = creator.points
match.eligible_min    = creator.points - 100
match.eligible_max    = creator.points + 100
# Range is LOCKED at creation. Never recalculate as players join.
```

### Joining a match (solo)
```
if player.points >= match.eligible_min
and player.points <= match.eligible_max:
    allow join
else:
    block join
```

### Joining a match (with partner)
```
if player.points in range AND partner.points in range:
    allow pair join
else:
    block pair join
# Only one rule — no separate partner-to-partner check needed.
```

---

## Friendly Match — Eligibility

### Creating a match
```
match.eligible_min = creator.points - 300
match.eligible_max = creator.points + 300
```

### Joining a match (solo)
```
if player.points >= match.eligible_min
and player.points <= match.eligible_max:
    allow join
else:
    block join
```

### Joining with partner
```
if player.points in range AND partner.points in range:
    allow pair join
else:
    block pair join
```

### Team average difference check (enforced when match is full)
```
team_a_avg = (player1.points + player2.points) / 2
team_b_avg = (player3.points + player4.points) / 2
team_diff  = abs(team_a_avg - team_b_avg)

if team_diff > 300:
    block match from starting
```

---

## Match Display Order (for browsing player)

```
1. Eligible competition matches   (player.points within locked range)
2. Friendly matches               (player.points within ±300 range)
3. Non-eligible competition matches (shown but join button disabled)
```

### Labels
| Label | Condition |
|---|---|
| Eligible | Competition match, player in locked range |
| Friendly | Friendly match, player in ±300 range |
| Not Eligible | Player outside range — disable join |

---

## Result Confirmation Flow

```
1. Winning team submits result
2. Status = "pending_confirmation"
3. Opposing team has 24 hours to confirm or dispute
4. At 12 hours with no response → send reminder notification
5. At 24 hours with no response → auto-confirm, update points
6. If disputed → status = "under_review", freeze points
7. Admin resolves dispute
8. If unresolved within 7 days → status = "void", no points change
```

---

## Points Update Flow (post-confirmation)

```
1. Get both teams' average points before match
2. For each player individually:
   a. Calculate base_result (+4 win / -4 loss)
   b. Calculate strength_adj (based on team avg diff)
   c. Calculate heavy_modifier (0 if 3-set match, else ±1 if diff >= 7)
   d. Multiply by new_player_factor (individual)
   e. Multiply by integrity_factor (match-level)
   f. Round to integer
   g. Clamp to [-15, +15]
   h. Apply floor: player.points = max(0, player.points + change)
3. Update player ranking based on new points
```

---

## Match Expiry

```
if match.player_count < 4 at scheduled_time + 24h:
    match.status = "cancelled"
    notify all joined players
```

---

## Conditions — Points Change Only Happens When ALL Are True

```
match.type           == "competition"
match.player_count   == 4
match.time           < now
match.result_submitted == true
match.status         == "confirmed" or "auto_confirmed"
match.cancelled      == false
match.incomplete     == false
match.integrity_factor >= 0.5