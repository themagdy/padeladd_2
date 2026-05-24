<?php
/**
 * helpers/score_helper.php
 * Utility helper to map score compositions for API backward compatibility.
 */

if (!function_exists('mapScoreComposition')) {
    function mapScoreComposition($score) {
        if (empty($score)) return $score;
        
        // If the structured columns are populated, reconstruct the virtual composition_json
        if (isset($score['t1_p1_user_id']) && $score['t1_p1_user_id'] !== null) {
            $composition = [
                [
                    'user_id' => (int)$score['t1_p1_user_id'],
                    'team_no' => 1,
                    'slot_no' => 1
                ],
                [
                    'user_id' => (int)$score['t1_p2_user_id'],
                    'team_no' => 1,
                    'slot_no' => 2
                ],
                [
                    'user_id' => (int)$score['t2_p1_user_id'],
                    'team_no' => 2,
                    'slot_no' => 1
                ],
                [
                    'user_id' => (int)$score['t2_p2_user_id'],
                    'team_no' => 2,
                    'slot_no' => 2
                ]
            ];
            $score['composition_json'] = json_encode($composition);
        } else {
            $score['composition_json'] = null;
        }
        
        return $score;
    }
}
