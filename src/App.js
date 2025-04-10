import React, { useState, useEffect, useRef, useCallback } from 'react';
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
const DVD_LOGO_SIZE = 30;
const DVD_LOGO_SPEED = 2.5 * 60; // ピクセル/秒
const ATTACK_EFFECT_DURATION = 300; // ms 攻撃エフェクト表示時間

// --- 攻撃パターン定義 ---
const ATTACK_PATTERNS = [
    { name: '横方向の骨', duration: 4500, type: 'BONES_HORIZONTAL' },
    { name: '縦方向の骨', duration: 4500, type: 'BONES_VERTICAL' },
    { name: 'ゲスターブラスター', duration: 6000, type: 'GASTER_BLASTER' },
    // { name: '左右分割リフト', duration: 8000, type: 'SPLIT_LIFTS' }, // 無効化中
    { name: 'DVDロゴ', duration: 10000, type: 'DVD_LOGO' },
];

// --- セリフ定義 ---
const DIALOGUE_LINES = [ /* ... */ ];
const INTERMISSION_DIALOGUE_LINES = [ /* ... */ ];
// ★★★ 追加: Pルートエンディング用セリフ ★★★
const SPARE_ENDING_DIALOGUE = [
    "Thank you. I lost my sanity after being betrayed by memecoins… but your project is the one I'll stand by till the end."
];


// --- ゲームフェーズ定義 ---
// ★★★ 変更点: エンディングフェーズを追加 ★★★
const GamePhase = {
    PRELOAD: '準備中',
    DIALOGUE: '会話',
    BATTLE: '戦闘',
    INTERMISSION_DIALOGUE: '幕間会話',
    COMMAND_SELECTION: 'コマンド選択',
    ENDING_G: 'Gルートエンディング', // ← 追加
    ENDING_P: 'Pルートエンディング', // ← 追加
    GAMEOVER: 'ゲームオーバー'
};

// --- 初期状態 ---
// ★★★ 変更点: 攻撃エフェクト用のステートを追加 ★★★
const getInitialState = () => ({
    gamePhase: GamePhase.PRELOAD,
    showDialogue: false,
    displayedDialogue: "",
    currentLineIndex: 0,
    battlePlayerPosition: { x: BATTLE_BOX_WIDTH / 2 - PLAYER_SIZE / 2, y: BATTLE_BOX_HEIGHT / 2 - PLAYER_SIZE / 2 },
    hp: INITIAL_HP,
    currentAttackPatternIndex: 0,
    attackTimer: ATTACK_PATTERNS.length > 0 ? ATTACK_PATTERNS[0].duration / 1000 : 0,
    attacks: [],
    isOutsideBounds: false,
    battleTimeRemaining: BATTLE_DURATION_SECONDS,
    isInvincible: false,
    nextAttackIndex: null,
    attackEffect: { visible: false, x: 0, y: 0 }, // ← 追加
});

// --- エラーバウンダリコンポーネント ---
class ErrorBoundary extends React.Component { /* ... */ }

// ============================================================================
// --- UI サブコンポーネント定義 (UI Sub-Components) ---
// ============================================================================
const Player = React.memo(({ position, isInvincible }) => ( /* ... */ ));
const AttackRenderer = React.memo(({ attack }) => { /* ... */ });
const DialogueBox = React.memo(({ text, show }) => ( /* ... */ ));
const GameOverScreen = React.memo(({ onRestart }) => ( /* ... */ ));

// ★★★ 変更点: コマンド選択フェーズのボタン有効/無効を制御 ★★★
const ActionButtons = React.memo(({ disabled, onCommand, gamePhase }) => {
    const isCommandPhase = gamePhase === GamePhase.COMMAND_SELECTION;
    return (
        <div className="mt-6 flex space-x-4">
            {['たたかう', 'こうどう', 'アイテム', 'みのがす'].map((label) => {
                // コマンド選択フェーズ以外、または「こうどう」「アイテム」は無効
                const isDisabled = disabled || (isCommandPhase && (label === 'こうどう' || label === 'アイテム'));
                return (
                    <button
                        key={label}
                        className="bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 px-6 rounded-md text-xl shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isDisabled}
                        onClick={() => onCommand(label)}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
});
const UIElements = React.memo(({ hp, currentAttackName, attackTimer, battleTimeRemaining, isBattle, isCommandSelection }) => ( /* ... */ ));
const EnemyCharacter = React.memo(() => ( /* ... */ ));
const PreloadScreen = React.memo(({ onStart }) => ( /* ... */ ));

// ★★★ 追加: 攻撃エフェクト用コンポーネント ★★★
const AttackEffect = React.memo(({ effect }) => {
    if (!effect.visible) return null;
    return (
        <div
            className="attack-effect"
            style={{
                left: `${effect.x}px`,
                top: `${effect.y}px`,
            }}
        />
    );
});

// ============================================================================
// --- メインアプリケーションコンポーネント (Main App Component) ---
// ============================================================================
const App = () => {
  // --- State & Refs ---
  const [gameState, setGameState] = useState(getInitialState());
  // ★★★ 変更点: attackEffect をステートから取得 ★★★
  const { gamePhase, showDialogue, displayedDialogue, currentLineIndex, battlePlayerPosition, hp, currentAttackPatternIndex, attackTimer, attacks, isOutsideBounds, battleTimeRemaining, isInvincible, nextAttackIndex, attackEffect } = gameState;
  const currentAttack = ATTACK_PATTERNS.length > 0 ? ATTACK_PATTERNS[currentAttackPatternIndex] : null;
  const requestRef = useRef(); const lastUpdateTimeRef = useRef(0); const pressedKeys = useRef({});
  const spawnIntervalRef = useRef(null); const nextPatternTimeoutRef = useRef(null); const attackTimerIntervalRef = useRef(null); const boundaryDamageTimerRef = useRef(null);
  const typewriterIntervalRef = useRef(null); const nextLineTimeoutRef = useRef(null);
  const synthRef = useRef(null); const bgmLoopRef = useRef(null); const typingSynthRef = useRef(null);
  // ★★★ 追加: ファンファーレ用シンセの Ref ★★★
  const fanfareSynthRef = useRef(null);
  const toneStarted = useRef(false);
  const gamePhaseRef = useRef(gamePhase); const battleBoxRef = useRef(null); const playerPositionRef = useRef(gameState.battlePlayerPosition); const playerHitInLastFrame = useRef(false); const battleTimerIntervalRef = useRef(null);
  const invincibilityTimerRef = useRef(null);
  const nextLiftSideRef = useRef('left');
  const attackEffectTimeoutRef = useRef(null); // 攻撃エフェクト用タイマー

  // --- Core Logic Callbacks (Memoized) ---
  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { playerPositionRef.current = battlePlayerPosition; }, [battlePlayerPosition]);
  const checkBattleCollision = useCallback((player, attack) => { /* ... */ }, []);
  const endInvincibility = useCallback(() => { /* ... */ }, []);
  const applyDamage = useCallback((amount) => { /* ... */ }, [endInvincibility]);
  const spawnAttack = useCallback(() => { /* ... */ }, [gameState.currentAttackPatternIndex]);

  // Game Loop
  const gameLoop = useCallback((timestamp) => {
    // ★★★ 変更点: エンディング中もループ停止 ★★★
    if (gamePhaseRef.current === GamePhase.PRELOAD || gamePhaseRef.current === GamePhase.GAMEOVER || gamePhaseRef.current === GamePhase.COMMAND_SELECTION || gamePhaseRef.current === GamePhase.ENDING_G || gamePhaseRef.current === GamePhase.ENDING_P) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
        return;
    }
    // ...(ループ処理、変更なし)...
    if (!lastUpdateTimeRef.current) lastUpdateTimeRef.current = timestamp;
    const deltaTime = timestamp - lastUpdateTimeRef.current;
    if (deltaTime > 100) {
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
        if (prev.gamePhase === GamePhase.COMMAND_SELECTION || prev.gamePhase === GamePhase.ENDING_G || prev.gamePhase === GamePhase.ENDING_P) return prev; // エンディング中も更新停止

        const currentlyInvincible = prev.isInvincible;
        let newState = { ...prev };
        let newBattlePlayerPosition;

        // Player Movement
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

        // Attack Update & Collision
        let updatedAttacks = [];
        if (prev.gamePhase === GamePhase.BATTLE || prev.gamePhase === GamePhase.INTERMISSION_DIALOGUE) {
            updatedAttacks = prev.attacks.map(a => {
                let ua = { ...a };
                switch (a.type) {
                    case 'bone': if (prev.gamePhase === GamePhase.BATTLE) ua.x += ua.speed * deltaSeconds; break;
                    case 'bone_v': if (prev.gamePhase === GamePhase.BATTLE) ua.y += ua.speed * deltaSeconds; break;
                    case 'platform': if (prev.gamePhase === GamePhase.BATTLE) ua.y += ua.speed * deltaSeconds; break;
                    case 'dvd_logo':
                        ua.x += ua.vx * deltaSeconds; ua.y += ua.vy * deltaSeconds;
                        if (ua.x <= 0) { ua.vx = Math.abs(ua.vx); ua.x = 0; }
                        else if (ua.x + ua.width >= BATTLE_BOX_WIDTH) { ua.vx = -Math.abs(ua.vx); ua.x = BATTLE_BOX_WIDTH - ua.width; }
                        if (ua.y <= 0) { ua.vy = Math.abs(ua.vy); ua.y = 0; }
                        else if (ua.y + ua.height >= BATTLE_BOX_HEIGHT) { ua.vy = -Math.abs(ua.vy); ua.y = BATTLE_BOX_HEIGHT - ua.height; }
                        break;
                    default: break;
                }
                if (prev.gamePhase === GamePhase.BATTLE) { // Gaster処理は戦闘中のみ
                    if (a.lifetime !== undefined) { ua.lifetime -= deltaTime; if (ua.lifetime <= 0) attacksToRemoveThisFrame.add(a.id); }
                    if (a.warnTimer !== undefined) {
                        ua.warnTimer -= deltaTime;
                        if (ua.warnTimer <= 0 && !attacksToRemoveThisFrame.has(a.id)) {
                            attacksToRemoveThisFrame.add(a.id);
                            let bx, by, bw, bh;
                            if (a.orientation === 'h') { bw = BATTLE_BOX_WIDTH; bh = GASTER_WIDTH; by = a.y + a.height/2 - bh/2; bx = 0; }
                            else { bh = BATTLE_BOX_HEIGHT; bw = GASTER_WIDTH; bx = a.x + a.width/2 - bw/2; by = 0; }
                            attacksToAddThisFrame.push({ id: a.id + '_beam', type: 'gaster_beam', x: bx, y: by, width: bw, height: bh, lifetime: GASTER_BEAM_DURATION, color: 'white' });
                        }
                    }
                }
                return ua;
            });
            if (prev.gamePhase === GamePhase.BATTLE) { // 画面外削除と衝突判定は戦闘中のみ
                updatedAttacks.forEach(a => { if (a.type !== 'gaster_warning' && a.type !== 'gaster_beam' && a.type !== 'dvd_logo') { if (a.x + a.width < -50 || a.x > BATTLE_BOX_WIDTH + 50 || a.y + a.height < -50 || a.y > BATTLE_BOX_HEIGHT + 50) { attacksToRemoveThisFrame.add(a.id); } } });
                const playerRect = { x: newBattlePlayerPosition.x, y: newBattlePlayerPosition.y };
                let finalAttacks = [];
                for (const attack of updatedAttacks) {
                    if (attacksToRemoveThisFrame.has(attack.id)) continue;
                    if (!currentlyInvincible && !hitDetectedThisFrame && checkBattleCollision(playerRect, attack)) {
                        hitDetectedThisFrame = true;
                        if (attack.type !== 'gaster_beam' && attack.type !== 'dvd_logo') { attacksToRemoveThisFrame.add(attack.id); continue; }
                    }
                    finalAttacks.push(attack);
                }
                newState.attacks = [...finalAttacks.filter(a => !attacksToRemoveThisFrame.has(a.id)), ...attacksToAddThisFrame];
            } else { // 幕間
                 newState.attacks = updatedAttacks.filter(a => !attacksToRemoveThisFrame.has(a.id));
            }
        } else { newState.attacks = prev.attacks; }

        playerHitInLastFrame.current = hitDetectedThisFrame;
        const outside = newBattlePlayerPosition.x < 0 || newBattlePlayerPosition.x + PLAYER_SIZE > BATTLE_BOX_WIDTH || newBattlePlayerPosition.y < 0 || newBattlePlayerPosition.y + PLAYER_SIZE > BATTLE_BOX_HEIGHT;
        newState.isOutsideBounds = outside;
        return newState;
    });

    if (playerHitInLastFrame.current && gamePhaseRef.current === GamePhase.BATTLE) { applyDamage(DAMAGE_AMOUNT); }
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [applyDamage, checkBattleCollision]);


  // --- Audio Setup and Control ---
  // ★★★ 変更点: ファンファーレ用シンセを追加 ★★★
  const setupAudio = useCallback(() => {
    synthRef.current = new Tone.Synth({ oscillator: { type: 'pulse', width: 0.5 }, envelope: { attack: 0.01, decay: 0.08, sustain: 0.1, release: 0.2 }, volume: -16 }).toDestination();
    typingSynthRef.current = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.05 }, volume: -22 }).toDestination();
    // ファンファーレ用の簡単なシンセ
    fanfareSynthRef.current = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.4 },
        volume: -10
    }).toDestination();

    const notes = [ "C3", null, "E3", "G3", "C3", null, "E3", "G3", "A2", null, "C3", "E3", "A2", null, "C3", "E3", "F2", null, "A2", "C3", "F2", null, "A2", "C3", "G2", null, "B2", "D3", "G2", "B2", "D3", "G2" ];
    if (bgmLoopRef.current) bgmLoopRef.current.dispose(); // 再生成前にクリア
    bgmLoopRef.current = new Tone.Sequence((time, note) => { if (note && synthRef.current) { synthRef.current.triggerAttackRelease(note, "16n", time); } }, notes, "16n").start(0);
    bgmLoopRef.current.loop = true; Tone.Transport.bpm.value = 104;
   }, []);
  const startAudio = useCallback(async () => { /* ... */ }, [setupAudio]);
  // ★★★ 変更点: ファンファーレシンセも破棄 ★★★
  const stopAudio = useCallback(() => {
      if (Tone.Transport.state === 'started') { Tone.Transport.stop(); }
      bgmLoopRef.current?.dispose();
      synthRef.current?.dispose();
      typingSynthRef.current?.dispose();
      fanfareSynthRef.current?.dispose(); // ← 追加
      bgmLoopRef.current = null; synthRef.current = null; typingSynthRef.current = null; fanfareSynthRef.current = null; // ← Refもクリア
      clearTimeout(invincibilityTimerRef.current);
   }, []);
  const playTypingSound = useCallback(() => { /* ... */ }, []);
  // ★★★ 追加: ファンファーレ再生関数 ★★★
  const playFanfare = useCallback(() => {
      if (fanfareSynthRef.current && Tone.context.state === 'running') {
          const now = Tone.now();
          fanfareSynthRef.current.triggerAttackRelease("C5", "8n", now);
          fanfareSynthRef.current.triggerAttackRelease("E5", "8n", now + Tone.Time("8n").toSeconds());
          fanfareSynthRef.current.triggerAttackRelease("G5", "4n", now + Tone.Time("8n").toSeconds() * 2);
      }
  }, []);


  // --- Dialogue Sequence Logic ---
  // ★★★ 変更点: カスタムセリフと終了後フェーズ遷移に対応 ★★★
  const typeNextLine = useCallback((customLines = null, onFinishedPhase = null) => {
      setGameState(prev => {
          const currentPhase = prev.gamePhase;
          // 通常のダイアログか、カスタムダイアログか判定
          const linesToUse = customLines ?? (currentPhase === GamePhase.INTERMISSION_DIALOGUE ? INTERMISSION_DIALOGUE_LINES : DIALOGUE_LINES);

          // 現在のフェーズがダイアログ表示中でなければ処理中断
          if (currentPhase !== GamePhase.DIALOGUE && currentPhase !== GamePhase.INTERMISSION_DIALOGUE && !customLines) {
               console.warn("typeNextLine called outside of a dialogue phase without custom lines.");
               return prev;
          }

          const lineIndex = prev.currentLineIndex;

          // 全ての行を表示し終えたか？
          if (lineIndex >= linesToUse.length) {
              clearInterval(typewriterIntervalRef.current); // タイピング停止
              clearTimeout(nextLineTimeoutRef.current); // 次行タイマー停止

              // 終了後のフェーズ遷移が指定されているか？ (エンディング用)
              if (onFinishedPhase) {
                  console.log(`Custom dialogue finished. Transitioning to ${onFinishedPhase}`);
                  return { ...prev, gamePhase: onFinishedPhase, showDialogue: false }; // 指定フェーズへ
              }
              // 通常のダイアログ終了処理
              else if (currentPhase === GamePhase.INTERMISSION_DIALOGUE) {
                  if (prev.nextAttackIndex === null || ATTACK_PATTERNS.length === 0 || prev.nextAttackIndex >= ATTACK_PATTERNS.length) {
                      console.warn("Intermission finished, but no valid next attack. Transitioning to command selection.");
                      return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, showDialogue: false, attacks: [] };
                  }
                  return { ...prev, gamePhase: GamePhase.BATTLE, showDialogue: false, currentAttackPatternIndex: prev.nextAttackIndex, nextAttackIndex: null };
              } else { // Initial dialogue finished
                  const initPos = { x: BATTLE_BOX_WIDTH / 2 - PLAYER_SIZE / 2, y: BATTLE_BOX_HEIGHT / 2 - PLAYER_SIZE / 2 };
                  playerPositionRef.current = initPos;
                  return { ...prev, gamePhase: GamePhase.BATTLE, showDialogue: false, battlePlayerPosition: initPos };
              }
          }

          // 次の行を表示
          const fullText = linesToUse[lineIndex];
          let charIndex = 0;

          clearInterval(typewriterIntervalRef.current);
          clearTimeout(nextLineTimeoutRef.current);

          typewriterIntervalRef.current = setInterval(() => {
              setGameState(currentInternalState => {
                  // フェーズが変わったらタイピング停止
                  // (注意: customLines を使っている場合は currentPhase の比較が適切か要検討だが、今回はエンディング専用なのでOK)
                  if (currentInternalState.gamePhase !== currentPhase && !customLines) {
                      clearInterval(typewriterIntervalRef.current);
                      return currentInternalState;
                  }
                  if (charIndex < fullText.length) {
                      if(currentInternalState.displayedDialogue.length < fullText.length) playTypingSound();
                      const nextDisplayed = fullText.substring(0, charIndex + 1);
                      charIndex++;
                      return { ...currentInternalState, displayedDialogue: nextDisplayed };
                  } else {
                      clearInterval(typewriterIntervalRef.current);
                      // 次の行へ (カスタムラインと終了フェーズ指定を引き継ぐ)
                      nextLineTimeoutRef.current = setTimeout(() => typeNextLine(customLines, onFinishedPhase), DELAY_BETWEEN_LINES);
                      return currentInternalState;
                  }
              });
          }, TYPEWRITER_SPEED);

          // 表示テキストをクリアし、行インデックスを進める
          return { ...prev, displayedDialogue: "", showDialogue: true, currentLineIndex: lineIndex + 1 };
      });
  }, [playTypingSound]); // playTypingSound は安定

  // ★★★ 変更点: カスタムセリフと終了後フェーズを受け取れるように ★★★
  const startDialogueSequence = useCallback((customLines = null, onFinishedPhase = null) => {
      console.log("Starting dialogue sequence...", customLines ? "Custom lines provided." : "");
      clearTimeout(nextLineTimeoutRef.current);
      clearInterval(typewriterIntervalRef.current);
      // 行インデックスをリセットして開始
      setGameState(prev => ({ ...prev, currentLineIndex: 0, displayedDialogue: "", showDialogue: true }));
      // typeNextLine にパラメータを渡す
      typeNextLine(customLines, onFinishedPhase);
  }, [typeNextLine]);


  // --- Game Start & Reset Logic ---
  const resetGame = useCallback(() => { /* ... */ }, [stopAudio]);
  const handleStartGame = useCallback(async () => { /* ... */ }, [startAudio]);


  // --- Keyboard Handlers ---
  const handleKeyDown = useCallback((event) => { /* ... */ }, []);
  const handleKeyUp = useCallback((event) => { /* ... */ }, []);

  // --- Attack Pattern Switching Logic ---
  const switchToNextPattern = useCallback(() => { /* ... (変更なし) ... */ }, [spawnAttack]);

   // --- 戦闘開始処理 ---
   const startBattle = useCallback(() => { /* ... (変更なし) ... */ }, [spawnAttack, switchToNextPattern, gameLoop]);


  // --- Effects ---
  useEffect(() => { /* Keyboard Listener */ }, [handleKeyDown, handleKeyUp]);

  // ★★★ 変更点: エンディングフェーズの処理を追加 ★★★
  useEffect(() => {
      const cleanup = () => {
          clearInterval(spawnIntervalRef.current); clearTimeout(nextPatternTimeoutRef.current); clearInterval(attackTimerIntervalRef.current); clearInterval(battleTimerIntervalRef.current);
          if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = null; }
          clearInterval(typewriterIntervalRef.current); clearTimeout(nextLineTimeoutRef.current); clearTimeout(invincibilityTimerRef.current); clearTimeout(attackEffectTimeoutRef.current); // エフェクトタイマーもクリア
          spawnIntervalRef.current = null; nextPatternTimeoutRef.current = null; attackTimerIntervalRef.current = null; battleTimerIntervalRef.current = null; typewriterIntervalRef.current = null; nextLineTimeoutRef.current = null; invincibilityTimerRef.current = null; attackEffectTimeoutRef.current = null;
      };

      console.log(`Phase changed TO ${gamePhase}. Setting up...`);
      cleanup();

      switch (gamePhase) {
          case GamePhase.PRELOAD: stopAudio(); break;
          case GamePhase.DIALOGUE:
              lastUpdateTimeRef.current = 0; if (!requestRef.current) requestRef.current = requestAnimationFrame(gameLoop);
              startDialogueSequence(); // 通常の開始セリフ
              setTimeout(() => battleBoxRef.current?.focus(), 0);
              if (Tone.Transport.state !== 'started' && toneStarted.current) Tone.Transport.start();
              break;
          case GamePhase.INTERMISSION_DIALOGUE:
              if (!requestRef.current) { lastUpdateTimeRef.current = 0; requestRef.current = requestAnimationFrame(gameLoop); }
              startDialogueSequence(); // 幕間セリフ
              setTimeout(() => battleBoxRef.current?.focus(), 0);
              break;
          case GamePhase.BATTLE: startBattle(); break;
          case GamePhase.COMMAND_SELECTION:
              console.log("Entered COMMAND_SELECTION phase. Waiting for command.");
              if (Tone.Transport.state !== 'started' && toneStarted.current) { Tone.Transport.start(); }
              // このフェーズではタイマーやループは不要
              break;
          case GamePhase.ENDING_G: // Gルートエンディング
              console.log("Entered ENDING_G phase.");
              stopAudio(); // BGM停止
              // 最終メッセージ表示 (タイプライターなしで直接表示)
              setGameState(prev => ({ ...prev, showDialogue: true, displayedDialogue: "Gルート エンディング" }));
              break;
          case GamePhase.ENDING_P: // Pルートエンディング
              console.log("Entered ENDING_P phase.");
               stopAudio(); // BGM停止
               // 最終メッセージ表示 (タイプライターなしで直接表示)
              setGameState(prev => ({ ...prev, showDialogue: true, displayedDialogue: "Pルート エンディング" }));
              break;
          case GamePhase.GAMEOVER:
              stopAudio();
              break;
          default: break;
      }
      return cleanup;
  }, [gamePhase, startBattle, stopAudio, gameLoop, startDialogueSequence]); // 依存配列は変更なし

   useEffect(() => { /* Audio Cleanup */ return () => { stopAudio(); toneStarted.current = false; }; }, [stopAudio]);

   // --- コマンド選択処理 ---
   // ★★★ 変更点: エンディングへの分岐処理を実装 ★★★
   const handleCommandSelection = useCallback((command) => {
        if (gameState.gamePhase !== GamePhase.COMMAND_SELECTION) return;

        console.log(`Command selected: ${command}`);

        if (command === 'たたかう') {
            // 攻撃エフェクト表示 (敵キャラの位置に)
            // 敵キャラのおおよその中心位置を計算 (EnemyCharacterコンポーネントのサイズに依存)
            const enemyCenterX = BATTLE_BOX_WIDTH / 2; // 仮。正確にはEnemyCharacterの位置を取得したい
            const enemyCenterY = 50; // 仮。Y座標も同様
            setGameState(prev => ({
                ...prev,
                attackEffect: { visible: true, x: enemyCenterX, y: enemyCenterY }
            }));
            // 短時間でエフェクトを消す
            clearTimeout(attackEffectTimeoutRef.current); // 既存のタイマーをクリア
            attackEffectTimeoutRef.current = setTimeout(() => {
                setGameState(prev => ({ ...prev, attackEffect: { ...prev.attackEffect, visible: false } }));
            }, ATTACK_EFFECT_DURATION);

            playFanfare(); // ファンファーレ再生
            // Gルートエンディングへ移行
            setGameState(prev => ({ ...prev, gamePhase: GamePhase.ENDING_G }));

        } else if (command === 'みのがす') {
            playFanfare(); // ファンファーレ再生
            // Pルート用セリフを開始し、終了後に ENDING_P フェーズへ移行
            startDialogueSequence(SPARE_ENDING_DIALOGUE, GamePhase.ENDING_P);
        }
        // 他のコマンドは何もしない

   }, [gameState.gamePhase, playFanfare, startDialogueSequence]); // 依存関係に playFanfare, startDialogueSequence を追加


  // --- Rendering ---
  return (
    <ErrorBoundary>
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono select-none p-4">
          {/* スタイル定義 */}
          {/* ★★★ 追加: 攻撃エフェクト用のスタイル ★★★ */}
          <style>{`
            /* ...(既存スタイル)... */
            .pixelated { image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges; }
            body { font-family: 'Courier New', Courier, monospace; background-color: black; }
            button:focus, [tabindex="0"]:focus { outline: 2px solid orange; outline-offset: 2px; }
            .dialogue-container { position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 180px; z-index: 20; opacity: ${showDialogue ? 1 : 0}; transition: opacity 0.3s ease-in-out; pointer-events: ${showDialogue ? 'auto' : 'none'}; } /* コマンド選択中も表示されるように条件削除 */
            .dialogue-box { background-color: white; color: black; border: 2px solid black; padding: 10px 12px; border-radius: 4px; font-size: 0.9rem; line-height: 1.4; text-align: left; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-family: "Comic Sans MS", sans-serif; min-height: 1.4em; overflow-wrap: break-word; }
            .dialogue-box::after { content: ''; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 12px solid white; }
            .dialogue-box p::after { content: '_'; font-family: "Comic Sans MS", sans-serif; opacity: ${showDialogue && gamePhase !== GamePhase.ENDING_G && gamePhase !== GamePhase.ENDING_P ? 1 : 0}; animation: blink 1s step-end infinite; margin-left: 1px; } /* エンディングではカーソル非表示 */
            @keyframes blink { 50% { opacity: 0; } }
            .attack-bone { position: absolute; background-color: white; clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
            .attack-platform { position: absolute; background-color: #60a5fa; border: 1px solid #2563eb; }
            .gaster-warning { position: absolute; border: 2px dashed rgba(255, 255, 255, 0.7); box-sizing: border-box; z-index: 15; animation: blink-warning 0.2s linear infinite alternate; }
            @keyframes blink-warning { 0% { border-color: rgba(255, 255, 255, 0.7); } 100% { border-color: rgba(255, 255, 255, 0.2); } }
            .gaster-beam { position: absolute; background-color: rgba(255, 255, 255, 0.9); box-shadow: 0 0 10px 5px rgba(255, 255, 255, 0.5); z-index: 5; }
            .attack-dvd-logo { position: absolute; border: 1px solid rgba(255, 255, 255, 0.5); box-shadow: 0 0 5px rgba(255, 255, 255, 0.3); }
            .attack-effect { /* 攻撃エフェクトのスタイル */
                position: absolute;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background-color: rgba(255, 255, 255, 0.8);
                transform: translate(-50%, -50%) scale(0); /* 中央揃え + 初期サイズ0 */
                animation: attack-burst ${ATTACK_EFFECT_DURATION}ms ease-out forwards;
                z-index: 10;
            }
            @keyframes attack-burst {
                0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
                70% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.5; }
                100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
            @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
            .game-title { font-family: 'Press Start 2P', cursive; color: white; text-shadow: 2px 2px #555; }
            .player-invincible { animation: blink-invincible 0.1s linear infinite; }
            @keyframes blink-invincible { 50% { opacity: 0.5; } }
          `}</style>

           {/* --- Rendering based on Game Phase --- */}
           {gamePhase === GamePhase.PRELOAD && <PreloadScreen onStart={handleStartGame} />}

           {/* ★★★ 変更点: エンディングフェーズも考慮 ★★★ */}
           {(gamePhase === GamePhase.DIALOGUE || gamePhase === GamePhase.INTERMISSION_DIALOGUE || gamePhase === GamePhase.BATTLE || gamePhase === GamePhase.COMMAND_SELECTION || gamePhase === GamePhase.ENDING_G || gamePhase === GamePhase.ENDING_P || gamePhase === GamePhase.GAMEOVER) && (
             <>
               <div className="mb-1 relative flex flex-col items-center">
                 <EnemyCharacter />
                 {/* ★★★ 変更点: 攻撃エフェクトを描画 ★★★ */}
                 <AttackEffect effect={attackEffect} />
                 <DialogueBox text={displayedDialogue} show={showDialogue} /> {/* ダイアログはエンディングでも表示 */}
               </div>
               {/* ★★★ 変更点: バトルボックスはエンディング以外で表示 ★★★ */}
               {(gamePhase === GamePhase.DIALOGUE || gamePhase === GamePhase.INTERMISSION_DIALOGUE || gamePhase === GamePhase.BATTLE || gamePhase === GamePhase.COMMAND_SELECTION || gamePhase === GamePhase.GAMEOVER) && (
                   <div ref={battleBoxRef} className="relative border-2 border-white overflow-hidden bg-black mt-2" style={{ width: `${BATTLE_BOX_WIDTH}px`, height: `${BATTLE_BOX_HEIGHT}px` }} tabIndex={0}>
                      {/* プレイヤー表示 (エンディング/ゲームオーバー/コマンド選択以外) */}
                      {gamePhase !== GamePhase.GAMEOVER && gamePhase !== GamePhase.COMMAND_SELECTION && gamePhase !== GamePhase.ENDING_G && gamePhase !== GamePhase.ENDING_P && <Player position={battlePlayerPosition} isInvincible={isInvincible} />}
                      {/* 攻撃描画 (戦闘中と幕間) */}
                      {(gamePhase === GamePhase.BATTLE || gamePhase === GamePhase.INTERMISSION_DIALOGUE) && attacks.map((attack) => <AttackRenderer key={attack.id} attack={attack} /> )}
                      {/* ゲームオーバー画面 */}
                      {gamePhase === GamePhase.GAMEOVER && <GameOverScreen onRestart={resetGame} />}
                  </div>
               )}
               {/* ★★★ 変更点: UI要素はエンディング以外で表示 ★★★ */}
               {(gamePhase === GamePhase.DIALOGUE || gamePhase === GamePhase.INTERMISSION_DIALOGUE || gamePhase === GamePhase.BATTLE || gamePhase === GamePhase.COMMAND_SELECTION || gamePhase === GamePhase.GAMEOVER) && (
                   <UIElements
                        hp={hp}
                        currentAttackName={currentAttack?.name ?? (gamePhase === GamePhase.BATTLE ? '読み込み中...' : '---')}
                        attackTimer={attackTimer}
                        battleTimeRemaining={battleTimeRemaining}
                        isBattle={gamePhase === GamePhase.BATTLE}
                        isCommandSelection={gamePhase === GamePhase.COMMAND_SELECTION}
                    />
               )}
               {/* ★★★ 変更点: アクションボタンはコマンド選択中のみ表示・操作可能 ★★★ */}
               {(gamePhase === GamePhase.COMMAND_SELECTION) && (
                   <ActionButtons
                        // disabled は常に false (ボタンごとの制御は内部で行う)
                        disabled={false}
                        onCommand={handleCommandSelection}
                        gamePhase={gamePhase} // フェーズを渡す
                    />
               )}
             </>
           )}
        </div>
    </ErrorBoundary>
  );
};

export default App;


