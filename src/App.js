import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone'; // Namespace import

// ============================================================================
// --- 定数定義 (Constants) ---
// ============================================================================
// ... (定数定義は変更なし) ...
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
const PLAYER_IMAGE_URL = "https://i.imgur.com/DN1tHyO.png"; // 19x19 px image
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
const DIALOGUE_LINES = [
    "it’s a beautiful day outside.",
    "bulls are raging, bears are crying...",
    "on days like these, projects like you...",
    "Should go to the moon."
];
const INTERMISSION_DIALOGUE_LINES = [
    "*Huff... puff...*",
    "PEPE seems tired of trading memecoins."
];
const SPARE_ENDING_DIALOGUE = [
    "Thank you. I lost my sanity after being betrayed by memecoins… but your project is the one I'll stand by till the end."
];


// --- ゲームフェーズ定義 ---
const GamePhase = {
    PRELOAD: '準備中',
    DIALOGUE: '会話',
    BATTLE: '戦闘',
    INTERMISSION_DIALOGUE: '幕間会話',
    COMMAND_SELECTION: 'コマンド選択',
    ENDING_G: 'Gルートエンディング',
    ENDING_P: 'Pルートエンディング',
    GAMEOVER: 'ゲームオーバー'
};

// --- 初期状態 ---
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
    attackEffect: { visible: false, x: 0, y: 0 },
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
const ActionButtons = React.memo(({ disabled, onCommand, gamePhase }) => { /* ... */ });
const UIElements = React.memo(({ hp, currentAttackName, attackTimer, battleTimeRemaining, isBattle, isCommandSelection }) => ( /* ... */ ));
const EnemyCharacter = React.memo(() => ( /* ... */ ));
const PreloadScreen = React.memo(({ onStart }) => ( <div className="text-center"> <img src={ENEMY_IMAGE_URL} alt="敵キャラクター" className="w-32 h-32 object-contain pixelated mx-auto mb-4" onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/100x100/000000/FF0000?text=画像読込失敗"; }} /> <h1 className="text-4xl mb-6 game-title">SUPER TALE</h1> <button onClick={onStart} className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-8 rounded-md text-2xl shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-300"> クリックして開始 </button> <p className="mt-4 text-sm text-gray-400">(クリックでオーディオを開始し、ゲームを始めます)</p> <p className="mt-2 text-xs text-gray-500"> ★ BGMが鳴ります ★<br/> ★ Requires: Tailwind, Tone.js, Lucide-React ★ </p> </div> ));
const AttackEffect = React.memo(({ effect }) => { /* ... */ });

// ============================================================================
// --- メインアプリケーションコンポーネント (Main App Component) ---
// ============================================================================
const App = () => {
  // --- State & Refs ---
  const [gameState, setGameState] = useState(getInitialState());
  const { gamePhase, showDialogue, displayedDialogue, currentLineIndex, battlePlayerPosition, hp, currentAttackPatternIndex, attackTimer, attacks, isOutsideBounds, battleTimeRemaining, isInvincible, nextAttackIndex, attackEffect } = gameState;
  const currentAttack = ATTACK_PATTERNS.length > 0 ? ATTACK_PATTERNS[currentAttackPatternIndex] : null;
  const requestRef = useRef(); const lastUpdateTimeRef = useRef(0); const pressedKeys = useRef({});
  const spawnIntervalRef = useRef(null); const nextPatternTimeoutRef = useRef(null); const attackTimerIntervalRef = useRef(null); const boundaryDamageTimerRef = useRef(null);
  const typewriterIntervalRef = useRef(null); const nextLineTimeoutRef = useRef(null);
  const synthRef = useRef(null); const bgmLoopRef = useRef(null); const typingSynthRef = useRef(null);
  const fanfareSynthRef = useRef(null);
  const toneStarted = useRef(false);
  const gamePhaseRef = useRef(gamePhase); const battleBoxRef = useRef(null); const playerPositionRef = useRef(gameState.battlePlayerPosition); const playerHitInLastFrame = useRef(false); const battleTimerIntervalRef = useRef(null);
  const invincibilityTimerRef = useRef(null);
  const nextLiftSideRef = useRef('left');
  const attackEffectTimeoutRef = useRef(null);

  // --- Core Logic Callbacks (Memoized) ---
  useEffect(() => { gamePhaseRef.current = gamePhase; }, [gamePhase]);
  useEffect(() => { playerPositionRef.current = battlePlayerPosition; }, [battlePlayerPosition]);
  const checkBattleCollision = useCallback((player, attack) => { /* ... */ }, []);
  const endInvincibility = useCallback(() => { /* ... */ }, []);
  const applyDamage = useCallback((amount) => { /* ... */ }, [endInvincibility]);
  const spawnAttack = useCallback(() => { /* ... */ }, [gameState.currentAttackPatternIndex]);
  const gameLoop = useCallback((timestamp) => { /* ... */ }, [applyDamage, checkBattleCollision]);
  const setupAudio = useCallback(() => { /* ... */ }, []);

  // ★★★ 変更点: startAudio にログ追加 ★★★
  const startAudio = useCallback(async () => {
    console.log("startAudio called. toneStarted.current:", toneStarted.current);
    if (!toneStarted.current) {
        try {
            console.log("Attempting Tone.start()...");
            await Tone.start();
            console.log("Tone.start() successful.");
            toneStarted.current = true;
            setupAudio(); // Setup synths after context is started
            console.log("Audio setup complete.");
            if (Tone.Transport.state !== 'started') {
                 console.log("Starting Tone.Transport...");
                 Tone.Transport.start();
                 console.log("Tone.Transport started.");
            }
        } catch (e) {
            console.error("Tone.jsの開始に失敗:", e);
            // Consider showing an error message to the user here
        }
    } else if (Tone.Transport.state !== 'started') {
        console.log("Tone already started, ensuring Transport is running...");
        Tone.Transport.start(); // Ensure transport is running if context was already started
        console.log("Tone.Transport started (was stopped).");
    } else {
        console.log("Audio already fully started.");
    }
   }, [setupAudio]); // setupAudio is stable

  const stopAudio = useCallback(() => { /* ... */ }, []);
  const playTypingSound = useCallback(() => { /* ... */ }, []);
  const playFanfare = useCallback(() => { /* ... */ }, []);
  const typeNextLine = useCallback((customLines = null, onFinishedPhase = null) => { /* ... */ }, [playTypingSound]);

  // ★★★ 変更点: startDialogueSequence にログ追加 ★★★
  const startDialogueSequence = useCallback((customLines = null, onFinishedPhase = null) => {
      console.log("startDialogueSequence called.", customLines ? "Custom lines provided." : "Using default lines."); // デバッグログ追加
      clearTimeout(nextLineTimeoutRef.current);
      clearInterval(typewriterIntervalRef.current);
      setGameState(prev => ({ ...prev, currentLineIndex: 0, displayedDialogue: "", showDialogue: true }));
      typeNextLine(customLines, onFinishedPhase);
  }, [typeNextLine]);

  const resetGame = useCallback(() => { /* ... */ }, [stopAudio]);

  // ★★★ 変更点: handleStartGame にログ追加 ★★★
  const handleStartGame = useCallback(async () => {
    console.log("handleStartGame called."); // デバッグログ追加
    await startAudio(); // Wait for audio context to start (or attempt to)
    console.log("startAudio finished."); // デバッグログ追加
    // Check if audio actually started before proceeding
    if (toneStarted.current) {
        console.log("Setting game phase to DIALOGUE..."); // デバッグログ追加
        const initialState = getInitialState(); // Get fresh initial state values if needed
        playerPositionRef.current = initialState.battlePlayerPosition; // Sync ref
        // Reset necessary state for starting dialogue
        setGameState(prev => ({
             ...prev, // Keep HP etc. if needed, or use initialState for full reset
             gamePhase: GamePhase.DIALOGUE,
             showDialogue: true,
             currentLineIndex: 0, // Ensure dialogue starts from the beginning
             displayedDialogue: "", // Clear previous dialogue
             battlePlayerPosition: initialState.battlePlayerPosition, // Reset position
             attacks: [], // Clear any leftover attacks
             // Reset other relevant states if necessary
        }));
        console.log("Game phase set to DIALOGUE."); // デバッグログ追加
    } else {
        console.error("Audio context failed to start. Cannot start game.");
        // Optionally show an error message to the user
    }
  }, [startAudio]); // startAudio is stable

  const handleKeyDown = useCallback((event) => { /* ... */ }, []);
  const handleKeyUp = useCallback((event) => { /* ... */ }, []);
  const switchToNextPattern = useCallback(() => { /* ... */ }, []);
  const startBattle = useCallback(() => { /* ... */ }, [switchToNextPattern, gameLoop, spawnAttack]);

  // --- Effects ---
  useEffect(() => { window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); }; }, [handleKeyDown, handleKeyUp]);

  // ★★★ 変更点: useEffect[gamePhase] にログ追加 ★★★
  useEffect(() => {
      const cleanup = () => { /* ... */ };
      console.log(`Phase changed TO ${gamePhase}. Setting up...`); cleanup(); // デバッグログ追加
      switch (gamePhase) {
          case GamePhase.PRELOAD: stopAudio(); break;
          case GamePhase.DIALOGUE:
              console.log("useEffect detected DIALOGUE phase. Starting sequence..."); // デバッグログ追加
              lastUpdateTimeRef.current = 0; if (!requestRef.current) requestRef.current = requestAnimationFrame(gameLoop);
              startDialogueSequence(); // Start initial dialogue
              setTimeout(() => battleBoxRef.current?.focus(), 0);
              if (Tone.Transport.state !== 'started' && toneStarted.current) Tone.Transport.start();
              break;
          case GamePhase.INTERMISSION_DIALOGUE:
              console.log("useEffect detected INTERMISSION_DIALOGUE phase. Starting sequence..."); // デバッグログ追加
              if (!requestRef.current) { lastUpdateTimeRef.current = 0; requestRef.current = requestAnimationFrame(gameLoop); }
              startDialogueSequence(); // Start intermission dialogue
              setTimeout(() => battleBoxRef.current?.focus(), 0);
              break;
          case GamePhase.BATTLE: startBattle(); break;
          case GamePhase.COMMAND_SELECTION: console.log("Entered COMMAND_SELECTION phase. Waiting for command."); if (Tone.Transport.state !== 'started' && toneStarted.current) { Tone.Transport.start(); } break;
          case GamePhase.ENDING_G: console.log("Entered ENDING_G phase."); stopAudio(); setGameState(prev => ({ ...prev, showDialogue: true, displayedDialogue: "Gルート エンディング" })); break;
          case GamePhase.ENDING_P: console.log("Entered ENDING_P phase."); stopAudio(); setGameState(prev => ({ ...prev, showDialogue: true, displayedDialogue: "Pルート エンディング" })); break;
          case GamePhase.GAMEOVER: stopAudio(); break;
          default: break;
      }
      return cleanup;
  }, [gamePhase, startBattle, stopAudio, gameLoop, startDialogueSequence]);

   useEffect(() => { return () => { stopAudio(); toneStarted.current = false; }; }, [stopAudio]);
   const handleCommandSelection = useCallback((command) => { /* ... */ }, [gameState.gamePhase, playFanfare, startDialogueSequence]);

  // --- Rendering ---
  return (
    <ErrorBoundary>
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono select-none p-4">
          <style>{`
            /* ...(スタイル定義は変更なし)... */
            .pixelated { image-rendering: pixelated; image-rendering: -moz-crisp-edges; image-rendering: crisp-edges; } body { font-family: 'Courier New', Courier, monospace; background-color: black; } button:focus, [tabindex="0"]:focus { outline: 2px solid orange; outline-offset: 2px; }
            .dialogue-container { position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%); width: 180px; z-index: 20; opacity: ${showDialogue ? 1 : 0}; transition: opacity 0.3s ease-in-out; pointer-events: ${showDialogue ? 'auto' : 'none'}; }
            .dialogue-box { background-color: white; color: black; border: 2px solid black; padding: 10px 12px; border-radius: 4px; font-size: 0.9rem; line-height: 1.4; text-align: left; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-family: "Comic Sans MS", sans-serif; min-height: 1.4em; overflow-wrap: break-word; } .dialogue-box::after { content: ''; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-bottom: 12px solid white; } .dialogue-box p::after { content: '_'; font-family: "Comic Sans MS", sans-serif; opacity: ${showDialogue && gamePhase !== GamePhase.ENDING_G && gamePhase !== GamePhase.ENDING_P ? 1 : 0}; animation: blink 1s step-end infinite; margin-left: 1px; } @keyframes blink { 50% { opacity: 0; } }
            .attack-bone { position: absolute; background-color: white; clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); } .attack-platform { position: absolute; background-color: #60a5fa; border: 1px solid #2563eb; }
            .gaster-warning { position: absolute; border: 2px dashed rgba(255, 255, 255, 0.7); box-sizing: border-box; z-index: 15; animation: blink-warning 0.2s linear infinite alternate; } @keyframes blink-warning { 0% { border-color: rgba(255, 255, 255, 0.7); } 100% { border-color: rgba(255, 255, 255, 0.2); } } .gaster-beam { position: absolute; background-color: rgba(255, 255, 255, 0.9); box-shadow: 0 0 10px 5px rgba(255, 255, 255, 0.5); z-index: 5; } .attack-dvd-logo { position: absolute; border: 1px solid rgba(255, 255, 255, 0.5); box-shadow: 0 0 5px rgba(255, 255, 255, 0.3); }
            .attack-effect { position: absolute; width: 40px; height: 40px; border-radius: 50%; background-color: rgba(255, 255, 255, 0.8); transform: translate(-50%, -50%) scale(0); animation: attack-burst ${ATTACK_EFFECT_DURATION}ms ease-out forwards; z-index: 10; } @keyframes attack-burst { 0% { transform: translate(-50%, -50%) scale(0); opacity: 1; } 70% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.5; } 100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; } }
            @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'); .game-title { font-family: 'Press Start 2P', cursive; color: white; text-shadow: 2px 2px #555; } .player-invincible { animation: blink-invincible 0.1s linear infinite; } @keyframes blink-invincible { 50% { opacity: 0.5; } }
          `}</style>

           {gamePhase === GamePhase.PRELOAD && <PreloadScreen onStart={handleStartGame} />}

           {(gamePhase === GamePhase.DIALOGUE || gamePhase === GamePhase.INTERMISSION_DIALOGUE || gamePhase === GamePhase.BATTLE || gamePhase === GamePhase.COMMAND_SELECTION || gamePhase === GamePhase.ENDING_G || gamePhase === GamePhase.ENDING_P || gamePhase === GamePhase.GAMEOVER) && (
             <>
               <div className="mb-1 relative flex flex-col items-center">
                 <EnemyCharacter />
                 <AttackEffect effect={attackEffect} />
                 <DialogueBox text={displayedDialogue} show={showDialogue} />
               </div>
               {(gamePhase === GamePhase.DIALOGUE || gamePhase === GamePhase.INTERMISSION_DIALOGUE || gamePhase === GamePhase.BATTLE || gamePhase === GamePhase.COMMAND_SELECTION || gamePhase === GamePhase.GAMEOVER) && (
                   <div ref={battleBoxRef} className="relative border-2 border-white overflow-hidden bg-black mt-2" style={{ width: `${BATTLE_BOX_WIDTH}px`, height: `${BATTLE_BOX_HEIGHT}px` }} tabIndex={0}>
                      {gamePhase !== GamePhase.GAMEOVER && gamePhase !== GamePhase.COMMAND_SELECTION && gamePhase !== GamePhase.ENDING_G && gamePhase !== GamePhase.ENDING_P && <Player position={battlePlayerPosition} isInvincible={isInvincible} />}
                      {(gamePhase === GamePhase.BATTLE || gamePhase === GamePhase.INTERMISSION_DIALOGUE) && attacks.map((attack) => <AttackRenderer key={attack.id} attack={attack} /> )}
                      {gamePhase === GamePhase.GAMEOVER && <GameOverScreen onRestart={resetGame} />}
                  </div>
               )}
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
               {(gamePhase === GamePhase.COMMAND_SELECTION) && (
                   <ActionButtons
                        disabled={false}
                        onCommand={handleCommandSelection}
                        gamePhase={gamePhase}
                    />
               )}
             </>
           )}
        </div>
    </ErrorBoundary>
  );
};

export default App;





