<?php
require_once __DIR__ . '/../core/db.php';
$pdo = getDB();

function getMatchDetails($match_code) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT * FROM matches WHERE match_code = ?");
    $stmt->execute([$match_code]);
    $match = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$match) return "Match $match_code not found";

    $players = $pdo->prepare("
        SELECT mp.user_id, up.nickname, up.player_code, mp.status
        FROM match_players mp
        LEFT JOIN user_profiles up ON mp.user_id = up.user_id
        WHERE mp.match_id = ?
    ");
    $players->execute([$match['id']]);
    $pRows = $players->fetchAll(PDO::FETCH_ASSOC);

    $wl = $pdo->prepare("
        SELECT wl.requester_id, wl.partner_id, up1.nickname as req_nick, up1.player_code as req_code, up2.nickname as part_nick, up2.player_code as part_code, wl.request_status
        FROM waiting_list wl
        LEFT JOIN user_profiles up1 ON wl.requester_id = up1.user_id
        LEFT JOIN user_profiles up2 ON wl.partner_id = up2.user_id
        WHERE wl.match_id = ?
    ");
    $wl->execute([$match['id']]);
    $wRows = $wl->fetchAll(PDO::FETCH_ASSOC);

    // Check z53 specifically
    $zStmt = $pdo->prepare("SELECT user_id, nickname FROM user_profiles WHERE player_code = 'z53'");
    $zStmt->execute();
    $z53 = $zStmt->fetch(PDO::FETCH_ASSOC);

    $notifs = [];
    $presence = [];
    if ($z53) {
        $nStmt = $pdo->prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10");
        $nStmt->execute([$z53['user_id']]);
        $notifs = $nStmt->fetchAll(PDO::FETCH_ASSOC);

        $pStmt = $pdo->prepare("SELECT * FROM chat_presence WHERE user_id = ?");
        $pStmt->execute([$z53['user_id']]);
        $presence = $pStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    return [
        'match' => $match,
        'players' => $pRows,
        'waiting_list' => $wRows,
        'z53_search' => $z53,
        'z53_notifs' => $notifs,
        'z53_presence' => $presence
    ];
}

$res = getMatchDetails('M-O879');
echo json_encode($res, JSON_PRETTY_PRINT);
