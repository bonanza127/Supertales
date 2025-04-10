import React, { useState, useEffect, useRef, useCallback } from 'react';
// import { Heart } from 'lucide-react'; // ← 不要になったため削除
import * as Tone from 'tone'; // Namespace import

// ============================================================================
// --- 定数定義 (Constants) ---
// ============================================================================
const BATTLE_BOX_WIDTH = 200;
const BATTLE_BOX_HEIGHT = 150;
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 150; // ピクセル/秒
const INITIAL_HP = 100;
const SPAWN_INTERVAL = 300; // ms (DVDロゴ以外で使用)
const BONE_SPEED = 4 * 60; // ピクセル/秒
const DAMAGE_AMOUNT = 5; // 基本ダメージ量
const BOUNDARY_DAMAGE_INTERVAL = 500; // ms
const TYPEWRITER_SPEED = 50; // ms
const DELAY_BETWEEN_LINES = 700; // ms
const ENEMY_IMAGE_URL = "https://i.imgur.com/RzfyQOV.png";
const PLAYER_IMAGE_URL = "https://i.imgur.com/DN1tHyO.png";
const BATTLE_DURATION_SECONDS = 60; // 戦闘時間 (秒)
const GASTER_WARN_DURATION = 800; // ms 警告時間
const GASTER_BEAM_DURATION = 250; // ms ビーム持続時間
const GASTER_WIDTH = 30; // ビームの幅（または高さ）
const INVINCIBILITY_DURATION = 600; // 無敵時間 (ms)
const VERTICAL_BONE_WIDTH = 10;
const VERTICAL_BONE_HEIGHT = 60;
const HORIZONTAL_BONE_WIDTH = 60;
const HORIZONTAL_BONE_HEIGHT = 10;
const LIFT_WIDTH = 100;
const LIFT_HEIGHT = 10;
const PLATFORM_LIFT_SPEED = 3 * 60; // ピクセル/秒
// ★★★ 追加: DVDロゴ関連の定数 ★★★
const DVD_LOGO_SIZE = 30;
const DVD_LOGO_SPEED = 2.5 * 60; // ピクセル/秒

// --- 攻撃パターン定義 ---
// ★★★ 変更点: DVDロゴ攻撃を追加 ★★★
const ATTACK_PATTERNS = [
    { name: '横方向の骨', duration: 4500, type: 'BONES_HORIZONTAL' },
    { name: '縦方向の骨', duration: 4500, type: 'BONES_VERTICAL' },
    { name: 'ゲスターブラスター', duration: 6000, type: 'GASTER_BLASTER' },
    // { name: '左右分割リフト', duration: 8000, type: 'SPLIT_LIFTS' }, // 無効化中
    { name: 'DVDロゴ', duration: 10000, type: 'DVD_LOGO' }, // ← 追加
];

// --- 英語セリフ ---
const DIALOGUE_LINES = [ /* ... */ ];
const INTERMISSION_DIALOGUE_LINES = [ /* ... */ ];

// --- ゲームフェーズ定義 ---
const GamePhase = { /* ... */ };

// --- 初期状態 ---
const getInitialState = () => ({ /* ... */ });

// --- エラーバウンダリコンポーネント ---
class ErrorBoundary extends React.Component { /* ... */ }

// ============================================================================
// --- UI サブコンポーネント定義 (UI Sub-Components) ---
// ============================================================================
const Player = React.memo(({ position, isInvincible }) => ( /* ... */ ));

// ★★★ 変更点: AttackRenderer に dvd_logo の描画処理を追加 ★★★
const AttackRenderer = React.memo(({ attack }) => {
    switch(attack.type) {
        case 'gaster_warning': return <div key={attack.id} className="gaster-warning" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }}></div>;
        case 'gaster_beam': return <div key={attack.id} className="gaster-beam" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }}></div>;
        case 'bone': case 'bone_v': return ( <div key={attack.id} className="attack-bone" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }} /> );
        case 'platform': return ( <div key={attack.id} className="attack-platform" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }} /> );
        // DVDロゴの描画 (色付きの四角形)
        case 'dvd_logo': return ( <div key={attack.id} className="attack-dvd-logo" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px`, backgroundColor: attack.color || 'purple' }} /> );
        default: return null;
    }
});
const DialogueBox = React.memo(({ text, show }) => ( /* ... */ ));
const GameOverScreen = React.memo(({ onRestart }) => ( /* ... */ ));
const ActionButtons = React.memo(({ disabled, onCommand }) => ( /* ... */ ));
const UIElements = React.memo(({ hp, currentAttackName, attackTimer, battleTimeRemaining, isBattle, isCommandSelection }) => ( /* ... */ ));
const EnemyCharacter = React.memo(() => ( /* ... */ ));
const PreloadScreen = React.memo(({ onStart }) => ( /* ... */ ));

// ============================================================================
// --- メインアプリケーションコンポーネント (Main App Component) ---
// ============================================================================
const App = () => {
  // --- State & Refs ---
  const [gameState, setGameState] = useState(getInitialState());
  const { gamePhase, showDialogue, displayedDialogue, currentLineIndex, battlePlayerPosition, hp, currentAttackPatternIndex, attackTimer, attacks, isOutsideBounds, battleTimeRemaining, isInvincible, nextAttackIndex } = gameState;
  const currentAttack = ATTACK_PATTERNS.length > 0 ? ATTACK_PATTERNS[currentAttackPatternIndex] : null;
  const requestRef = useRef(); const lastUpdateTimeRef = useRef(0); const pressedKeys = useRef({});
  const spawnIntervalRef = useRef(null); const nextPatternTimeoutRef = useRef(null); const attackTimerIntervalRef = useRef(null); const boundaryDamageTimerRef = useRef(null);
  const typewriterIntervalRef = useRef(null); const nextLineTimeoutRef = useRef(null);
  const synthRef = useRef(null); const bgmLoopRef = useRef(null); const typingSynthRef = useRef(null); const toneStarted = useRef(false);
  const gamePhaseRef = useRef(gamePhase); const battleBoxRef = useRef(null); const playerPositionRef = useRef(gameState.battlePlayerPosition); const playerHitInLastFrame = useRef(false); const battleTimerIntervalRef = useRef(null);
  const invincibilityTimerRef = useRef(null);
  const nextLiftSideRef = useRef('left');

  // --- Core Logic Callbacks (Memoized) ---

  // Sync Refs with State
  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { playerPositionRef.current = battlePlayerPosition; }, [battlePlayerPosition]);

  // Collision Detection
  const checkBattleCollision = useCallback((player, attack) => {
    // gaster_warning は当たり判定なし
    if (attack.type === 'gaster_warning') return false;

    const playerRect = {
        left: player.x,
        right: player.x + PLAYER_SIZE,
        top: player.y,
        bottom: player.y + PLAYER_SIZE
    };
    // 攻撃オブジェクトの矩形
    const attackRect = {
        left: attack.x,
        right: attack.x + attack.width,
        top: attack.y,
        bottom: attack.y + attack.height
    };

    // 矩形の衝突判定 (AABB)
    const tolerance = 0; // 当たり判定の許容誤差 (0なら厳密)
    return playerRect.left < attackRect.right - tolerance &&
           playerRect.right > attackRect.left + tolerance &&
           playerRect.top < attackRect.bottom - tolerance &&
           playerRect.bottom > attackRect.top + tolerance;
   }, []); // PLAYER_SIZE は定数なので依存関係不要

   // 無敵状態解除関数
   const endInvincibility = useCallback(() => { setGameState(prev => ({ ...prev, isInvincible: false })); invincibilityTimerRef.current = null; }, []);

  // Apply Damage
   const applyDamage = useCallback((amount) => {
        setGameState(prev => {
            if (prev.isInvincible || prev.hp <= 0 || prev.gamePhase === GamePhase.COMMAND_SELECTION || (prev.gamePhase !== GamePhase.BATTLE && prev.gamePhase !== GamePhase.DIALOGUE && prev.gamePhase !== GamePhase.INTERMISSION_DIALOGUE)) return prev;
            const newHp = Math.max(0, prev.hp - amount);
            let nextPhase = prev.gamePhase;
            let shouldBeInvincible = false;
            if (newHp < prev.hp) {
                shouldBeInvincible = true;
                if (newHp <= 0 && prev.gamePhase === GamePhase.BATTLE) {
                    console.log("HPが0になりました。ゲームオーバーへ移行します。");
                    nextPhase = GamePhase.GAMEOVER;
                }
                clearTimeout(invincibilityTimerRef.current);
                invincibilityTimerRef.current = setTimeout(endInvincibility, INVINCIBILITY_DURATION);
            }
            return { ...prev, hp: newHp, gamePhase: nextPhase, isInvincible: shouldBeInvincible };
        });
   }, [endInvincibility]); // INVINCIBILITY_DURATION は定数

  // Spawn Attack (通常攻撃用、DVDロゴは別途生成)
   const spawnAttack = useCallback(() => {
        // DVDロゴパターン中は通常のスポーンを停止
        if (gamePhaseRef.current !== GamePhase.BATTLE || (ATTACK_PATTERNS[gameState.currentAttackPatternIndex]?.type === 'DVD_LOGO')) {
             return;
        }

        setGameState(prev => {
            if (prev.gamePhase !== GamePhase.BATTLE) return prev;
            if (ATTACK_PATTERNS.length === 0) return prev;
            const currentPattern = ATTACK_PATTERNS[prev.currentAttackPatternIndex];
            // DVDロゴパターンではここでは生成しない
            if (!currentPattern || currentPattern.type === 'DVD_LOGO') return prev;

            let newAttacksToAdd = []; const idBase = Date.now() + Math.random();
            switch (currentPattern.type) {
                case 'BONES_HORIZONTAL': { const y = Math.random() * (BATTLE_BOX_HEIGHT - HORIZONTAL_BONE_HEIGHT); const d = Math.random() < 0.5 ? 'l' : 'r'; newAttacksToAdd.push({ id: idBase, type: 'bone', x: d === 'l' ? -HORIZONTAL_BONE_WIDTH : BATTLE_BOX_WIDTH, y, width: HORIZONTAL_BONE_WIDTH, height: HORIZONTAL_BONE_HEIGHT, speed: BONE_SPEED * (d === 'l' ? 1 : -1), color: 'white' }); break; }
                case 'BONES_RISING': { const x = Math.random() * (BATTLE_BOX_WIDTH - VERTICAL_BONE_WIDTH); newAttacksToAdd.push({ id: idBase, type: 'bone_v', x, y: BATTLE_BOX_HEIGHT, width: VERTICAL_BONE_WIDTH, height: VERTICAL_BONE_HEIGHT, speed: -BONE_SPEED, color: 'white' }); break; }
                case 'BONES_VERTICAL': { const x = Math.random() * (BATTLE_BOX_WIDTH - VERTICAL_BONE_WIDTH); const d = Math.random() < 0.5 ? 't' : 'b'; newAttacksToAdd.push({ id: idBase, type: 'bone_v', x, y: d === 't' ? -VERTICAL_BONE_HEIGHT : BATTLE_BOX_HEIGHT, width: VERTICAL_BONE_WIDTH, height: VERTICAL_BONE_HEIGHT, speed: BONE_SPEED * (d === 't' ? 1 : -1), color: 'white' }); break; }
                case 'GASTER_BLASTER': { if (Math.random() < 0.6) { const side = ['left', 'right', 'top', 'bottom'][Math.floor(Math.random() * 4)]; let x = 0, y = 0, w = 0, h = 0; let o = 'h'; if (side === 'left' || side === 'right') { o = 'h'; w = BATTLE_BOX_WIDTH; h = GASTER_WIDTH; x = 0; y = Math.random() * (BATTLE_BOX_HEIGHT - h); } else { o = 'v'; h = BATTLE_BOX_HEIGHT; w = GASTER_WIDTH; y = 0; x = Math.random() * (BATTLE_BOX_WIDTH - w); } newAttacksToAdd.push({ id: idBase, type: 'gaster_warning', x, y, width: w, height: h, orientation: o, warnTimer: GASTER_WARN_DURATION }); } break; }
                default: break;
            }
            if (newAttacksToAdd.length > 0) return { ...prev, attacks: [...prev.attacks, ...newAttacksToAdd] };
            return prev;
        });
   }, [gameState.currentAttackPatternIndex]); // gameState依存を追加

  // Game Loop
  const gameLoop = useCallback((timestamp) => {
    if (gamePhaseRef.current === GamePhase.PRELOAD || gamePhaseRef.current === GamePhase.GAMEOVER || gamePhaseRef.current === GamePhase.COMMAND_SELECTION) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
        return;
    }
    if (!lastUpdateTimeRef.current) lastUpdateTimeRef.current = timestamp;
    const deltaTime = timestamp - lastUpdateTimeRef.current;
    if (deltaTime > 100) { // Avoid large jumps if tab was inactive
        lastUpdateTimeRef.current = timestamp;
        requestRef.current = requestAnimationFrame(gameLoop);
        return;
    }
    const deltaSeconds = deltaTime / 1000;
    lastUpdateTimeRef.current = timestamp;

    let hitDetectedThisFrame = false;
    let attacksToAddThisFrame = [];
    let attacksToRemoveThisFrame = new Set();

    setGameState(prev => {
        if (prev.gamePhase === GamePhase.COMMAND_SELECTION) return prev;

        const currentlyInvincible = prev.isInvincible;
        let newState = { ...prev };
        let newBattlePlayerPosition;

        // --- Player Movement ---
        if (prev.gamePhase === GamePhase.DIALOGUE || prev.gamePhase === GamePhase.BATTLE || prev.gamePhase === GamePhase.INTERMISSION_DIALOGUE) {
            let dx = 0; const hs = PLAYER_SPEED * deltaSeconds;
            if (pressedKeys.current['ArrowLeft'] || pressedKeys.current['KeyA']) dx -= hs;
            if (pressedKeys.current['ArrowRight'] || pressedKeys.current['KeyD']) dx += hs;
            let newX = playerPositionRef.current.x + dx;
            newX = Math.max(0, Math.min(newX, BATTLE_BOX_WIDTH - PLAYER_SIZE));

            let newY = playerPositionRef.current.y; const vs = PLAYER_SPEED * deltaSeconds; let dy = 0;
            if (pressedKeys.current['ArrowUp'] || pressedKeys.current['KeyW']) dy -= vs;
            if (pressedKeys.current['ArrowDown'] || pressedKeys.current['KeyS']) dy += vs;
            newY += dy;
            newY = Math.max(0, Math.min(newY, BATTLE_BOX_HEIGHT - PLAYER_SIZE));
            newBattlePlayerPosition = { x: newX, y: newY };
            newState.battlePlayerPosition = newBattlePlayerPosition;
        } else {
            newBattlePlayerPosition = prev.battlePlayerPosition;
        }

        // --- Attack Update & Collision ---
        let updatedAttacks = [];
        if (prev.gamePhase === GamePhase.BATTLE) {
            updatedAttacks = prev.attacks.map(a => {
                let ua = { ...a };

                // ★★★ 変更点: 攻撃タイプごとの更新処理 ★★★
                switch (a.type) {
                    case 'bone':
                        ua.x += ua.speed * deltaSeconds;
                        break;
                    case 'bone_v':
                        ua.y += ua.speed * deltaSeconds;
                        break;
                    case 'platform':
                        ua.y += ua.speed * deltaSeconds;
                        break;
                    // ★★★ 追加: DVDロゴの移動と反射 ★★★
                    case 'dvd_logo':
                        ua.x += ua.vx * deltaSeconds;
                        ua.y += ua.vy * deltaSeconds;

                        // 壁との反射判定
                        if (ua.x <= 0) {
                            ua.vx = Math.abs(ua.vx); // 必ず正の速度に
                            ua.x = 0; // 壁にくっつける
                        } else if (ua.x + ua.width >= BATTLE_BOX_WIDTH) {
                            ua.vx = -Math.abs(ua.vx); // 必ず負の速度に
                            ua.x = BATTLE_BOX_WIDTH - ua.width; // 壁にくっつける
                        }

                        if (ua.y <= 0) {
                            ua.vy = Math.abs(ua.vy); // 必ず正の速度に
                            ua.y = 0; // 壁にくっつける
                        } else if (ua.y + ua.height >= BATTLE_BOX_HEIGHT) {
                            ua.vy = -Math.abs(ua.vy); // 必ず負の速度に
                            ua.y = BATTLE_BOX_HEIGHT - ua.height; // 壁にくっつける
                        }
                        break;
                    default:
                        break;
                }

                // Gaster Beam / Warning の処理 (変更なし)
                if (a.lifetime !== undefined) {
                    ua.lifetime -= deltaTime;
                    if (ua.lifetime <= 0) attacksToRemoveThisFrame.add(a.id);
                }
                if (a.warnTimer !== undefined) {
                    ua.warnTimer -= deltaTime;
                    if (ua.warnTimer <= 0 && !attacksToRemoveThisFrame.has(a.id)) {
                        attacksToRemoveThisFrame.add(a.id);
                        let bx, by, bw, bh;
                        if (a.orientation === 'h') {
                            bw = BATTLE_BOX_WIDTH; bh = GASTER_WIDTH;
                            by = a.y + a.height/2 - bh/2; bx = 0;
                        } else {
                            bh = BATTLE_BOX_HEIGHT; bw = GASTER_WIDTH;
                            bx = a.x + a.width/2 - bw/2; by = 0;
                        }
                        attacksToAddThisFrame.push({
                            id: a.id + '_beam', type: 'gaster_beam',
                            x: bx, y: by, width: bw, height: bh,
                            lifetime: GASTER_BEAM_DURATION, color: 'white'
                        });
                    }
                }
                return ua;
            });

            // Remove off-screen attacks (DVDロゴ以外)
            updatedAttacks.forEach(a => {
                if (a.type !== 'gaster_warning' && a.type !== 'gaster_beam' && a.type !== 'dvd_logo') {
                    if (a.x + a.width < -50 || a.x > BATTLE_BOX_WIDTH + 50 ||
                        a.y + a.height < -50 || a.y > BATTLE_BOX_HEIGHT + 50) {
                        attacksToRemoveThisFrame.add(a.id);
                    }
                }
            });

            // Check for collisions
            const playerRect = { x: newBattlePlayerPosition.x, y: newBattlePlayerPosition.y };
            let finalAttacks = [];
            for (const attack of updatedAttacks) {
                if (attacksToRemoveThisFrame.has(attack.id)) continue;

                if (!currentlyInvincible && !hitDetectedThisFrame && checkBattleCollision(playerRect, attack)) {
                    hitDetectedThisFrame = true;
                    // Remove colliding bone/platform, but not beams or DVD logo
                    if (attack.type !== 'gaster_beam' && attack.type !== 'dvd_logo') {
                        attacksToRemoveThisFrame.add(attack.id);
                        continue;
                    }
                }
                finalAttacks.push(attack);
            }
            newState.attacks = [...finalAttacks.filter(a => !attacksToRemoveThisFrame.has(a.id)), ...attacksToAddThisFrame];
        } else {
            newState.attacks = prev.attacks;
        }

        playerHitInLastFrame.current = hitDetectedThisFrame;
        const outside = newBattlePlayerPosition.x < 0 || newBattlePlayerPosition.x + PLAYER_SIZE > BATTLE_BOX_WIDTH ||
                        newBattlePlayerPosition.y < 0 || newBattlePlayerPosition.y + PLAYER_SIZE > BATTLE_BOX_HEIGHT;
        newState.isOutsideBounds = outside;

        return newState;
    });

    if (playerHitInLastFrame.current && gamePhaseRef.current === GamePhase.BATTLE) {
        applyDamage(DAMAGE_AMOUNT);
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  }, [applyDamage, checkBattleCollision]); // 定数は依存関係から除外


  // --- Audio Setup and Control ---
  const setupAudio = useCallback(() => { /* ... */ }, []);
  const startAudio = useCallback(async () => { /* ... */ }, [setupAudio]);
  const stopAudio = useCallback(() => { /* ... */ }, []);
  const playTypingSound = useCallback(() => { /* ... */ }, []);


  // --- Dialogue Sequence Logic ---
  const typeNextLine = useCallback(() => { /* ... */ }, [playTypingSound]);
  const startDialogueSequence = useCallback(() => { /* ... */ }, [typeNextLine]);


  // --- Game Start & Reset Logic ---
  const resetGame = useCallback(() => { /* ... */ }, [stopAudio]);
  const handleStartGame = useCallback(async () => { /* ... */ }, [startAudio]);


  // --- Keyboard Handlers ---
  const handleKeyDown = useCallback((event) => { /* ... */ }, []);
  const handleKeyUp = useCallback((event) => { /* ... */ }, []);

  // --- Attack Pattern Switching Logic ---
  // ★★★ 変更点: パターン切り替え時の処理を修正 ★★★
  const switchToNextPattern = useCallback(() => {
      clearTimeout(nextPatternTimeoutRef.current);
      setGameState(prev => {
          if (prev.gamePhase !== GamePhase.BATTLE) return prev;
          if (ATTACK_PATTERNS.length === 0) {
              console.warn("No attack patterns defined. Transitioning to command selection.");
              return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] };
          }

          const currentPatternIndex = prev.currentAttackPatternIndex;
          const nextIndexRaw = currentPatternIndex + 1;

          // 最後のパターンが終わったらコマンド選択へ (ループしない)
          if (nextIndexRaw >= ATTACK_PATTERNS.length) {
              console.log("Last attack pattern finished. Transitioning to command selection.");
              clearInterval(spawnIntervalRef.current); // 通常攻撃の生成を停止
              clearTimeout(nextPatternTimeoutRef.current);
              clearInterval(attackTimerIntervalRef.current);
              // DVDロゴなどの持続的な攻撃もクリア
              return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] };
          }

          const nextAttackPatternIndex = nextIndexRaw;
          const nextPattern = ATTACK_PATTERNS[nextAttackPatternIndex];

          if (!nextPattern) { // 安全策
              console.error("Next pattern not found at index:", nextAttackPatternIndex);
              return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] };
          }

          let attacksToAdd = [];
          // ★★★ 追加: DVDロゴパターンの開始時にロゴを生成 ★★★
          if (nextPattern.type === 'DVD_LOGO') {
              // ランダムな初期速度（ただし、完全に水平/垂直にならないように）
              let angle = Math.random() * Math.PI * 2;
              // 角度が軸に近すぎる場合は調整
              while (Math.abs(Math.cos(angle)) < 0.1 || Math.abs(Math.sin(angle)) < 0.1) {
                  angle = Math.random() * Math.PI * 2;
              }
              const initialVx = DVD_LOGO_SPEED * Math.cos(angle);
              const initialVy = DVD_LOGO_SPEED * Math.sin(angle);

              attacksToAdd.push({
                  id: 'dvd_logo_' + Date.now(),
                  type: 'dvd_logo',
                  x: BATTLE_BOX_WIDTH / 2 - DVD_LOGO_SIZE / 2, // 中央から開始
                  y: BATTLE_BOX_HEIGHT / 2 - DVD_LOGO_SIZE / 2,
                  width: DVD_LOGO_SIZE,
                  height: DVD_LOGO_SIZE,
                  vx: initialVx,
                  vy: initialVy,
                  color: `hsl(${Math.random() * 360}, 70%, 60%)` // ランダムな色
              });
              clearInterval(spawnIntervalRef.current); // DVDロゴ中は通常スポーン停止
              spawnIntervalRef.current = null;
          } else {
              // DVDロゴ以外のパターンが始まる場合、通常スポーンを再開/開始
              if (!spawnIntervalRef.current) {
                   spawnIntervalRef.current = setInterval(spawnAttack, SPAWN_INTERVAL);
              }
          }

          // 中間ダイアログのチェック (index 2 の後)
          if (currentPatternIndex === 2) {
              console.log("攻撃パターン3終了。中間ダイアログへ移行。");
              // DVDロゴなどの持続攻撃もクリア
              return {
                  ...prev,
                  gamePhase: GamePhase.INTERMISSION_DIALOGUE,
                  nextAttackIndex: nextAttackPatternIndex,
                  attacks: [], // 幕間に入る前に攻撃をクリア
                  showDialogue: true,
                  currentLineIndex: 0,
                  displayedDialogue: "",
              };
          } else {
              // 通常のパターン切り替え
              console.log(`次の攻撃パターンへ移行: ${nextPattern.name} (持続時間: ${nextPattern.duration}ms)`);
              nextPatternTimeoutRef.current = setTimeout(switchToNextPattern, nextPattern.duration);
              return {
                  ...prev,
                  currentAttackPatternIndex: nextAttackPatternIndex,
                  attackTimer: nextPattern.duration / 1000,
                  attacks: attacksToAdd, // 前の攻撃をクリアし、新しい攻撃(DVDロゴなど)を追加
              };
          }
      });
  }, [spawnAttack]); // spawnAttack を依存関係に追加

   // --- 戦闘開始処理 ---
   const startBattle = useCallback(() => {
      console.log("フェーズ戦闘: セットアップ開始。");
      setTimeout(() => battleBoxRef.current?.focus(), 0);

      if (!requestRef.current) {
          console.log("Restarting game loop for BATTLE phase.");
          lastUpdateTimeRef.current = 0;
          requestRef.current = requestAnimationFrame(gameLoop);
      }

      if (ATTACK_PATTERNS.length === 0) {
          console.warn("No attack patterns available to start battle. Going to command selection.");
          setGameState(prev => ({ ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] }));
          return;
      }

      // Clear previous timers before starting new ones
      clearInterval(spawnIntervalRef.current);
      clearTimeout(nextPatternTimeoutRef.current);
      clearInterval(attackTimerIntervalRef.current);
      clearInterval(battleTimerIntervalRef.current);
      spawnIntervalRef.current = null; // Reset ref
      nextPatternTimeoutRef.current = null;
      attackTimerIntervalRef.current = null;
      battleTimerIntervalRef.current = null;


      setGameState(prev => {
          // 幕間から戻ってきた場合、nextAttackIndex を使う
          const initialIndex = prev.nextAttackIndex !== null ? prev.nextAttackIndex : 0;
          // 念のためインデックスが範囲内か確認
          const validInitialIndex = initialIndex < ATTACK_PATTERNS.length ? initialIndex : 0;
          const pattern = ATTACK_PATTERNS[validInitialIndex];

          let initialAttacks = [];
          if (pattern) {
               console.log(`現在の攻撃パターン開始: ${pattern.name}, ${pattern.duration}ms後に切り替え`);
               nextPatternTimeoutRef.current = setTimeout(switchToNextPattern, pattern.duration);

               // ★★★ 追加: 戦闘開始時にもDVDロゴ生成をチェック ★★★
               if (pattern.type === 'DVD_LOGO') {
                   let angle = Math.random() * Math.PI * 2;
                   while (Math.abs(Math.cos(angle)) < 0.1 || Math.abs(Math.sin(angle)) < 0.1) { angle = Math.random() * Math.PI * 2; }
                   const initialVx = DVD_LOGO_SPEED * Math.cos(angle);
                   const initialVy = DVD_LOGO_SPEED * Math.sin(angle);
                   initialAttacks.push({
                       id: 'dvd_logo_' + Date.now(), type: 'dvd_logo',
                       x: BATTLE_BOX_WIDTH / 2 - DVD_LOGO_SIZE / 2, y: BATTLE_BOX_HEIGHT / 2 - DVD_LOGO_SIZE / 2,
                       width: DVD_LOGO_SIZE, height: DVD_LOGO_SIZE,
                       vx: initialVx, vy: initialVy,
                       color: `hsl(${Math.random() * 360}, 70%, 60%)`
                   });
               } else {
                   // DVDロゴ以外なら通常スポーン開始
                   spawnIntervalRef.current = setInterval(spawnAttack, SPAWN_INTERVAL);
               }

               return {
                   ...prev,
                   currentAttackPatternIndex: validInitialIndex,
                   attackTimer: pattern.duration / 1000,
                   attacks: initialAttacks, // 初期攻撃を設定 (DVDロゴなど)
                   nextAttackIndex: null // 使用したのでリセット
                };
          } else {
              console.error("Initial pattern not found at index:", validInitialIndex);
              return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] };
          }
      });

      // Attack Timer Interval (Visual Countdown)
      attackTimerIntervalRef.current = setInterval(() => {
          setGameState(prev => (prev.gamePhase === GamePhase.BATTLE ? { ...prev, attackTimer: Math.max(0, prev.attackTimer - 1) } : prev));
      }, 1000);

      // Battle Duration Timer
      battleTimerIntervalRef.current = setInterval(() => {
          setGameState(prev => {
              if (prev.gamePhase !== GamePhase.BATTLE) {
                  clearInterval(battleTimerIntervalRef.current);
                  return prev;
              }
              const newTime = prev.battleTimeRemaining - 1;
              if (newTime < 0) {
                  console.log("戦闘時間終了。コマンド選択へ移行。");
                  clearInterval(battleTimerIntervalRef.current);
                  clearInterval(spawnIntervalRef.current);
                  clearTimeout(nextPatternTimeoutRef.current);
                  clearInterval(attackTimerIntervalRef.current);
                  return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [], battleTimeRemaining: 0 };
              }
              return { ...prev, battleTimeRemaining: newTime };
          });
      }, 1000);
  }, [spawnAttack, switchToNextPattern, gameLoop]); // gameLoop依存復活


  // --- Effects ---

  // Keyboard Listener Setup
  useEffect(() => { /* ... */ }, [handleKeyDown, handleKeyUp]);

  // Main Game Phase Logic Controller
  useEffect(() => { /* ... */ }, [gamePhase, startBattle, stopAudio, gameLoop, startDialogueSequence]);

   // Audio Cleanup on Unmount
   useEffect(() => { return () => { stopAudio(); toneStarted.current = false; }; }, [stopAudio]);

   // --- コマンド選択処理 ---
   const handleCommandSelection = useCallback((command) => { /* ... */ }, [gameState.gamePhase]);


  // --- Rendering ---
  return (
    <ErrorBoundary>
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono select-none p-4">
          {/* スタイル定義 */}
          {/* ★★★ 追加: DVDロゴ用のスタイル ★★★ */}
          <style>{`
            .pixelated { image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges; }
            body { font-family: 'Courier New', Courier, monospace; background-color: black; }
            button:focus, [tabindex="0"]:focus { outline: 2px solid orange; outline-offset: 2px; }
            .dialogue-container { position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 180px; z-index: 20; opacity: ${showDialogue && gamePhase !== GamePhase.COMMAND_SELECTION ? 1 : 0}; transition: opacity 0.3s ease-in-out; pointer-events: ${showDialogue ? 'auto' : 'none'}; }
            .dialogue-box { background-color: white; color: black; border: 2px solid black; padding: 10px 12px; border-radius: 4px; font-size: 0.9rem; line-height: 1.4; text-align: left; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-family: "Comic Sans MS", sans-serif; min-height: 1.4em; overflow-wrap: break-word; }
            .dialogue-box::after { content: ''; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 12px solid white; }
            .dialogue-box p::after { content: '_'; font-family: "Comic Sans MS", sans-serif; opacity: ${showDialogue ? 1 : 0}; animation: blink 1s step-end infinite; margin-left: 1px; }
            @keyframes blink { 50% { opacity: 0; } }
            .attack-bone { position: absolute; background-color: white; clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
            .attack-platform { position: absolute; background-color: #60a5fa; border: 1px solid #2563eb; }
            .gaster-warning { position: absolute; border: 2px dashed rgba(255, 255, 255, 0.7); box-sizing: border-box; z-index: 15; animation: blink-warning 0.2s linear infinite alternate; }
            @keyframes blink-warning { 0% { border-color: rgba(255, 255, 255, 0.7); } 100% { border-color: rgba(255, 255, 255, 0.2); } }
            .gaster-beam { position: absolute; background-color: rgba(255, 255, 255, 0.9); box-shadow: 0 0 10px 5px rgba(255, 255, 255, 0.5); z-index: 5; }
            .attack-dvd-logo { position: absolute; border: 1px solid rgba(255, 255, 255, 0.5); box-shadow: 0 0 5px rgba(255, 255, 255, 0.3); } /* DVDロゴのスタイル */
            @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
            .game-title { font-family: 'Press Start 2P', cursive; color: white; text-shadow: 2px 2px #555; }
            .player-invincible { animation: blink-invincible 0.1s linear infinite; }
            @keyframes blink-invincible { 50% { opacity: 0.5; } }
          `}</style>

           {/* --- Rendering based on Game Phase --- */}
           {gamePhase === GamePhase.PRELOAD && <PreloadScreen onStart={handleStartGame} />}

           {(gamePhase === GamePhase.DIALOGUE || gamePhase === GamePhase.INTERMISSION_DIALOGUE || gamePhase === GamePhase.BATTLE || gamePhase === GamePhase.COMMAND_SELECTION || gamePhase === GamePhase.GAMEOVER) && (
             <>
               <div className="mb-1 relative flex flex-col items-center">
                 <EnemyCharacter />
                 <DialogueBox text={displayedDialogue} show={showDialogue && gamePhase !== GamePhase.COMMAND_SELECTION} />
               </div>
               <div ref={battleBoxRef} className="relative border-2 border-white overflow-hidden bg-black mt-2" style={{ width: `${BATTLE_BOX_WIDTH}px`, height: `${BATTLE_BOX_HEIGHT}px` }} tabIndex={0}>
                  {gamePhase !== GamePhase.GAMEOVER && gamePhase !== GamePhase.COMMAND_SELECTION && <Player position={battlePlayerPosition} isInvincible={isInvincible} />}
                  {/* 戦闘中のみ攻撃を描画 */}
                  {gamePhase === GamePhase.BATTLE && attacks.map((attack) => <AttackRenderer key={attack.id} attack={attack} /> )}
                  {gamePhase === GamePhase.GAMEOVER && <GameOverScreen onRestart={resetGame} />}
              </div>
               <UIElements
                    hp={hp}
                    // ★★★ 変更点: currentAttack が null の場合のフォールバック ★★★
                    currentAttackName={currentAttack?.name ?? (gamePhase === GamePhase.BATTLE ? '読み込み中...' : '---')}
                    attackTimer={attackTimer}
                    battleTimeRemaining={battleTimeRemaining}
                    isBattle={gamePhase === GamePhase.BATTLE}
                    isCommandSelection={gamePhase === GamePhase.COMMAND_SELECTION}
                />
               <ActionButtons
                    disabled={gamePhase !== GamePhase.COMMAND_SELECTION}
                    onCommand={handleCommandSelection}
                />
             </>
           )}
        </div>
    </ErrorBoundary>
  );
};

export default App;


