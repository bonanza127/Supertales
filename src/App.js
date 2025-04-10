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
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error: error }; }
  componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo); this.setState({ errorInfo: errorInfo }); }
  render() { if (this.state.hasError) { return ( <div className="text-white bg-red-800 p-4 rounded-lg text-center"> <h1 className="text-2xl font-bold mb-2">エラーが発生しました。</h1> <p className="mb-1">申し訳ありませんが、ゲームの描画中に問題が発生しました。</p> <p className="text-sm text-red-200 mb-2">詳細: {this.state.error?.toString()}</p> <button onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })} className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">リセットして再試行</button> </div> ); } return this.props.children; }
}

// ============================================================================
// --- UI サブコンポーネント定義 (UI Sub-Components) ---
// ============================================================================
// ★★★ 変更点: Player画像にインラインスタイルで imageRendering を追加 ★★★
const Player = React.memo(({ position, isInvincible }) => (
    <img
        src={PLAYER_IMAGE_URL}
        alt="Player"
        className={`absolute ${isInvincible ? 'player-invincible' : ''} pixelated`} // pixelatedクラスは維持
        style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${PLAYER_SIZE}px`, // 20px
            height: `${PLAYER_SIZE}px`, // 20px
            imageRendering: 'pixelated', // CSSクラスに加えインラインでも指定
        }}
        onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/${PLAYER_SIZE}x${PLAYER_SIZE}/FF0000/FFFFFF?text=X`; }}
    />
));
const AttackRenderer = React.memo(({ attack }) => {
    switch(attack.type) {
        case 'gaster_warning': return <div key={attack.id} className="gaster-warning" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }}></div>;
        case 'gaster_beam': return <div key={attack.id} className="gaster-beam" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }}></div>;
        case 'bone': case 'bone_v': return ( <div key={attack.id} className="attack-bone" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }} /> );
        case 'platform': return ( <div key={attack.id} className="attack-platform" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }} /> );
        case 'dvd_logo': return ( <div key={attack.id} className="attack-dvd-logo" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px`, backgroundColor: attack.color || 'purple' }} /> );
        default: return null;
    }
});
const DialogueBox = React.memo(({ text, show }) => ( <div className="dialogue-container" style={{ opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none' }}> <div className="dialogue-box"> <p>{text}</p> </div> </div> ));
const GameOverScreen = React.memo(({ onRestart }) => ( <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-85 z-10"> <p className="text-4xl text-red-500 font-bold mb-4">GAME OVER</p> <button onClick={onRestart} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-md text-xl shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-300"> RESTART </button> </div> ));
const ActionButtons = React.memo(({ disabled, onCommand, gamePhase }) => {
    const isCommandPhase = gamePhase === GamePhase.COMMAND_SELECTION;
    return (
        <div className="mt-6 flex space-x-4">
            {['たたかう', 'こうどう', 'アイテム', 'みのがす'].map((label) => {
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
const UIElements = React.memo(({ hp, currentAttackName, attackTimer, battleTimeRemaining, isBattle, isCommandSelection }) => (
    <div className="mt-4 flex justify-between w-full px-4" style={{ maxWidth: `${BATTLE_BOX_WIDTH + 200}px` }}>
        <div className="flex items-center">
            <span className="mr-2 text-yellow-400 font-bold">HP</span>
            <div className="w-24 h-4 bg-gray-700 border border-white rounded-sm overflow-hidden">
                <div className="h-full bg-yellow-400 transition-width duration-300 ease-linear" style={{ width: `${Math.max(0, hp)}%` }}></div>
            </div>
            <span className="ml-2 text-white">{Math.max(0, hp)}/{INITIAL_HP}</span>
        </div>
        {isBattle && (
            <div className="text-right text-sm">
                <p>攻撃: {currentAttackName || '---'}</p>
                <p>次まで: {attackTimer}s</p>
                <p className="mt-1">残り時間: {battleTimeRemaining}s</p>
            </div>
        )}
        {isCommandSelection && (
            <div className="text-right text-sm text-yellow-400 font-bold">
                コマンド選択中...
            </div>
        )}
    </div>
));
const EnemyCharacter = React.memo(() => ( <img src={ENEMY_IMAGE_URL} alt="敵キャラクター" className="w-24 h-24 md:w-32 md:h-32 object-contain pixelated" onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/100x100/000000/FF0000?text=画像読込失敗"; }} /> ));
const PreloadScreen = React.memo(({ onStart }) => ( <div className="text-center"> <img src={ENEMY_IMAGE_URL} alt="敵キャラクター" className="w-32 h-32 object-contain pixelated mx-auto mb-4" onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/100x100/000000/FF0000?text=画像読込失敗"; }} /> <h1 className="text-4xl mb-6 game-title">SUPER TALE</h1> <button onClick={onStart} className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-8 rounded-md text-2xl shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-yellow-300"> クリックして開始 </button> <p className="mt-4 text-sm text-gray-400">(クリックでオーディオを開始し、ゲームを始めます)</p> <p className="mt-2 text-xs text-gray-500"> ★ BGMが鳴ります ★<br/> ★ Requires: Tailwind, Tone.js, Lucide-React ★ </p> </div> ));
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
  const startAudio = useCallback(async () => { /* ... */ }, [setupAudio]);
  const stopAudio = useCallback(() => { /* ... */ }, []);
  const playTypingSound = useCallback(() => { /* ... */ }, []);
  const playFanfare = useCallback(() => { /* ... */ }, []);
  const typeNextLine = useCallback((customLines = null, onFinishedPhase = null) => { /* ... */ }, [playTypingSound]);
  const startDialogueSequence = useCallback((customLines = null, onFinishedPhase = null) => { /* ... */ }, [typeNextLine]);
  const resetGame = useCallback(() => { /* ... */ }, [stopAudio]);
  const handleStartGame = useCallback(async () => { /* ... */ }, [startAudio]);
  const handleKeyDown = useCallback((event) => { /* ... */ }, []);
  const handleKeyUp = useCallback((event) => { /* ... */ }, []);

  // --- Attack Pattern Switching Logic ---
  // ★★★ 変更点: switchToNextPattern の依存配列から spawnAttack を削除 ★★★
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

          if (nextIndexRaw >= ATTACK_PATTERNS.length) {
              console.log("Last attack pattern finished. Transitioning to command selection.");
              clearInterval(spawnIntervalRef.current); spawnIntervalRef.current = null; // Stop spawning
              clearTimeout(nextPatternTimeoutRef.current); nextPatternTimeoutRef.current = null;
              clearInterval(attackTimerIntervalRef.current); attackTimerIntervalRef.current = null;
              return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] }; // Clear DVD logo too
          }

          const nextAttackPatternIndex = nextIndexRaw;
          const nextPattern = ATTACK_PATTERNS[nextAttackPatternIndex];

          if (!nextPattern) {
              console.error("Next pattern not found at index:", nextAttackPatternIndex);
              return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] };
          }

          let attacksToAdd = [];
          if (nextPattern.type === 'DVD_LOGO') {
              if (!prev.attacks.some(a => a.type === 'dvd_logo')) {
                  let angle = Math.random() * Math.PI * 2;
                  while (Math.abs(Math.cos(angle)) < 0.1 || Math.abs(Math.sin(angle)) < 0.1) { angle = Math.random() * Math.PI * 2; }
                  const initialVx = DVD_LOGO_SPEED * Math.cos(angle);
                  const initialVy = DVD_LOGO_SPEED * Math.sin(angle);
                  attacksToAdd.push({
                      id: 'dvd_logo_' + Date.now(), type: 'dvd_logo',
                      x: BATTLE_BOX_WIDTH / 2 - DVD_LOGO_SIZE / 2, y: BATTLE_BOX_HEIGHT / 2 - DVD_LOGO_SIZE / 2,
                      width: DVD_LOGO_SIZE, height: DVD_LOGO_SIZE,
                      vx: initialVx, vy: initialVy,
                      color: `hsl(${Math.random() * 360}, 70%, 60%)`
                  });
                  console.log("DVD Logo Spawned");
              }
              // Stop regular spawning when DVD logo starts
              clearInterval(spawnIntervalRef.current);
              spawnIntervalRef.current = null;
          } else {
              // Start regular spawning if it's not running and the next pattern isn't DVD
              if (!spawnIntervalRef.current) {
                   // spawnIntervalRef.current = setInterval(spawnAttack, SPAWN_INTERVAL); // spawnAttackを直接呼ばない
                   // 代わりに、spawnAttack を呼び出すためのトリガーを考えるか、
                   // または spawnAttack のロジックを gameLoop に統合する必要があるかもしれない。
                   // 一旦、ここでは spawnInterval の再開は保留。startBattleで処理されるはず。
                   console.log("Regular spawn interval not restarted here, handled by startBattle/phase logic.");
              }
          }

          if (currentPatternIndex === 2) { // After Gaster Blaster
              console.log("攻撃パターン3終了。中間ダイアログへ移行。");
              return {
                  ...prev,
                  gamePhase: GamePhase.INTERMISSION_DIALOGUE,
                  nextAttackIndex: nextAttackPatternIndex,
                  attacks: prev.attacks.filter(attack => attack.type === 'dvd_logo'), // Keep only DVD logo
                  showDialogue: true,
                  currentLineIndex: 0,
                  displayedDialogue: "",
              };
          } else { // Normal pattern switch
              console.log(`次の攻撃パターンへ移行: ${nextPattern.name} (持続時間: ${nextPattern.duration}ms)`);
              // Set timeout for the *next* call to switchToNextPattern
              nextPatternTimeoutRef.current = setTimeout(switchToNextPattern, nextPattern.duration);
              return {
                  ...prev,
                  currentAttackPatternIndex: nextAttackPatternIndex,
                  attackTimer: nextPattern.duration / 1000,
                  attacks: [
                      ...prev.attacks.filter(attack => attack.type === 'dvd_logo'), // Keep existing DVD logo
                      ...attacksToAdd // Add newly created attacks (e.g., the DVD logo itself)
                  ],
              };
          }
      });
  // }, [spawnAttack]); // spawnAttack を依存配列から削除
  }, []); // 依存配列を空にする (setGameState の関数形式を使っているため)


   // --- 戦闘開始処理 ---
   const startBattle = useCallback(() => {
      console.log("フェーズ戦闘: セットアップ開始。"); setTimeout(() => battleBoxRef.current?.focus(), 0);
      if (!requestRef.current) { console.log("Restarting game loop for BATTLE phase."); lastUpdateTimeRef.current = 0; requestRef.current = requestAnimationFrame(gameLoop); }
      if (ATTACK_PATTERNS.length === 0) { console.warn("No attack patterns available. Going to command selection."); setGameState(prev => ({ ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] })); return; }

      // Clear previous timers before starting new ones
      clearInterval(spawnIntervalRef.current); spawnIntervalRef.current = null;
      clearTimeout(nextPatternTimeoutRef.current); nextPatternTimeoutRef.current = null;
      clearInterval(attackTimerIntervalRef.current); attackTimerIntervalRef.current = null;
      clearInterval(battleTimerIntervalRef.current); battleTimerIntervalRef.current = null;

      setGameState(prev => {
          const initialIndex = prev.nextAttackIndex !== null ? prev.nextAttackIndex : 0; const validInitialIndex = initialIndex < ATTACK_PATTERNS.length ? initialIndex : 0; const pattern = ATTACK_PATTERNS[validInitialIndex]; let initialAttacksToAdd = [];
          if (pattern) { console.log(`現在の攻撃パターン開始: ${pattern.name}, ${pattern.duration}ms後に切り替え`);
               // ★★★ ここで次のパターンへのタイマーを設定 ★★★
               nextPatternTimeoutRef.current = setTimeout(switchToNextPattern, pattern.duration);

               if (pattern.type === 'DVD_LOGO') {
                   if (!prev.attacks.some(a => a.type === 'dvd_logo')) {
                       let angle = Math.random() * Math.PI * 2; while (Math.abs(Math.cos(angle)) < 0.1 || Math.abs(Math.sin(angle)) < 0.1) { angle = Math.random() * Math.PI * 2; } const initialVx = DVD_LOGO_SPEED * Math.cos(angle); const initialVy = DVD_LOGO_SPEED * Math.sin(angle); initialAttacksToAdd.push({ id: 'dvd_logo_' + Date.now(), type: 'dvd_logo', x: BATTLE_BOX_WIDTH / 2 - DVD_LOGO_SIZE / 2, y: BATTLE_BOX_HEIGHT / 2 - DVD_LOGO_SIZE / 2, width: DVD_LOGO_SIZE, height: DVD_LOGO_SIZE, vx: initialVx, vy: initialVy, color: `hsl(${Math.random() * 360}, 70%, 60%)` }); console.log("DVD Logo Spawned at startBattle");
                   }
                   // DVDロゴパターン中は通常スポーンしない
               } else {
                   // ★★★ 通常スポーン用のタイマーを開始 ★★★
                   spawnIntervalRef.current = setInterval(spawnAttack, SPAWN_INTERVAL);
               }
               return { ...prev, currentAttackPatternIndex: validInitialIndex, attackTimer: pattern.duration / 1000, attacks: [ ...prev.attacks.filter(attack => attack.type === 'dvd_logo'), ...initialAttacksToAdd ], nextAttackIndex: null }; }
          else { console.error("Initial pattern not found at index:", validInitialIndex); return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] }; }
      });

      // Attack Timer Interval (Visual Countdown)
      attackTimerIntervalRef.current = setInterval(() => { setGameState(prev => (prev.gamePhase === GamePhase.BATTLE ? { ...prev, attackTimer: Math.max(0, prev.attackTimer - 1) } : prev)); }, 1000);
      // Battle Duration Timer
      battleTimerIntervalRef.current = setInterval(() => {
          setGameState(prev => {
              if (prev.gamePhase !== GamePhase.BATTLE) { clearInterval(battleTimerIntervalRef.current); return prev; } const newTime = prev.battleTimeRemaining - 1;
              if (newTime < 0) { console.log("戦闘時間終了。コマンド選択へ移行。"); clearInterval(battleTimerIntervalRef.current); clearInterval(spawnIntervalRef.current); clearTimeout(nextPatternTimeoutRef.current); clearInterval(attackTimerIntervalRef.current); return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [], battleTimeRemaining: 0 }; }
              return { ...prev, battleTimeRemaining: newTime };
          });
      }, 1000);
  // }, [spawnAttack, switchToNextPattern, gameLoop]); // spawnAttack, switchToNextPattern を削除
  }, [switchToNextPattern, gameLoop, spawnAttack]); // spawnAttack を追加し直す


  // --- Effects ---
  useEffect(() => { window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp); return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); }; }, [handleKeyDown, handleKeyUp]);
  useEffect(() => {
      const cleanup = () => { clearInterval(spawnIntervalRef.current); clearTimeout(nextPatternTimeoutRef.current); clearInterval(attackTimerIntervalRef.current); clearInterval(battleTimerIntervalRef.current); if (requestRef.current) { cancelAnimationFrame(requestRef.current); requestRef.current = null; } clearInterval(typewriterIntervalRef.current); clearTimeout(nextLineTimeoutRef.current); clearTimeout(invincibilityTimerRef.current); clearTimeout(attackEffectTimeoutRef.current); spawnIntervalRef.current = null; nextPatternTimeoutRef.current = null; attackTimerIntervalRef.current = null; battleTimerIntervalRef.current = null; typewriterIntervalRef.current = null; nextLineTimeoutRef.current = null; invincibilityTimerRef.current = null; attackEffectTimeoutRef.current = null; };
      console.log(`Phase changed TO ${gamePhase}. Setting up...`); cleanup();
      switch (gamePhase) {
          case GamePhase.PRELOAD: stopAudio(); break;
          case GamePhase.DIALOGUE: lastUpdateTimeRef.current = 0; if (!requestRef.current) requestRef.current = requestAnimationFrame(gameLoop); startDialogueSequence(); setTimeout(() => battleBoxRef.current?.focus(), 0); if (Tone.Transport.state !== 'started' && toneStarted.current) Tone.Transport.start(); break;
          case GamePhase.INTERMISSION_DIALOGUE: if (!requestRef.current) { lastUpdateTimeRef.current = 0; requestRef.current = requestAnimationFrame(gameLoop); } startDialogueSequence(); setTimeout(() => battleBoxRef.current?.focus(), 0); break;
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
   const handleCommandSelection = useCallback((command) => {
        if (gameState.gamePhase !== GamePhase.COMMAND_SELECTION) return; console.log(`Command selected: ${command}`);
        if (command === 'たたかう') { const enemyCenterX = BATTLE_BOX_WIDTH / 2; const enemyCenterY = 50; setGameState(prev => ({ ...prev, attackEffect: { visible: true, x: enemyCenterX, y: enemyCenterY } })); clearTimeout(attackEffectTimeoutRef.current); attackEffectTimeoutRef.current = setTimeout(() => { setGameState(prev => ({ ...prev, attackEffect: { ...prev.attackEffect, visible: false } })); }, ATTACK_EFFECT_DURATION); playFanfare(); setGameState(prev => ({ ...prev, gamePhase: GamePhase.ENDING_G })); }
        else if (command === 'みのがす') { playFanfare(); startDialogueSequence(SPARE_ENDING_DIALOGUE, GamePhase.ENDING_P); }
   }, [gameState.gamePhase, playFanfare, startDialogueSequence]);

  // --- Rendering ---
  return (
    <ErrorBoundary>
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono select-none p-4">
          <style>{`
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




