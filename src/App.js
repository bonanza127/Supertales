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
const SPAWN_INTERVAL = 300; // ms
const BONE_SPEED = 4 * 60; // ピクセル/秒
const DAMAGE_AMOUNT = 5; // 基本ダメージ量
const BOUNDARY_DAMAGE_INTERVAL = 500; // ms
const TYPEWRITER_SPEED = 50; // ms
const DELAY_BETWEEN_LINES = 700; // ms
const ENEMY_IMAGE_URL = "https://i.imgur.com/RzfyQOV.png";
// ★★★ 変更点: プレイヤー画像のURL ★★★
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

// --- 攻撃パターン定義 ---
// 左右分割リフトはコメントアウトして無効化
const ATTACK_PATTERNS = [
    { name: '横方向の骨', duration: 4500, type: 'BONES_HORIZONTAL' },
    { name: '縦方向の骨', duration: 4500, type: 'BONES_VERTICAL' },
    { name: 'ゲスターブラスター', duration: 6000, type: 'GASTER_BLASTER' },
    // { name: '左右分割リフト', duration: 8000, type: 'SPLIT_LIFTS' },
];

// --- 英語セリフ ---
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

// --- ゲームフェーズ定義 ---
const GamePhase = {
    PRELOAD: '準備中',
    DIALOGUE: '会話',
    BATTLE: '戦闘',
    INTERMISSION_DIALOGUE: '幕間会話',
    COMMAND_SELECTION: 'コマンド選択',
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
// ★★★ 変更点: Playerコンポーネントで画像を使用 ★★★
const Player = React.memo(({ position, isInvincible }) => (
    <img
        src={PLAYER_IMAGE_URL}
        alt="Player"
        className={`absolute ${isInvincible ? 'player-invincible' : ''} pixelated`} // 点滅効果、ドット絵表示
        style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${PLAYER_SIZE}px`,
            height: `${PLAYER_SIZE}px`
        }}
        // 画像読み込み失敗時の代替表示
        onError={(e) => { e.target.onerror = null; e.target.src=`https://placehold.co/${PLAYER_SIZE}x${PLAYER_SIZE}/FF0000/FFFFFF?text=X`; }}
    />
));
const AttackRenderer = React.memo(({ attack }) => {
    switch(attack.type) {
        case 'gaster_warning': return <div key={attack.id} className="gaster-warning" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }}></div>;
        case 'gaster_beam': return <div key={attack.id} className="gaster-beam" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }}></div>;
        case 'bone': case 'bone_v': return ( <div key={attack.id} className="attack-bone" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }} /> );
        case 'platform': return ( <div key={attack.id} className="attack-platform" style={{ left: `${attack.x}px`, top: `${attack.y}px`, width: `${attack.width}px`, height: `${attack.height}px` }} /> );
        default: return null;
    }
});
const DialogueBox = React.memo(({ text, show }) => ( <div className="dialogue-container" style={{ opacity: show ? 1 : 0, pointerEvents: show ? 'auto' : 'none' }}> <div className="dialogue-box"> <p>{text}</p> </div> </div> ));
const GameOverScreen = React.memo(({ onRestart }) => ( <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-85 z-10"> <p className="text-4xl text-red-500 font-bold mb-4">GAME OVER</p> <button onClick={onRestart} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-md text-xl shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-300"> RESTART </button> </div> ));
const ActionButtons = React.memo(({ disabled, onCommand }) => (
    <div className="mt-6 flex space-x-4">
        {['たたかう', 'こうどう', 'アイテム', 'みのがす'].map((label) => (
            <button
                key={label}
                className="bg-orange-500 hover:bg-orange-600 text-black font-bold py-3 px-6 rounded-md text-xl shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-300 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={disabled}
                onClick={() => onCommand(label)}
            >
                {label}
            </button>
        ))}
    </div>
));
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
    if (attack.type === 'gaster_warning') return false;
    const playerRect = { left: player.x, right: player.x + PLAYER_SIZE, top: player.y, bottom: player.y + PLAYER_SIZE };
    let attackRect = { left: attack.x, right: attack.x + attack.width, top: attack.y, bottom: attack.y + attack.height };
    const tolerance = 0;
    return playerRect.left < attackRect.right - tolerance && playerRect.right > attackRect.left + tolerance && playerRect.top < attackRect.bottom - tolerance && playerRect.bottom > attackRect.top + tolerance;
   }, []);

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
   }, [endInvincibility]);

  // Spawn Attack
   const spawnAttack = useCallback(() => {
        if (gamePhaseRef.current !== GamePhase.BATTLE) return;
        setGameState(prev => {
            if (prev.gamePhase !== GamePhase.BATTLE) return prev;
            if (ATTACK_PATTERNS.length === 0) return prev;
            const currentPattern = ATTACK_PATTERNS[prev.currentAttackPatternIndex];
            if (!currentPattern) return prev;
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
   }, []);

  // Game Loop
  const gameLoop = useCallback((timestamp) => {
    if (gamePhaseRef.current === GamePhase.PRELOAD || gamePhaseRef.current === GamePhase.GAMEOVER || gamePhaseRef.current === GamePhase.COMMAND_SELECTION) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
        return;
    }
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
        if (prev.gamePhase === GamePhase.COMMAND_SELECTION) return prev;

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
        if (prev.gamePhase === GamePhase.BATTLE) {
            updatedAttacks = prev.attacks.map(a => {
                let ua = { ...a };
                switch (a.type) {
                    case 'bone': ua.x += ua.speed * deltaSeconds; break;
                    case 'bone_v': ua.y += ua.speed * deltaSeconds; break;
                    case 'platform': ua.y += ua.speed * deltaSeconds; break;
                    default: break;
                }
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

            // Remove off-screen attacks
            updatedAttacks.forEach(a => {
                if (a.type !== 'gaster_warning' && a.type !== 'gaster_beam') {
                    if (a.x + a.width < -50 || a.x > BATTLE_BOX_WIDTH + 50 ||
                        a.y + a.height < -50 || a.y > BATTLE_BOX_HEIGHT + 50) {
                        attacksToRemoveThisFrame.add(a.id);
                    }
                }
            });

            // Check collisions
            const playerRect = { x: newBattlePlayerPosition.x, y: newBattlePlayerPosition.y };
            let finalAttacks = [];
            for (const attack of updatedAttacks) {
                if (attacksToRemoveThisFrame.has(attack.id)) continue;
                if (!currentlyInvincible && !hitDetectedThisFrame && checkBattleCollision(playerRect, attack)) {
                    hitDetectedThisFrame = true;
                    if (attack.type !== 'gaster_beam') {
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
  }, [applyDamage, checkBattleCollision]);


  // --- Audio Setup and Control ---
  const setupAudio = useCallback(() => {
    synthRef.current = new Tone.Synth({ oscillator: { type: 'pulse', width: 0.5 }, envelope: { attack: 0.01, decay: 0.08, sustain: 0.1, release: 0.2 }, volume: -16 }).toDestination();
    typingSynthRef.current = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.05 }, volume: -22 }).toDestination();
    const notes = [ "C3", null, "E3", "G3", "C3", null, "E3", "G3", "A2", null, "C3", "E3", "A2", null, "C3", "E3", "F2", null, "A2", "C3", "F2", null, "A2", "C3", "G2", null, "B2", "D3", "G2", "B2", "D3", "G2" ];
    bgmLoopRef.current = new Tone.Sequence((time, note) => { if (note && synthRef.current) { synthRef.current.triggerAttackRelease(note, "16n", time); } }, notes, "16n").start(0);
    bgmLoopRef.current.loop = true; Tone.Transport.bpm.value = 104;
   }, []);
  const startAudio = useCallback(async () => {
    if (!toneStarted.current) { try { await Tone.start(); toneStarted.current = true; setupAudio(); Tone.Transport.start(); } catch (e) { console.error("Tone.jsの開始に失敗:", e); } } else if (Tone.Transport.state !== 'started') { Tone.Transport.start(); }
   }, [setupAudio]);
  const stopAudio = useCallback(() => {
      if (Tone.Transport.state === 'started') { Tone.Transport.stop(); }
      bgmLoopRef.current?.dispose(); synthRef.current?.dispose(); typingSynthRef.current?.dispose();
      bgmLoopRef.current = null; synthRef.current = null; typingSynthRef.current = null;
      clearTimeout(invincibilityTimerRef.current);
   }, []);
  const playTypingSound = useCallback(() => { if (Tone && typingSynthRef.current && Tone.context.state === 'running') { typingSynthRef.current.triggerAttackRelease("C5", "16n", Tone.now()); } }, []);


  // --- Dialogue Sequence Logic ---
  const typeNextLine = useCallback(() => {
      setGameState(prev => {
          if (prev.gamePhase !== GamePhase.DIALOGUE && prev.gamePhase !== GamePhase.INTERMISSION_DIALOGUE) return prev;

          const currentLines = prev.gamePhase === GamePhase.INTERMISSION_DIALOGUE ? INTERMISSION_DIALOGUE_LINES : DIALOGUE_LINES;
          const currentPhase = prev.gamePhase;
          const lineIndex = prev.currentLineIndex;

          if (lineIndex >= currentLines.length) {
              if (currentPhase === GamePhase.INTERMISSION_DIALOGUE) {
                  if (prev.nextAttackIndex === null || ATTACK_PATTERNS.length === 0 || prev.nextAttackIndex >= ATTACK_PATTERNS.length) {
                      console.warn("Intermission finished, but no valid next attack. Transitioning to command selection.");
                      return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, showDialogue: false, attacks: [] };
                  }
                  return { ...prev, gamePhase: GamePhase.BATTLE, showDialogue: false, currentAttackPatternIndex: prev.nextAttackIndex, nextAttackIndex: null };
              } else {
                  const initPos = { x: BATTLE_BOX_WIDTH / 2 - PLAYER_SIZE / 2, y: BATTLE_BOX_HEIGHT / 2 - PLAYER_SIZE / 2 };
                  playerPositionRef.current = initPos;
                  return { ...prev, gamePhase: GamePhase.BATTLE, showDialogue: false, battlePlayerPosition: initPos };
              }
          }

          const fullText = currentLines[lineIndex];
          let charIndex = 0;

          clearInterval(typewriterIntervalRef.current);
          clearTimeout(nextLineTimeoutRef.current);

          typewriterIntervalRef.current = setInterval(() => {
              setGameState(currentInternalState => {
                  if (currentInternalState.gamePhase !== currentPhase) {
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
                      nextLineTimeoutRef.current = setTimeout(typeNextLine, DELAY_BETWEEN_LINES);
                      return currentInternalState;
                  }
              });
          }, TYPEWRITER_SPEED);

          return { ...prev, displayedDialogue: "", showDialogue: true, currentLineIndex: lineIndex + 1 };
      });
  }, [playTypingSound]);

  const startDialogueSequence = useCallback(() => {
      console.log("Starting dialogue sequence...");
      clearTimeout(nextLineTimeoutRef.current);
      clearInterval(typewriterIntervalRef.current);
      setGameState(prev => ({ ...prev, currentLineIndex: 0, displayedDialogue: "", showDialogue: true }));
      typeNextLine();
  }, [typeNextLine]);


  // --- Game Start & Reset Logic ---
  const resetGame = useCallback(() => {
      console.log("ゲームをリセットします..."); stopAudio();
      clearInterval(spawnIntervalRef.current); clearTimeout(nextPatternTimeoutRef.current); clearInterval(attackTimerIntervalRef.current); clearTimeout(boundaryDamageTimerRef.current); clearInterval(battleTimerIntervalRef.current); clearInterval(typewriterIntervalRef.current); clearTimeout(nextLineTimeoutRef.current);
      cancelAnimationFrame(requestRef.current); requestRef.current = null;
      const initialState = getInitialState(); setGameState(initialState); playerPositionRef.current = initialState.battlePlayerPosition; gamePhaseRef.current = GamePhase.PRELOAD; pressedKeys.current = {}; lastUpdateTimeRef.current = 0; toneStarted.current = false;
      nextLiftSideRef.current = 'left';
      console.log("ゲームのリセット完了。");
  }, [stopAudio]);
  const handleStartGame = useCallback(async () => {
    await startAudio();
    const initialState = getInitialState();
    playerPositionRef.current = initialState.battlePlayerPosition;
    setGameState(prev => ({ ...initialState, gamePhase: GamePhase.DIALOGUE, showDialogue: true }));
  }, [startAudio]);


  // --- Keyboard Handlers ---
  const handleKeyDown = useCallback((event) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) pressedKeys.current[event.code] = true; }, []);
  const handleKeyUp = useCallback((event) => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) pressedKeys.current[event.code] = false; }, []);

  // --- Attack Pattern Switching Logic ---
  const switchToNextPattern = useCallback(() => {
      clearTimeout(nextPatternTimeoutRef.current);
      setGameState(prev => {
          if (prev.gamePhase !== GamePhase.BATTLE) return prev;
          if (ATTACK_PATTERNS.length === 0) {
              console.warn("No attack patterns defined. Cannot switch. Transitioning to command selection.");
              return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] };
          }

          const currentPatternIndex = prev.currentAttackPatternIndex;
          const nextIndexRaw = currentPatternIndex + 1;

          if (nextIndexRaw >= ATTACK_PATTERNS.length) {
              console.log("Last attack pattern finished (index check). Letting battle timer handle transition.");
              clearInterval(spawnIntervalRef.current);
              clearTimeout(nextPatternTimeoutRef.current);
              clearInterval(attackTimerIntervalRef.current);
              return prev;
          }

          const nextAttackPatternIndex = nextIndexRaw;

          if (currentPatternIndex === 2) {
               if (nextAttackPatternIndex >= ATTACK_PATTERNS.length) {
                  console.warn("Intermission dialogue should trigger, but no more attack patterns after it. Transitioning to command selection directly after dialogue.");
                  // Setting nextAttackIndex to null will cause transition to COMMAND_SELECTION after dialogue
                  return { ...prev, gamePhase: GamePhase.INTERMISSION_DIALOGUE, nextAttackIndex: null, attacks: [], showDialogue: true, currentLineIndex: 0, displayedDialogue: "" };
              }
              console.log("攻撃パターン3終了。中間ダイアログへ移行。");
              return {
                  ...prev,
                  gamePhase: GamePhase.INTERMISSION_DIALOGUE,
                  nextAttackIndex: nextAttackPatternIndex,
                  attacks: [],
                  showDialogue: true,
                  currentLineIndex: 0,
                  displayedDialogue: "",
              };
          } else {
              const nextPattern = ATTACK_PATTERNS[nextAttackPatternIndex];
              if (!nextPattern) {
                  console.error("Next pattern not found at index:", nextAttackPatternIndex);
                  return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] };
              }
              console.log(`次の攻撃パターンへ移行: ${nextPattern.name} (持続時間: ${nextPattern.duration}ms)`);
              nextPatternTimeoutRef.current = setTimeout(switchToNextPattern, nextPattern.duration);
              return {
                  ...prev,
                  currentAttackPatternIndex: nextAttackPatternIndex,
                  attackTimer: nextPattern.duration / 1000,
              };
          }
      });
  }, []);

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

      clearInterval(spawnIntervalRef.current);
      clearTimeout(nextPatternTimeoutRef.current);
      clearInterval(attackTimerIntervalRef.current);
      clearInterval(battleTimerIntervalRef.current);

      spawnIntervalRef.current = setInterval(spawnAttack, SPAWN_INTERVAL);

      setGameState(prev => {
          const initialIndex = prev.currentAttackPatternIndex < ATTACK_PATTERNS.length ? prev.currentAttackPatternIndex : 0;
          const pattern = ATTACK_PATTERNS[initialIndex];
          if (pattern) {
               console.log(`現在の攻撃パターン開始: ${pattern.name}, ${pattern.duration}ms後に切り替え`);
               nextPatternTimeoutRef.current = setTimeout(switchToNextPattern, pattern.duration);
               return {...prev, currentAttackPatternIndex: initialIndex, attackTimer: pattern.duration / 1000 };
          } else {
              console.error("Initial pattern not found at index:", initialIndex);
              return { ...prev, gamePhase: GamePhase.COMMAND_SELECTION, attacks: [] };
          }
      });

      attackTimerIntervalRef.current = setInterval(() => {
          setGameState(prev => (prev.gamePhase === GamePhase.BATTLE ? { ...prev, attackTimer: Math.max(0, prev.attackTimer - 1) } : prev));
      }, 1000);

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
  }, [spawnAttack, switchToNextPattern, gameLoop]);


  // --- Effects ---

  // Keyboard Listener Setup
  useEffect(() => {
      window.addEventListener('keydown', handleKeyDown); window.addEventListener('keyup', handleKeyUp);
      return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [handleKeyDown, handleKeyUp]);

  // Main Game Phase Logic Controller
  useEffect(() => {
      const cleanup = () => {
          clearInterval(spawnIntervalRef.current);
          clearTimeout(nextPatternTimeoutRef.current);
          clearInterval(attackTimerIntervalRef.current);
          clearInterval(battleTimerIntervalRef.current);
          if (requestRef.current) {
              cancelAnimationFrame(requestRef.current);
              requestRef.current = null;
          }
          clearInterval(typewriterIntervalRef.current);
          clearTimeout(nextLineTimeoutRef.current);
          clearTimeout(invincibilityTimerRef.current);
          spawnIntervalRef.current = null;
          nextPatternTimeoutRef.current = null;
          attackTimerIntervalRef.current = null;
          battleTimerIntervalRef.current = null;
          typewriterIntervalRef.current = null;
          nextLineTimeoutRef.current = null;
          invincibilityTimerRef.current = null;
      };

      console.log(`Phase changed TO ${gamePhase}. Setting up...`);
      cleanup();

      switch (gamePhase) {
          case GamePhase.PRELOAD:
              stopAudio();
              break;
          case GamePhase.DIALOGUE:
              lastUpdateTimeRef.current = 0;
              if (!requestRef.current) requestRef.current = requestAnimationFrame(gameLoop);
              startDialogueSequence();
              setTimeout(() => battleBoxRef.current?.focus(), 0);
              if (Tone.Transport.state !== 'started' && toneStarted.current) Tone.Transport.start();
              break;
          case GamePhase.INTERMISSION_DIALOGUE:
              if (!requestRef.current) {
                  lastUpdateTimeRef.current = 0;
                  requestRef.current = requestAnimationFrame(gameLoop);
              }
              startDialogueSequence();
              setTimeout(() => battleBoxRef.current?.focus(), 0);
              break;
          case GamePhase.BATTLE:
              startBattle();
              break;
          case GamePhase.COMMAND_SELECTION:
              console.log("Entered COMMAND_SELECTION phase. Waiting for command.");
              if (Tone.Transport.state !== 'started' && toneStarted.current) {
                  Tone.Transport.start();
              }
              break;
          case GamePhase.GAMEOVER:
              stopAudio();
              break;
          default:
              break;
      }
      return cleanup;
  }, [gamePhase, startBattle, stopAudio, gameLoop, startDialogueSequence]); // 依存配列を修正

   // Audio Cleanup on Unmount
   useEffect(() => { return () => { stopAudio(); toneStarted.current = false; }; }, [stopAudio]);

   // --- コマンド選択処理 ---
   const handleCommandSelection = useCallback((command) => {
        if (gameState.gamePhase !== GamePhase.COMMAND_SELECTION) return;

        console.log(`Command selected: ${command}`);
        alert(`「${command}」が選択されました。\n（実際の処理は未実装です）`);

        // TODO: Implement logic for each command.
        // Example: Transition back to BATTLE
        // setGameState(prev => ({
        //     ...prev,
        //     gamePhase: GamePhase.BATTLE,
        //     battleTimeRemaining: BATTLE_DURATION_SECONDS,
        //     currentAttackPatternIndex: 0,
        //     attackTimer: ATTACK_PATTERNS.length > 0 ? ATTACK_PATTERNS[0].duration / 1000 : 0,
        //     attacks: [],
        // }));

   }, [gameState.gamePhase]);


  // --- Rendering ---
  return (
    <ErrorBoundary>
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white font-mono select-none p-4">
          {/* スタイル定義 */}
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
                  {gamePhase === GamePhase.BATTLE && attacks.map((attack) => <AttackRenderer key={attack.id} attack={attack} /> )}
                  {gamePhase === GamePhase.GAMEOVER && <GameOverScreen onRestart={resetGame} />}
              </div>
               <UIElements
                    hp={hp}
                    currentAttackName={currentAttack?.name}
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

