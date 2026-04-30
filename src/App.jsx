import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const MAIN_BONUS_TYPES = ["21 BONUS WHEEL", "HIDDEN HAND", "FREE SPINS FEATURE"];
const PROGRESSIVE_JACKPOT = 500000;
const WHEEL_PRIZES = [10, 20, 25, 40, 50, 75, 100, 150, "MINI", "MAJOR"];
const WHEEL_SEGMENTS = [...WHEEL_PRIZES, "PROGRESSIVE JACKPOT"];
const SIDE_BONUS_AMOUNTS = [5, 10, 15, 20, 25, 40, 50, 75];
const FREE_SPIN_SYMBOLS = [
  { label: "$2", value: 2 },
  { label: "$5", value: 5 },
  { label: "$10", value: 10 },
  { label: "$15", value: 15 },
  { label: "+2 SPINS", value: 0, spins: 2 },
  { label: "WILD", value: 5 },
  { label: "MINI", value: 10 },
  { label: "MAJOR", value: 25 },
  { label: "—", value: 0 },
];

const DEMO_BLACKJACK_CHANCE = 0.10;
const DEMO_SPLIT_CHANCE = 0.125;
const DEMO_DOUBLE_TOTAL_CHANCE = 0.155;
const DEMO_SPIN_TO_21_CHANCE = 0.36;
const WHEEL_PROGRESSIVE_CHANCE = 0.02;
const FREE_SPIN_PROGRESSIVE_CHANCE = 0.003;

const AUDIO = {
  click: "/assets/audio/click.mp3",
  chip: "/assets/audio/chip.mp3",
  card: "/assets/audio/card.mp3",
  spin: "/assets/audio/spin.mp3",
  stop: "/assets/audio/stop.mp3",
  bonus: [
    "/assets/audio/bonus1.mp3",
    "/assets/audio/bonus2.mp3",
    "/assets/audio/bonus3.mp3",
  ],
  win: "/assets/audio/win.mp3",
  lose: "/assets/audio/lose.mp3",
};

function playTone(kind = "click") {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    const settings = {
      click: [420, 0.055, "square", 0.035],
      spin: [180, 0.18, "sawtooth", 0.035],
      stop: [620, 0.08, "triangle", 0.04],
      bonus: [880, 0.22, "triangle", 0.055],
      win: [1040, 0.28, "sine", 0.06],
      lose: [140, 0.25, "sawtooth", 0.035],
      chip: [700, 0.06, "triangle", 0.04],
      card: [520, 0.05, "square", 0.03],
    };
    const [freq, duration, type, volume] = settings[kind] || settings.click;
    const now = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    setTimeout(() => ctx.close?.(), (duration + 0.05) * 1000);
  } catch {}
}

function playAudioFile(src, fallbackKind = "click") {
  if (typeof window !== "undefined" && window.__slotjackSoundEnabled === false) return;

  const VOLUME = {
    click: 0.12,
    chip: 0.16,
    card: 0.14,
    spin: 0.10,
    stop: 0.14,
    bonus: 0.24,
    win: 0.26,
    lose: 0.18,
  };

  try {
    const chosenSrc = Array.isArray(src)
      ? src[Math.floor(Math.random() * src.length)]
      : src;

    if (!chosenSrc) return;

    const audio = new Audio(chosenSrc);
    audio.volume = VOLUME[fallbackKind] ?? 0.16;
    audio.preload = "auto";

    const result = audio.play();
    if (result?.catch) result.catch(() => {});
  } catch {
    // Stay silent if browser blocks audio or a file is missing. No synthetic fallback beep.
  }
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit, id: `${rank}${suit}-${Math.random()}` });
  return shuffle(deck);
}
function shuffle(cards) {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function drawFrom(deck, count = 1) {
  const fresh = deck.length < count + 10 ? buildDeck() : deck;
  return { drawn: fresh.slice(0, count), remaining: fresh.slice(count) };
}
function removeCardsFromDeck(deck, cardsToRemove) {
  const ids = new Set(cardsToRemove.filter(Boolean).map((c) => c.id));
  return deck.filter((c) => !ids.has(c.id));
}
function cardValue(card) {
  if (!card) return 0;
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return Number(card.rank);
}
function handValue(hand) {
  let total = hand.reduce((sum, card) => sum + cardValue(card), 0);
  let aces = hand.filter((card) => card?.rank === "A").length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}
function naturalBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}
function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function symbolRank(symbol) {
  return String(symbol).replace(/[♠♥♦♣]/g, "");
}
function findCardByValue(deck, value) {
  return deck.find((card) => cardValue(card) === value);
}
function resolvePrizeAmount(prize) {
  if (prize === "PROGRESSIVE JACKPOT") return PROGRESSIVE_JACKPOT;
  if (prize === "MINI") return 25;
  if (prize === "MAJOR") return 100;
  return Number(prize) || 0;
}
function prizeLabel(prize) {
  return prize === "PROGRESSIVE JACKPOT" ? "PROGRESSIVE" : String(prize);
}
function makeFreeSpinAmountGrid(allowExtraSpins = true) {
  const availableSymbols = allowExtraSpins
    ? FREE_SPIN_SYMBOLS
    : FREE_SPIN_SYMBOLS.filter((symbol) => !symbol.spins);
  const grid = Array.from({ length: 9 }, () => randomChoice(availableSymbols));
  if (Math.random() < FREE_SPIN_PROGRESSIVE_CHANCE) grid[Math.floor(Math.random() * grid.length)] = { label: "PROGRESSIVE", value: PROGRESSIVE_JACKPOT };
  return grid;
}
function freeSpinGridValue(grid) {
  return grid.reduce((sum, symbol) => sum + (symbol?.value || 0), 0);
}
function makeHiddenHandColumns() {
  const targetCard = `${randomChoice(["A", "K", "Q", "J", "10", "9", "8"])}${randomChoice(SUITS)}`;
  const targetRank = symbolRank(targetCard);
  const wrongRanks = RANKS.filter((rank) => rank !== targetRank);
  const exact = () => targetCard;
  const wrong = () => `${randomChoice(wrongRanks)}${randomChoice(SUITS)}`;
  return [
    shuffle([exact(), exact(), exact()]),
    shuffle([exact(), exact(), exact()]),
    shuffle([exact(), exact(), wrong()]),
    shuffle([exact(), wrong(), wrong()]),
  ];
}
function hiddenHandPrize(matchCount, allMatched = false, mainBet = blackjackBet) {
  if (allMatched) return mainBet * 100;
  if (matchCount >= 2) return mainBet * 10;
  if (matchCount >= 1) return mainBet * 2;
  return 0;
}

function GameFeedMessage({ message }) {
  const lower = message.toLowerCase();
  const busted = lower.includes("bust");
  const loses = lower.includes("player loses") || lower.includes("dealer wins");
  if (!busted && !loses) return <>{message}</>;
  return (
    <>
      <span className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,.9)]">PLAYER LOSES</span>
      {busted ? <><br /><span className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,.9)] text-3xl">BUSTED</span></> : null}
    </>
  );
}

function CardFace({ card, hidden = false, delay = 0, fromShoe = true }) {
  if (!card) return null;
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <motion.div
      layout
      initial={fromShoe ? { x: 430, y: -155, scale: 0.35, opacity: 0, rotate: 28 } : { scale: 0.2, y: -80, opacity: 0, rotate: -6 }}
      animate={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 125, damping: 18, delay }}
      className={`w-[70px] h-[98px] rounded-[10px] shadow-2xl border-2 flex flex-col justify-between p-2 ${hidden ? "bg-gradient-to-br from-red-800 to-slate-900 border-red-300" : "bg-white border-white"}`}
    >
      {hidden ? (
        <div className="h-full w-full rounded-md bg-red-700/70 grid place-items-center text-white font-black text-2xl">?</div>
      ) : (
        <>
          <div className={`font-black text-xl leading-none ${red ? "text-red-600" : "text-black"}`}>{card.rank}</div>
          <div className={`text-4xl text-center leading-none ${red ? "text-red-600" : "text-black"}`}>{card.suit}</div>
          <div className={`font-black text-xl self-end leading-none ${red ? "text-red-600" : "text-black"}`}>{card.rank}</div>
        </>
      )}
    </motion.div>
  );
}

function SpinningReelCell({ active }) {
  const cards = ["A♠", "2♥", "3♦", "4♣", "5♠", "6♥", "7♦", "8♣", "9♠", "10♥", "J♦", "Q♣", "K♠"];
  return (
    <div className="relative h-full w-full overflow-hidden rounded-md bg-gradient-to-b from-slate-950 via-slate-800 to-slate-950 border border-yellow-300/40 shadow-[inset_0_0_22px_rgba(250,204,21,.35)]">
      {active ? (
        <motion.div initial={{ y: "-76%" }} animate={{ y: ["-76%", "-8%"] }} transition={{ duration: 0.18, repeat: Infinity, ease: "linear" }} className="absolute inset-x-0 flex flex-col items-center gap-2 py-2">
          {[...cards, ...cards, ...cards].map((s, i) => {
            const red = s.includes("♥") || s.includes("♦");
            return <div key={i} className={`h-12 w-[86%] rounded-md bg-white border border-slate-200 grid place-items-center font-black text-xl shadow-md ${red ? "text-red-600" : "text-black"}`}>{s}</div>;
          })}
        </motion.div>
      ) : null}
      <div className="absolute inset-x-1 top-1/2 -translate-y-1/2 h-[54px] rounded-md border-2 border-cyan-300/80 shadow-[0_0_18px_rgba(34,211,238,.8)] z-40 pointer-events-none" />
    </div>
  );
}

function ImgButton({ src, onClick, disabled, className = "", glow = "gold" }) {
  const glowClass = glow === "blue"
    ? "drop-shadow-[0_0_18px_rgba(34,211,238,.55)]"
    : glow === "red"
    ? "drop-shadow-[0_0_18px_rgba(239,68,68,.55)]"
    : glow === "purple"
    ? "drop-shadow-[0_0_18px_rgba(168,85,247,.55)]"
    : "drop-shadow-[0_0_18px_rgba(250,204,21,.55)]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative z-[120] pointer-events-auto bg-transparent border-0 p-0 transition-transform duration-200 ${
        disabled ? "opacity-30 grayscale cursor-not-allowed" : `cursor-pointer hover:scale-105 active:scale-95 ${glowClass}`
      } ${className}`}
    >
      <img src={src} draggable="false" className="relative z-10 w-full h-full object-contain pointer-events-none select-none" />
    </button>
  );
}

function SideBetBox({ title, amount, active, disabled, onToggle, small = false }) {
  return (
    <div className={`${small ? "w-[150px] px-3 py-3" : "w-[190px] px-5 py-4"} rounded-xl bg-black/70 border border-yellow-400/60 shadow-2xl`}>
      <div className={`text-yellow-300 font-black leading-tight ${small ? "text-[13px]" : "text-lg"}`}>{title}</div>
      <button type="button" disabled={disabled} onClick={onToggle} className={`mt-2 px-4 py-1 rounded-full font-black ${active ? "bg-green-500" : "bg-slate-600"} ${disabled ? "opacity-50" : ""}`}>
        {active ? "ON" : "OFF"}
      </button>
      <div className={`mt-3 flex flex-col items-center transition ${active ? "opacity-100" : "opacity-30"}`}>
        <div className={`${small ? "w-12 h-12" : "w-16 h-16"} rounded-full bg-gradient-to-br from-red-600 via-red-800 to-red-950 border-4 border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,.7)] grid place-items-center`}>
          <div className={`${small ? "w-8 h-8 text-sm" : "w-11 h-11 text-xl"} rounded-full border-2 border-yellow-200 grid place-items-center text-yellow-200 font-black`}>${amount}</div>
        </div>
      </div>
    </div>
  );
}


function SideBetMarker({ label, amount, active, disabled, onToggle, icon, className = "", dropKey = 0, tooltip = "", tooltipClassName = "" }) {
  return (
    <div className={`group absolute z-30 flex items-center gap-[2px] ${className}`}>
      {tooltip ? (
        <div className={`absolute z-[200] hidden w-[260px] rounded-xl bg-black/90 border-2 border-yellow-300 px-4 py-2 text-yellow-200 text-[13px] font-black leading-tight shadow-[0_0_22px_rgba(250,204,21,.55)] group-hover:block pointer-events-none ${tooltipClassName || "left-[92px] top-[-46px]"}`}>
          {tooltip}
        </div>
      ) : null}
      <div className={`px-2 py-1 rounded-full text-[10px] font-black border border-white whitespace-nowrap ${active ? "bg-green-500 text-black" : "bg-slate-700 text-white"}`}>
        {active ? "AUTO ON" : "OFF"}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={`relative w-[225px] h-[92px] bg-transparent border-0 p-0 transition ${
          active ? "opacity-100" : "opacity-50 grayscale"
        } ${disabled ? "cursor-not-allowed" : "hover:scale-105 active:scale-95"}`}
      >
        {icon ? (
          <img src={icon} className="absolute inset-0 w-full h-full object-contain p-0 pointer-events-none scale-[1.12]" draggable="false" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-yellow-300 font-black text-sm leading-tight px-2">{label}</span>
        )}
      </button>

      <div className={`relative -ml-[2px] w-14 h-14 rounded-full border-4 border-yellow-300 grid place-items-center shadow-[0_0_18px_rgba(250,204,21,.7)] transition ${
        active ? "bg-gradient-to-br from-red-500 via-red-800 to-black opacity-100" : "bg-slate-800 opacity-35"
      }`}>
        {active ? (
          <motion.div
            key={dropKey}
            initial={{ x: -95, y: -55, scale: 0.35, opacity: 0 }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 15 }}
            className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500 via-red-800 to-black border-4 border-yellow-300 shadow-2xl"
          />
        ) : null}
        <div className="relative z-10 w-9 h-9 rounded-full border-2 border-yellow-100 grid place-items-center text-yellow-100 font-black text-sm">
          ${amount}
        </div>
      </div>
    </div>
  );
}

function MiniSpinDevice({ title, value, spinning, type = "card" }) {
  const symbols = type === "amount" ? ["$5", "$10", "$15", "$20", "$25", "$40", "$50", "$75"] : ["A♠", "K♥", "Q♦", "J♣", "10♠", "9♥", "8♦", "7♣"];
  return (
    <div className="rounded-2xl bg-black/70 border-4 border-yellow-300 p-3 shadow-[0_0_25px_rgba(250,204,21,.45)]">
      <div className="mb-2 text-yellow-300 font-black text-sm">{title}</div>
      <div className="relative h-24 overflow-hidden rounded-xl bg-gradient-to-b from-slate-950 via-slate-800 to-slate-950 border border-cyan-300/70">
        {spinning ? (
          <motion.div animate={{ y: ["-72%", "-5%"] }} transition={{ duration: 0.18, repeat: Infinity, ease: "linear" }} className="absolute inset-x-0 flex flex-col items-center gap-2 py-2">
            {[...symbols, ...symbols, ...symbols].map((s, i) => {
              const red = s.includes("♥") || s.includes("♦");
              return <div key={i} className={`h-12 w-[86%] rounded-md bg-white grid place-items-center font-black text-2xl ${red ? "text-red-600" : "text-black"}`}>{s}</div>;
            })}
          </motion.div>
        ) : (
          <div className={`h-full grid place-items-center bg-white text-4xl font-black ${String(value).includes("♥") || String(value).includes("♦") ? "text-red-600" : "text-black"}`}>{value || "?"}</div>
        )}
      </div>
    </div>
  );
}

function BonusAmountFlash({ amount }) {
  if (!amount) return null;
  return (
    <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.15, 1], opacity: 1 }} exit={{ opacity: 0, scale: 0.7 }} className="absolute inset-0 z-[95] pointer-events-none grid place-items-center">
      <div className="rounded-3xl bg-green-500 border-4 border-white px-12 py-6 text-black text-6xl font-black shadow-[0_0_60px_rgba(34,197,94,.9)]">BONUS = ${Number(amount).toLocaleString()}</div>
    </motion.div>
  );
}

function BigWinnerFlash({ amount }) {
  if (!amount) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.55 }}
      animate={{ opacity: 1, scale: [0.55, 1.12, 1] }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.35 }}
      className="absolute inset-0 z-[220] pointer-events-none grid place-items-center bg-black/70"
    >
      <div className="rounded-[40px] bg-green-500 border-8 border-white px-20 py-12 text-black text-8xl font-black tracking-widest text-center shadow-[0_0_90px_rgba(34,197,94,1)]">
        BIG WINNER
        <div className="mt-4 text-5xl">+${Number(amount).toLocaleString()}</div>
      </div>
    </motion.div>
  );
}

export default function SlotJackPrototype() {
  const [credits, setCredits] = useState(5000);
  const [blackjackBet, setBlackjackBet] = useState(25);
  const [lastChip, setLastChip] = useState(25);
  const [chipAnimKey, setChipAnimKey] = useState(0);
  const [autoChipDropKey, setAutoChipDropKey] = useState(0);
  const [spinBet] = useState(10);
  const [spinBetOn, setSpinBetOn] = useState(true);
  const [doubleBonusOn, setDoubleBonusOn] = useState(true);
  const [splitBonusOn, setSplitBonusOn] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [deck, setDeck] = useState(buildDeck());
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [hitCards, setHitCards] = useState([]);
  const [splitHand, setSplitHand] = useState(null);
  const [pendingSplitHand, setPendingSplitHand] = useState(null);
  const [pendingDoubleCard, setPendingDoubleCard] = useState(null);
  const [pendingDoubleDeck, setPendingDoubleDeck] = useState(null);
  const [pendingDoubleBet, setPendingDoubleBet] = useState(null);

  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("Place your bet, turn on 21 Spin, then deal.");
  const [lastWin, setLastWin] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [anticipatingSpin, setAnticipatingSpin] = useState(false);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [handReady, setHandReady] = useState(false);

  const [bonusType, setBonusType] = useState(null);
  const [bonusIndex, setBonusIndex] = useState(0);
  const [bonusIntro, setBonusIntro] = useState(false);
  const [bonusCinematic, setBonusCinematic] = useState(false);
  const [bonusGameVisible, setBonusGameVisible] = useState(false);
  const [bonusFlashAmount, setBonusFlashAmount] = useState(null);
  const [bigWinnerAmount, setBigWinnerAmount] = useState(null);
  const [sideBonus, setSideBonus] = useState(null);

  const [wheelResult, setWheelResult] = useState(null);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [hiddenPicks, setHiddenPicks] = useState([]);
  const [hiddenColumnIndex, setHiddenColumnIndex] = useState(0);
  const [hiddenTargetRank, setHiddenTargetRank] = useState(null);
  const [hiddenGameOver, setHiddenGameOver] = useState(false);
  const [hiddenMatchLevel, setHiddenMatchLevel] = useState(0);
  const [hiddenPrizeFlash, setHiddenPrizeFlash] = useState(null);

  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [freeSpinGrid, setFreeSpinGrid] = useState(makeFreeSpinAmountGrid());
  const [freeSpinTotal, setFreeSpinTotal] = useState(0);
  const [freeSpinSpinning, setFreeSpinSpinning] = useState(false);
   const [freeSpinExtraAwarded, setFreeSpinExtraAwarded] = useState(0);

  const [stageScale, setStageScale] = useState(1);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__slotjackSoundEnabled = soundEnabled;
    }
  }, [soundEnabled]);

useEffect(() => {
  function resizeStage() {
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;

    const scale = Math.min(viewportWidth / 1600, viewportHeight / 900) * 0.98;
    setStageScale(scale);
  }

  resizeStage();
  window.addEventListener("resize", resizeStage);
  window.visualViewport?.addEventListener("resize", resizeStage);

  return () => {
    window.removeEventListener("resize", resizeStage);
    window.visualViewport?.removeEventListener("resize", resizeStage);
  };
}, []);

  const playerTotal = useMemo(() => handValue(player), [player]);
  const progressiveGlow = spinBetOn && phase === "player" && playerTotal < 21 && (21 - playerTotal) >= 1 && (21 - playerTotal) <= 11;
  const dealerTotal = useMemo(() => handValue(dealer), [dealer]);
  const sideBetCost = (spinBetOn ? spinBet : 0) + (doubleBonusOn ? 5 : 0) + (splitBonusOn ? 5 : 0);
  const roundCost = blackjackBet + sideBetCost;
  const currentLoss = -roundCost;
  const lockBets = ["dealing", "player", "bonus"].includes(phase);
  const canSplit = phase === "player" && handReady && player.length === 2 && player[0]?.rank === player[1]?.rank && cardValue(player[0]) !== 10 && !pendingSplitHand && credits >= blackjackBet;
  const canDoubleDown = phase === "player" && handReady && player.length === 2 && credits >= blackjackBet && [10, 11].includes(playerTotal);

  function showBonusFlash(amount) {
    if (!amount || amount <= 0) return;
    playAudioFile(AUDIO.win, "win");
    setBonusFlashAmount(amount);
    if (amount >= 1000) {
      setBigWinnerAmount(amount);
      setTimeout(() => setBigWinnerAmount(null), 2400);
    }
    setTimeout(() => setBonusFlashAmount(null), 1300);
  }

  function showHiddenPrizeFlash(amount) {
    if (!amount || amount <= 0) return;
    setHiddenPrizeFlash(amount);
    setTimeout(() => setHiddenPrizeFlash(null), 1150);
  }

  function resetBonus() {
    setBonusType(null);
    setBonusIntro(false);
    setBonusCinematic(false);
    setBonusGameVisible(false);
    setBonusFlashAmount(null);
    setBigWinnerAmount(null);
    setSideBonus(null);
    setWheelResult(null);
    setHiddenColumns([]);
    setHiddenPicks([]);
    setHiddenColumnIndex(0);
    setHiddenTargetRank(null);
    setHiddenGameOver(false);
    setHiddenMatchLevel(0);
    setHiddenPrizeFlash(null);
    setFreeSpinsLeft(0);
    setFreeSpinGrid(makeFreeSpinAmountGrid());
    setFreeSpinTotal(0);
    setFreeSpinSpinning(false);
    setFreeSpinExtraAwarded(0);
    setPendingSplitHand(null);
    setPendingDoubleCard(null);
    setPendingDoubleDeck(null);
    setPendingDoubleBet(null);
  }

  function addChip(amount) {
    if (lockBets) return;
    playAudioFile(AUDIO.chip, "chip");
    setLastChip(amount);
    setChipAnimKey((k) => k + 1);
    setBlackjackBet((b) => Math.min(10000, b + amount));
  }

  function reduceMainBet() {
    if (lockBets) return;
    playAudioFile(AUDIO.chip, "chip");
    setChipAnimKey((k) => k + 1);
    setBlackjackBet((b) => Math.max(0, b - Math.min(lastChip || 25, b)));
  }

  function dealRound() {
    playAudioFile(AUDIO.click, "click");
    if (blackjackBet <= 0) {
      setMessage("Add chips to place your bet.");
      return;
    }
    if (credits < roundCost) {
      setCredits((c) => c + 5000);
      setMessage("Demo credits reloaded.");
      return;
    }

    resetBonus();
    setPlayer([]);
    setDealer([]);
    setHitCards([]);
    setSplitHand(null);
    setHandReady(false);
    setPhase("dealing");
    if (spinBetOn || doubleBonusOn || splitBonusOn) setAutoChipDropKey((k) => k + 1);
    setMessage("Dealing cards...");
    playAudioFile(AUDIO.card, "card");
    setCredits((c) => c - roundCost);
    setLastWin(0);

    let workingDeck = deck.length < 16 ? buildDeck() : [...deck];
    let newPlayer = [];
    const shouldForceBlackjack = Math.random() < DEMO_BLACKJACK_CHANCE;
    const shouldForceSplit = !shouldForceBlackjack && Math.random() < DEMO_SPLIT_CHANCE;
    const shouldForceDoubleTotal = !shouldForceBlackjack && !shouldForceSplit && Math.random() < DEMO_DOUBLE_TOTAL_CHANCE;

    if (shouldForceBlackjack) {
      const ace = workingDeck.find((c) => c.rank === "A");
      const ten = workingDeck.find((c) => ["10", "J", "Q", "K"].includes(c.rank));
      if (ace && ten) {
        newPlayer = [ace, ten];
        workingDeck = removeCardsFromDeck(workingDeck, newPlayer);
      }
    }
    if (!newPlayer.length && shouldForceSplit) {
      const rank = randomChoice(["8", "9", "7", "A", "10"]);
      const pair = workingDeck.filter((c) => c.rank === rank).slice(0, 2);
      if (pair.length === 2) {
        newPlayer = pair;
        workingDeck = removeCardsFromDeck(workingDeck, newPlayer);
      }
    }
    if (!newPlayer.length && shouldForceDoubleTotal) {
      const targetTotal = randomChoice([10, 11]);
      const pairs = targetTotal === 10 ? [["5", "5"], ["6", "4"], ["7", "3"], ["8", "2"]] : [["6", "5"], ["7", "4"], ["8", "3"], ["9", "2"]];
      const picked = randomChoice(pairs);
      const first = workingDeck.find((c) => c.rank === picked[0]);
      const second = workingDeck.find((c) => c.rank === picked[1] && c.id !== first?.id);
      if (first && second) {
        newPlayer = [first, second];
        workingDeck = removeCardsFromDeck(workingDeck, newPlayer);
      }
    }
    if (!newPlayer.length) {
      const drawPlayer = drawFrom(workingDeck, 2);
      newPlayer = drawPlayer.drawn;
      workingDeck = drawPlayer.remaining;
    }
    const drawDealer = drawFrom(workingDeck, 2);
    const newDealer = drawDealer.drawn;
    workingDeck = drawDealer.remaining;
    setDeck(workingDeck);
    setPlayer(newPlayer);
    setDealer(newDealer);

    setTimeout(() => {
      setHandReady(true);
      if (spinBetOn && naturalBlackjack(newPlayer)) {
        setPhase("bonus");
        setMessage("Natural blackjack. 21 Spin bonus feature activated.");
        triggerMainBonus();
      } else {
        setPhase("player");
        setMessage(spinBetOn ? "Spin to Hit is live. Reach 21 to trigger a bonus." : "Play a standard blackjack hand.");
      }
    }, 950);
  }

  function launchBonusPanel(type) {
    playAudioFile(AUDIO.bonus, "bonus");
    setBonusType(type);
    setBonusCinematic(true);
    setBonusIntro(false);
    setBonusGameVisible(false);
    setTimeout(() => {
      setBonusCinematic(false);
      setBonusGameVisible(true);
    }, 850);
  }

  function triggerMainBonus() {
    const type = MAIN_BONUS_TYPES[bonusIndex % MAIN_BONUS_TYPES.length];
    setBonusIndex((i) => i + 1);
    launchBonusPanel(type);
    if (type === "HIDDEN HAND") {
      setHiddenColumns(makeHiddenHandColumns());
      setHiddenPicks([]);
      setHiddenColumnIndex(0);
      setHiddenTargetRank(null);
      setHiddenGameOver(false);
      setHiddenMatchLevel(0);
      setHiddenPrizeFlash(null);
    }
    if (type === "FREE SPINS FEATURE") {
      setFreeSpinsLeft(3);
      setFreeSpinGrid(makeFreeSpinAmountGrid());
      setFreeSpinTotal(0);
      setFreeSpinExtraAwarded(0);
    }
  }

  function spinToHit() {
    if (phase !== "player" || spinning || !handReady) return;
    playAudioFile(AUDIO.spin, "spin");
    setSpinning(true);
    setAnticipatingSpin(false);
    setMessage("Spinning for your hit card...");
    setTimeout(() => {
      setAnticipatingSpin(true);
      setMessage("Almost there...");
      playAudioFile(AUDIO.stop, "stop");
    }, 450);
    setTimeout(() => {
      const draw = drawFrom(deck, 1);
      let card = draw.drawn[0];
      let nextDeck = draw.remaining;
      if (spinBetOn && playerTotal < 21 && Math.random() < DEMO_SPIN_TO_21_CHANCE) {
        const needed = 21 - playerTotal;
        const demoCard = findCardByValue(deck, needed);
        if (demoCard) {
          card = demoCard;
          nextDeck = removeCardsFromDeck(deck, [demoCard]);
        }
      }
      const nextPlayer = [...player, card];
      setDeck(nextDeck);
      setPlayer(nextPlayer);
      setHitCards((h) => [...h, card]);
      setSpinning(false);
      setAnticipatingSpin(false);
      playAudioFile(AUDIO.card, "card");
      const total = handValue(nextPlayer);
      if (total === 21 && spinBetOn) {
        setPhase("bonus");
        setMessage("Player hand = 21. Bonus feature activated.");
        triggerMainBonus();
      } else if (total > 21) {
        setLastWin(currentLoss);
        setPhase("complete");
        setMessage("Player loses. BUSTED.");
      } else {
        setMessage(`Player has ${total}. Spin again or stand.`);
      }
    }, 1350);
  }

  function stand() {
    playAudioFile(AUDIO.click, "click");
    if (phase !== "player" || !handReady) return;
    playDealer(player, deck);
  }

  function splitPair() {
    playAudioFile(AUDIO.click, "click");
    if (!canSplit) {
      if (player.length === 2 && player[0]?.rank === player[1]?.rank && cardValue(player[0]) === 10) {
        setMessage("Cannot split 10s.");
      } else {
        setMessage("Split is only available when your first two cards match.");
      }
      return;
    }
    setCredits((c) => c - blackjackBet);
    const draw = drawFrom(deck, 2);
    const originalLeft = player[0];
    const originalRight = player[1];
    const firstHand = [originalLeft];
    const secondHandBase = [originalRight];
    const secondHandFinal = [originalRight, draw.drawn[1]];
    const firstHandFinal = [originalLeft, draw.drawn[0]];

    setDeck(draw.remaining);
    setPlayer(firstHand);
    setSplitHand(secondHandBase);
    setPendingSplitHand({ firstHandFinal, secondHandFinal, cardA: draw.drawn[0], cardB: draw.drawn[1] });

    if (splitBonusOn) {
      setSideBonus({ kind: "split", cardA: draw.drawn[0], cardB: draw.drawn[1], amountA: randomChoice(SIDE_BONUS_AMOUNTS), amountB: randomChoice(SIDE_BONUS_AMOUNTS), spinning: false, revealed: false });
      setPhase("bonus");
      setMessage("Split Screen side bet activated.");
      setTimeout(() => launchBonusPanel("SPLIT SCREEN"), 550);
    } else {
      setPlayer(firstHandFinal);
      setSplitHand(secondHandFinal);
      setHitCards((h) => [...h, draw.drawn[0], draw.drawn[1]]);
      setMessage("Split Screen activated. Your pair becomes two hands. Demo plays the first split hand.");
    }
  }

  function doubleDown() {
    playAudioFile(AUDIO.click, "click");
    if (!canDoubleDown) {
      setMessage("Only active on player 10 or 11.");
      return;
    }
    setCredits((c) => c - blackjackBet);
    if (!doubleBonusOn) setSpinning(true);
    setMessage("Double Down / Double Up. One hit card.");
    playAudioFile(AUDIO.spin, "spin");
    setTimeout(() => {
      const draw = drawFrom(deck, 1);
      const card = draw.drawn[0];
      const nextDeck = draw.remaining;
      const nextPlayer = [...player, card];
      setDeck(nextDeck);
      if (!doubleBonusOn) setSpinning(false);

      if (doubleBonusOn) {
        setPendingDoubleCard(card);
        setPendingDoubleDeck(nextDeck);
        setPendingDoubleBet(blackjackBet * 2);
        setSideBonus({ kind: "double", card, amount: randomChoice(SIDE_BONUS_AMOUNTS), spinning: false, revealed: false });
        setPhase("bonus");
        setMessage("Double Up Double Down side bet activated.");
        launchBonusPanel("DOUBLE UP DOUBLE DOWN");
      } else if (handValue(nextPlayer) > 21) {
        setPlayer(nextPlayer);
        setHitCards((h) => [...h, card]);
        setLastWin(-(blackjackBet * 2 + sideBetCost));
        setPhase("complete");
        setMessage("Player loses. BUSTED.");
      } else if (handValue(nextPlayer) === 21 && spinBetOn) {
        setPlayer(nextPlayer);
        setHitCards((h) => [...h, card]);
        setPhase("bonus");
        setMessage("Double down hit card made 21. 21 Spin bonus activated.");
        triggerMainBonus();
      } else {
        setPlayer(nextPlayer);
        setHitCards((h) => [...h, card]);
        playDealer(nextPlayer, nextDeck, blackjackBet * 2);
      }
    }, 900);
  }

  function playDealer(finalPlayer = player, currentDeck = deck, effectiveBet = blackjackBet) {
    let nextDealer = [...dealer];
    let nextDeck = [...currentDeck];
    while (handValue(nextDealer) < 17) {
      const draw = drawFrom(nextDeck, 1);
      nextDealer = [...nextDealer, draw.drawn[0]];
      nextDeck = draw.remaining;
    }
    setDealer(nextDealer);
    setDeck(nextDeck);
    resolveBlackjack(finalPlayer, nextDealer, effectiveBet);
  }

  function resolveBlackjack(finalPlayer, finalDealer, effectiveBet = blackjackBet) {
    const p = handValue(finalPlayer);
    const d = handValue(finalDealer);
    let payout = 0;
    let result = "";
    let netResult = 0;
    if (p > 21) {
      result = "Player loses. BUSTED.";
      netResult = -(effectiveBet + sideBetCost);
    } else if (naturalBlackjack(finalPlayer)) {
      payout = Math.floor(effectiveBet * 2.5);
      result = `Blackjack pays ${payout}.`;
      netResult = payout - effectiveBet - sideBetCost;
    } else if (d > 21 || p > d) {
      payout = effectiveBet * 2;
      result = `Player wins. Paid ${payout}.`;
      netResult = payout - effectiveBet - sideBetCost;
    } else if (p === d) {
      payout = effectiveBet;
      result = "Push. Bet returned.";
      netResult = -sideBetCost;
    } else {
      result = "Player loses.";
      netResult = -(effectiveBet + sideBetCost);
    }
    playAudioFile(netResult > 0 ? AUDIO.win : netResult < 0 ? AUDIO.lose : AUDIO.stop, netResult > 0 ? "win" : netResult < 0 ? "lose" : "stop");
    setCredits((c) => c + payout);
    setLastWin(netResult);
    setPhase("complete");
    setMessage(result);
  }

  function spinWheel() {
    if (bonusType !== "21 BONUS WHEEL") return;
    playAudioFile(AUDIO.spin, "spin");
    setWheelSpinning(true);
    setTimeout(() => {
      const prize = Math.random() < WHEEL_PROGRESSIVE_CHANCE ? "PROGRESSIVE JACKPOT" : randomChoice(WHEEL_PRIZES);
      const amount = resolvePrizeAmount(prize);
      setWheelSpinning(false);
      playAudioFile(AUDIO.stop, "stop");
      setWheelResult(prizeLabel(prize));
      setMessage(prize === "PROGRESSIVE JACKPOT" ? `Progressive Jackpot hits for ${amount} credits!` : `Bonus Wheel lands on ${prizeLabel(prize)}.`);
      setTimeout(() => {
        setCredits((c) => c + amount);
        setLastWin((w) => w + amount);
        showBonusFlash(amount);
        setMessage(prize === "PROGRESSIVE JACKPOT" ? `Progressive Jackpot pays ${amount} credits!` : `Bonus Wheel pays ${amount} credits.`);
      }, 700);
    }, 1100);
  }

  function pickHiddenHand(columnIndex, cardIndex) {
    if (bonusType !== "HIDDEN HAND" || hiddenGameOver || columnIndex !== hiddenColumnIndex) return;
    const card = hiddenColumns[columnIndex]?.[cardIndex];
    if (!card) return;
    const nextPicks = [...hiddenPicks, { columnIndex, cardIndex, card, rank: symbolRank(card) }];
    setHiddenPicks(nextPicks);

    if (columnIndex === 0) {
      setHiddenTargetRank(card);
      setHiddenMatchLevel(0);
      setHiddenColumnIndex(1);
      setMessage(`Hidden Hand: match ${card} exactly in the next column.`);
      return;
    }
    if (card === hiddenTargetRank) {
      const matchLevel = columnIndex;
      setHiddenMatchLevel(matchLevel);
      if (matchLevel === 1 || matchLevel === 2) {
        showHiddenPrizeFlash(hiddenHandPrize(matchLevel, false, blackjackBet));
      }
      const nextColumn = columnIndex + 1;
      if (nextColumn >= 4) {
        const prize = hiddenHandPrize(4, true, blackjackBet);
        setHiddenGameOver(true);
        setCredits((c) => c + prize);
        setLastWin((w) => w + prize);
        showBonusFlash(prize);
        setMessage(`Hidden Hand jackpot match! Four ${hiddenTargetRank}s pay ${prize}.`);
      } else {
        setHiddenColumnIndex(nextColumn);
        setMessage(`Match! Pick ${hiddenTargetRank} in column ${nextColumn + 1}.`);
      }
    } else {
      const prize = hiddenHandPrize(columnIndex, false, blackjackBet);
      setHiddenGameOver(true);
      setCredits((c) => c + prize);
      setLastWin((w) => w + prize);
      showBonusFlash(prize);
      setMessage(`No match. Hidden Hand ends and pays ${prize}.`);
    }
  }

  function playFreeSpin() {
    if (bonusType !== "FREE SPINS FEATURE" || freeSpinsLeft <= 0 || freeSpinSpinning) return;
    playAudioFile(AUDIO.spin, "spin");
    setFreeSpinSpinning(true);
    setMessage("Free Spins Feature reels are spinning...");
    setTimeout(() => {
      const grid = makeFreeSpinAmountGrid(freeSpinExtraAwarded < 2);
      const prize = freeSpinGridValue(grid);
      const rawExtraSpins = grid.filter((s) => s.spins).reduce((sum, s) => sum + (s.spins || 0), 0);
      const remainingExtraSpinCap = Math.max(0, 2 - freeSpinExtraAwarded);
      const awardedExtraSpins = Math.min(rawExtraSpins, remainingExtraSpinCap);
      setFreeSpinGrid(grid);
      setFreeSpinsLeft((s) => Math.max(0, s - 1 + awardedExtraSpins));
      setFreeSpinExtraAwarded((s) => Math.min(2, s + awardedExtraSpins));
      setFreeSpinTotal((t) => t + prize);
      setCredits((c) => c + prize);
      setLastWin((w) => w + prize);
      if (prize > 0) showBonusFlash(prize);
      setFreeSpinSpinning(false);
      setMessage(awardedExtraSpins > 0 ? `Free spin pays ${prize} and awards +${awardedExtraSpins} spins. Extra spin cap used: ${freeSpinExtraAwarded + awardedExtraSpins}/2.` : rawExtraSpins > 0 ? `Free Spins Feature pays ${prize}. Extra spin cap already reached.` : `Free Spins Feature pays ${prize}. Bonus total is now ${freeSpinTotal + prize}.`);
    }, 900);
  }

  function startDoubleSideBonus() {
    playAudioFile(AUDIO.spin, "spin");
    if (!sideBonus || sideBonus.revealed || sideBonus.spinning) return;
    setSideBonus((b) => ({ ...b, spinning: true }));
    setTimeout(() => {
      const amount = sideBonus.amount || 0;
      const card = sideBonus.card || pendingDoubleCard;
      const nextPlayer = card ? [...player, card] : player;
      setSideBonus((b) => ({ ...b, spinning: false, revealed: true }));
      if (card) {
        setPlayer(nextPlayer);
        setHitCards((h) => [...h, card]);
      }
      setPendingDoubleCard(null);
      setCredits((c) => c + amount);
      setLastWin((w) => w + amount);
      showBonusFlash(amount);
      setMessage(`Double Up Double Down bonus pays ${amount}.`);
      setTimeout(() => {
        if (handValue(nextPlayer) > 21) {
          setLastWin(-(blackjackBet * 2 + sideBetCost) + amount);
          setPhase("complete");
          setMessage("Player loses. BUSTED.");
        } else {
          playDealer(nextPlayer, pendingDoubleDeck || deck, pendingDoubleBet || blackjackBet * 2);
        }
      }, 900);
    }, 1000);
  }

  function startSplitSideBonus() {
    playAudioFile(AUDIO.spin, "spin");
    if (!sideBonus || sideBonus.revealed || sideBonus.spinning) return;
    setSideBonus((b) => ({ ...b, spinning: true }));
    setTimeout(() => {
      const amount = (sideBonus.amountA || 0) + (sideBonus.amountB || 0);
      setSideBonus((b) => ({ ...b, spinning: false, revealed: true }));
      if (pendingSplitHand) {
        setPlayer(pendingSplitHand.firstHandFinal);
        setSplitHand(pendingSplitHand.secondHandFinal);
        setHitCards((h) => [...h, pendingSplitHand.cardA, pendingSplitHand.cardB]);
      }
      setPendingSplitHand(null);
      setCredits((c) => c + amount);
      setLastWin((w) => w + amount);
      showBonusFlash(amount);
      setMessage(`Split Screen bonus pays ${amount}.`);
    }, 1000);
  }

  function continueAfterBonus() {
    setBonusGameVisible(false);
    setBonusIntro(false);
    playDealer(player, deck);
  }

 return (
  <div className="slotjack-shell text-white">
    <div className="rotate-overlay">
      <div className="rotate-card">
        <div className="rotate-icon">↻</div>
        <div>Rotate your phone</div>
        <span>SlotJack plays best in landscape mode.</span>
      </div>
    </div>
      <style>{`
        @keyframes buttonPulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.22); }
        }
      `}</style>

     <div
  className="slotjack-stage"
  style={{ transform: `translate(-50%, -50%) scale(${stageScale})` }}
>
        <img src="/assets/table-bg.png" className="absolute inset-0 w-full h-full object-cover select-none" draggable="false" />
        <div className="absolute inset-0 bg-black/10" />
        <AnimatePresence><BonusAmountFlash amount={bonusFlashAmount} /></AnimatePresence>
        <AnimatePresence><BigWinnerFlash amount={bigWinnerAmount} /></AnimatePresence>

        <img src="/assets/dealer-shoe.png" className="absolute top-[-7.8%] right-[-4%] z-10 w-[330px] h-auto drop-shadow-2xl" draggable="false" />

        {bonusCinematic && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[65] bg-black/60 grid place-items-center pointer-events-none">
            <motion.div initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: [0.4, 1.2, 1], rotate: 0 }} transition={{ duration: 0.55 }} className="text-yellow-300 font-black text-7xl drop-shadow-[0_0_45px_rgba(250,204,21,.9)]">
              BONUS ACTIVATED
            </motion.div>
          </motion.div>
        )}


        <img src="/assets/slotjack-logo.png" className="absolute top-[3.5%] left-1/2 -translate-x-1/2 w-[37%] max-w-[595px] z-10" draggable="false" />

        <div className={`absolute top-[2%] left-[3%] z-20 rounded-xl bg-black/80 border-2 border-green-400 px-5 py-3 text-green-400 font-black shadow-[0_0_25px_rgba(34,197,94,.55)] ${progressiveGlow ? "animate-pulse scale-105 shadow-[0_0_60px_rgba(34,197,94,.9)]" : ""}`}>
          <div className="text-xs tracking-widest text-green-200">PROGRESSIVE JACKPOT</div>
          <div className="text-2xl">{PROGRESSIVE_JACKPOT.toLocaleString()} CREDITS</div>
        </div>

        <div className="absolute top-[13%] left-[3%] z-20 rounded-xl bg-black/70 border border-yellow-400/60 px-5 py-3 text-yellow-300 font-black shadow-2xl">
          <div>Credits: {credits.toLocaleString()}</div>
          <div>Round Cost: {roundCost}</div>
          <div>Last Win: {lastWin}</div>
        </div>

        <button
          type="button"
          onClick={() => setSoundEnabled((v) => !v)}
          className="absolute top-[14.2%] right-[5%] z-[140] rounded-full bg-black/80 border-2 border-yellow-300 px-4 py-2 text-yellow-300 text-sm font-black tracking-widest shadow-[0_0_18px_rgba(250,204,21,.45)] hover:scale-105 active:scale-95 transition"
        >
          SOUND {soundEnabled ? "ON" : "OFF"}
        </button>

        <div className="absolute left-[1.4%] top-[32%] z-[70] pointer-events-auto w-[760px] h-[390px]">
          <div className="absolute left-[105px] top-[-32px] z-[35] text-yellow-300 font-black text-xl tracking-[0.22em] drop-shadow-[0_0_10px_rgba(250,204,21,.85)] pointer-events-none">
            SIDE BETS
          </div>
          <SideBetMarker
            label="DOUBLE UP DOUBLE DOWN"
            amount={5}
            active={doubleBonusOn}
            disabled={lockBets}
            onToggle={() => setDoubleBonusOn((v) => !v)}
            icon="/assets/double-down-sidebet.png"
            tooltip="sidebet for extra bonus game on double down hands"
            tooltipClassName="left-[330px] top-[-34px]"
            dropKey={autoChipDropKey}
            className="left-0 top-0 scale-[1.0]"
          />
          <SideBetMarker
            label="SPLIT SCREEN"
            amount={5}
            active={splitBonusOn}
            disabled={lockBets}
            onToggle={() => setSplitBonusOn((v) => !v)}
            icon="/assets/split-screen-sidebet.png"
            tooltip="sidebet for extra bonus game on split hands"
            dropKey={autoChipDropKey}
            className="left-0 top-[105px] scale-[1.0]"
          />
          <SideBetMarker
            label="21 SPIN BONUS"
            amount={10}
            active={spinBetOn}
            disabled={lockBets}
            onToggle={() => setSpinBetOn((v) => !v)}
            icon="/assets/21-spin-sidebet.png"
            tooltip="main sidebet for slot features"
            dropKey={autoChipDropKey}
            className="left-0 top-[210px] scale-[1.0] drop-shadow-[0_0_18px_rgba(255,215,0,.9)]"
          />

          <button
            type="button"
            disabled={lockBets || blackjackBet <= 0}
            onClick={reduceMainBet}
            title="Click to reduce main bet"
            className="absolute left-[135px] top-[305px] w-[120px] h-[110px] flex flex-col items-center justify-center bg-transparent border-0 p-0 pointer-events-auto transition hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
          >
            <div className="relative w-14 h-14 rounded-full border-4 border-yellow-300/70 bg-black/35 grid place-items-center overflow-visible shadow-[0_0_20px_rgba(250,204,21,.5)]">
              {Array.from({ length: Math.min(9, Math.ceil(blackjackBet / 25) || 1) }).map((_, i) => (
                <div
                  key={`rail-chip-${i}`}
                  className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-red-600 via-red-800 to-black border-4 border-yellow-300 shadow-xl grid place-items-center"
                  style={{ transform: `translate(0px, ${8 - i * 7}px)`, zIndex: i }}
                >
                  <span className="text-yellow-100 font-black text-xs">{i === Math.min(8, Math.ceil(blackjackBet / 25) || 1) - 1 ? `$${lastChip}` : ""}</span>
                </div>
              ))}
              <AnimatePresence>
                <motion.div
                  key={chipAnimKey}
                  initial={{ x: -210, y: 45, scale: 0.35, opacity: 0 }}
                  animate={{ x: 0, y: 8 - (Math.min(8, Math.ceil(blackjackBet / 25) || 1) - 1) * 7, scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 240, damping: 15 }}
                  className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-yellow-300 to-red-700 border-4 border-white shadow-2xl grid place-items-center text-black text-xs font-black"
                >
                  ${lastChip}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-2 text-center text-yellow-300 font-black text-lg drop-shadow-[0_0_8px_rgba(0,0,0,.9)]">MAIN BET</div>
          </button>
        </div>

        <div className="absolute top-[25.5%] left-[49.5%] -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="mb-2 rounded-xl bg-black/75 border border-yellow-300/60 px-5 py-1 text-yellow-300 font-black text-sm shadow-xl">DEALER HAND</div>
          <div className="flex gap-3 min-h-[105px]">
            {dealer.length ? dealer.map((card, i) => <CardFace key={`${card.rank}${card.suit}-${i}`} card={card} hidden={(phase === "player" || phase === "bonus") && i === 1} delay={i === 0 ? 0.18 : 0.54} />) : null}
          </div>
          <div className="mt-1 bg-black/65 border border-yellow-300/50 rounded-full px-3 py-1 font-black text-yellow-300 text-sm">
            {dealer.length ? ((phase === "player" || phase === "bonus") ? cardValue(dealer[0]) : dealerTotal) : "—"}
          </div>
        </div>

        <div className="absolute top-[54.5%] left-[49.5%] -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="mb-2 rounded-xl bg-black/75 border border-yellow-300/60 px-5 py-1 text-yellow-300 font-black text-sm shadow-xl">PLAYER HAND</div>
          <div className="flex gap-3 min-h-[105px]">
            {player.length ? player.map((card, i) => <CardFace key={`${card.rank}${card.suit}-${i}`} card={card} delay={i === 0 ? 0.36 : i === 1 ? 0.72 : 0} fromShoe={i < 2} />) : null}
          </div>
          <div className="mt-1 bg-black/70 border border-yellow-300/50 rounded-full px-4 py-1 text-xl font-black text-yellow-300">
            {player.length ? playerTotal : "—"}
          </div>
          {splitHand ? (
            <div className="absolute left-[112%] top-[10%] flex flex-col items-center">
              <div className="mb-2 rounded-xl bg-purple-950/90 border border-yellow-300 px-3 py-1 text-yellow-300 font-black text-sm">SPLIT HAND</div>
              <div className="flex gap-2">
                {splitHand.map((card, i) => <CardFace key={`split-${card.rank}${card.suit}-${i}`} card={card} delay={0.1 * i} fromShoe={false} />)}
              </div>
              <div className="mt-1 bg-black/70 border border-yellow-300/50 rounded-full px-4 py-1 text-lg font-black text-yellow-300">{handValue(splitHand)}</div>
            </div>
          ) : null}
        </div>

        <div className="absolute top-[41.5%] right-[1.5%] z-20 w-[38%] max-w-[610px]">
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-yellow-300 font-black text-3xl tracking-wider drop-shadow-[0_0_12px_rgba(250,204,21,.9)]">SPIN TO HIT</div>
          <img src="/assets/spin-to-hit-panel.png" className={`w-full drop-shadow-2xl ${spinning ? "animate-pulse" : ""} ${anticipatingSpin ? "scale-105 brightness-125" : ""}`} draggable="false" />
          <div className="absolute inset-x-[9%] top-[40%] h-[42%] grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`rounded-md grid place-items-center font-black text-white text-xl ${hitCards[i] ? "bg-white" : "bg-black/20"}`}>
                {hitCards[i] ? (
                  <motion.span initial={{ scale: 0.2, opacity: 0, rotateY: 90 }} animate={{ scale: 1, opacity: 1, rotateY: 0 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} className={`${hitCards[i].suit === "♥" || hitCards[i].suit === "♦" ? "text-red-600" : "text-black"}`}>
                    {hitCards[i].rank}{hitCards[i].suit}
                  </motion.span>
                ) : spinning && i === hitCards.length ? <SpinningReelCell active /> : ""}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute top-[60%] right-[4.5%] z-[110] pointer-events-auto">
          {phase === "idle" || phase === "complete" ? <ImgButton src="/assets/deal-button.png" onClick={dealRound} disabled={false} className="w-[405px] h-[183px]" glow="gold" /> : null}
        </div>

        <div className="absolute bottom-[9.5%] left-[50%] -translate-x-1/2 z-[95] flex items-center justify-center gap-0 pointer-events-auto">
          <ImgButton src="/assets/stand-button.png" onClick={stand} disabled={phase !== "player" || spinning || !handReady} className="w-[105px] h-[105px]" glow="blue" />
          <ImgButton src="/assets/spin-button.png" onClick={spinToHit} disabled={phase !== "player" || spinning || !handReady} className="w-[145px] h-[145px]" glow="red" />
        </div>

        <div className="absolute bottom-[7.5%] left-[83%] -translate-x-1/2 z-[88] flex items-end justify-center gap-0 pointer-events-auto">
          <div className="flex flex-col items-center gap-1">
            <ImgButton src="/assets/double-button.png" onClick={doubleDown} disabled={!canDoubleDown || spinning} className="w-[260px] h-[132px]" glow="gold" />
            {doubleBonusOn ? (
              <div className="rounded-lg bg-black/80 border border-yellow-300/70 px-3 py-1 text-yellow-300 font-black text-[11px] leading-tight text-center shadow-xl">
                ONLY ACTIVE ON PLAYER 10 OR 11
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1 -ml-8">
            <ImgButton src="/assets/split-button.png" onClick={splitPair} disabled={!canSplit || spinning} className="w-[310px] h-[158px]" glow="purple" />
            {splitBonusOn ? (
              <div className="rounded-lg bg-black/80 border border-yellow-300/70 px-3 py-1 text-yellow-300 font-black text-[11px] leading-tight text-center shadow-xl">
                CANNOT SPLIT 10s
              </div>
            ) : null}
          </div>
        </div>

        <div className="absolute bottom-[5%] left-[4%] z-30">
          <div className="inline-block mb-2 rounded-xl bg-black/75 border border-yellow-300/60 px-3 py-2 text-yellow-300 font-black shadow-xl">
            <div className="text-xs tracking-widest">CHIP BET — CLICK TO ADD</div>
          </div>
          <div className="flex gap-2">
            {[5, 10, 25, 50, 100].map((amount) => (
              <button key={amount} disabled={lockBets} onClick={() => addChip(amount)} className="w-[62px] h-[62px] rounded-full border-4 font-black shadow-xl bg-slate-900 text-white border-slate-500 disabled:opacity-40">
                {amount}
              </button>
            ))}
          </div>
        </div>

        <div className="absolute top-[19%] right-[5%] z-30 max-w-[320px] rounded-xl bg-black/75 border border-yellow-400/50 p-3 shadow-2xl">
          <div className="text-yellow-300 text-xs font-black tracking-widest">GAME FEED</div>
          <AnimatePresence mode="wait">
            <motion.div key={message} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-1 text-lg font-black">
              <GameFeedMessage message={message} />
            </motion.div>
          </AnimatePresence>
        </div>

        {phase === "bonus" && bonusGameVisible && (
          <motion.div initial={{ x: -520, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 115, damping: 18 }} className="absolute top-[145px] left-[48px] z-[80] w-[540px] h-[665px] overflow-y-auto overflow-x-hidden touch-pan-y rounded-3xl bg-[#10216c]/95 border-4 border-yellow-300 p-4 pb-32 text-center shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ WebkitOverflowScrolling: "touch" }}>
            {bonusType === "DOUBLE UP DOUBLE DOWN" && sideBonus && (
              <div className="space-y-4">
                <MiniSpinDevice title="HIT CARD REEL" value={sideBonus.revealed ? `${sideBonus.card.rank}${sideBonus.card.suit}` : null} spinning={sideBonus.spinning} />
                <MiniSpinDevice title="BONUS AMOUNT REEL" value={sideBonus.revealed ? `$${sideBonus.amount}` : null} spinning={sideBonus.spinning} type="amount" />
                <button onClick={startDoubleSideBonus} disabled={sideBonus.spinning || sideBonus.revealed} className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-black disabled:opacity-40">SPIN DOUBLE BONUS</button>
              </div>
            )}

            {bonusType === "SPLIT SCREEN" && sideBonus && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <MiniSpinDevice title="SPLIT HAND 1" value={sideBonus.revealed ? `${sideBonus.cardA.rank}${sideBonus.cardA.suit}` : null} spinning={sideBonus.spinning} />
                  <MiniSpinDevice title="SPLIT HAND 2" value={sideBonus.revealed ? `${sideBonus.cardB.rank}${sideBonus.cardB.suit}` : null} spinning={sideBonus.spinning} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniSpinDevice title="BONUS 1" value={sideBonus.revealed ? `$${sideBonus.amountA}` : null} spinning={sideBonus.spinning} type="amount" />
                  <MiniSpinDevice title="BONUS 2" value={sideBonus.revealed ? `$${sideBonus.amountB}` : null} spinning={sideBonus.spinning} type="amount" />
                </div>
                <button onClick={startSplitSideBonus} disabled={sideBonus.spinning || sideBonus.revealed} className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-black disabled:opacity-40">SPIN SPLIT SCREEN</button>
              </div>
            )}

            {bonusType === "21 BONUS WHEEL" && (
              <>
                <motion.div
                  animate={wheelSpinning ? { rotate: 1440 } : { rotate: 0 }}
                  transition={{ duration: 1 }}
                  className="relative mx-auto w-56 h-56 rounded-full border-8 border-yellow-300 overflow-hidden shadow-[0_0_32px_rgba(250,204,21,.55)]"
                  style={{
                    background: `conic-gradient(${WHEEL_SEGMENTS.map((_, i) => {
                      const segment = 360 / WHEEL_SEGMENTS.length;
                      const colors = ["#7c2d12", "#facc15", "#2563eb", "#4c1d95"];
                      return `${colors[i % colors.length]} ${i * segment}deg ${(i + 1) * segment}deg`;
                    }).join(", ")})`,
                  }}
                >
                  {WHEEL_SEGMENTS.map((prize, i) => {
                    const segment = 360 / WHEEL_SEGMENTS.length;
                    const angle = i * segment + segment / 2;
                    const label = typeof prize === "number" ? String(prize) : "??";
                    return (
                      <div
                        key={`${prize}-${i}`}
                        className="absolute left-1/2 top-1/2 z-10 w-[34px] h-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 border border-white/50 grid place-items-center text-[10px] leading-none font-black text-white drop-shadow-[0_0_5px_rgba(0,0,0,1)]"
                        style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-78px) rotate(${-angle}deg)` }}
                      >
                        {label}
                      </div>
                    );
                  })}
                  {WHEEL_SEGMENTS.map((_, i) => {
                    const segment = 360 / WHEEL_SEGMENTS.length;
                    return (
                      <div
                        key={`divider-${i}`}
                        className="absolute left-1/2 top-1/2 h-[112px] w-[2px] origin-bottom bg-black/45"
                        style={{ transform: `translate(-50%, -100%) rotate(${i * segment}deg)` }}
                      />
                    );
                  })}
                  <div className="absolute left-1/2 top-1/2 z-20 w-24 h-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black border-4 border-yellow-300 grid place-items-center text-yellow-300 text-2xl font-black shadow-[0_0_18px_rgba(0,0,0,.9)]">{wheelResult ?? "SPIN"}</div>
                </motion.div>
                <button onClick={spinWheel} disabled={wheelSpinning || wheelResult !== null} className="mt-4 bg-yellow-400 text-black px-6 py-3 rounded-xl font-black disabled:opacity-40">SPIN WHEEL</button>
              </>
            )}

            {bonusType === "HIDDEN HAND" && (
              <div className="space-y-2">
                <div className="text-xs text-yellow-100 font-black">Pick one card from each illuminated column. Keep matching the exact card to climb the prize.</div>
              <div className="mt-6 rounded-xl bg-black/70 border border-yellow-300/60 p-4 text-yellow-200 font-black text-sm">
                <div className="text-yellow-300 text-lg mb-2">PRIZE LADDER</div>
                <div className={`rounded-lg px-3 py-1 transition ${hiddenMatchLevel >= 1 ? "bg-green-500 text-black shadow-[0_0_18px_rgba(34,197,94,.9)] scale-105" : ""}`}>Match 1 = 2× Main Bet</div>
                <div className={`rounded-lg px-3 py-1 transition ${hiddenMatchLevel >= 2 ? "bg-green-500 text-black shadow-[0_0_18px_rgba(34,197,94,.9)] scale-105" : ""}`}>Match 2 = 10× Main Bet</div>
                <div className={`rounded-lg px-3 py-1 transition ${hiddenMatchLevel >= 4 ? "bg-green-500 text-black shadow-[0_0_18px_rgba(34,197,94,.9)] scale-105" : ""}`}>Match All = 100× Main Bet</div>
              </div>

              <AnimatePresence>
                {hiddenPrizeFlash ? (
                  <motion.div
                    key={hiddenPrizeFlash}
                    initial={{ opacity: 0, scale: 0.5, y: 18 }}
                    animate={{ opacity: 1, scale: [0.5, 1.15, 1], y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -16 }}
                    className="absolute left-1/2 top-[185px] -translate-x-1/2 z-[120] rounded-2xl bg-green-500 border-4 border-white px-6 py-3 text-black text-3xl font-black shadow-[0_0_38px_rgba(34,197,94,.95)] pointer-events-none"
                  >
                    +{hiddenPrizeFlash.toLocaleString()}
                  </motion.div>
                ) : null}
              </AnimatePresence>

                <div className="grid grid-cols-4 gap-2 mx-auto">
                  {Array.from({ length: 4 }).map((_, colIndex) => {
                    const active = colIndex === hiddenColumnIndex && !hiddenGameOver;
                    return (
                      <div key={colIndex} className={`rounded-2xl border-4 p-1.5 space-y-1.5 ${active ? "border-yellow-300 bg-yellow-300/20 shadow-[0_0_22px_rgba(250,204,21,.7)]" : "border-white/20 bg-black/30"}`}>
                        <div className={`text-xs font-black ${active ? "text-yellow-300" : "text-white/50"}`}>COLUMN {colIndex + 1}</div>
                        {Array.from({ length: 3 }).map((_, cardIndex) => {
                          const card = hiddenColumns[colIndex]?.[cardIndex] || "?";
                          const picked = hiddenPicks.some((p) => p.columnIndex === colIndex && p.cardIndex === cardIndex);
                          const red = card.includes("♥") || card.includes("♦");
                          return (
                            <button key={`${colIndex}-${cardIndex}`} disabled={!active || picked} onClick={() => pickHiddenHand(colIndex, cardIndex)} className={`h-14 w-full rounded-xl border-2 font-black text-xl transition ${picked ? "bg-white border-yellow-300" : active ? "bg-gradient-to-br from-red-800 to-slate-950 border-yellow-300 hover:scale-105" : "bg-slate-900 border-slate-700 opacity-45"}`}>
                              {picked ? <span className={red ? "text-red-600" : "text-black"}>{card}</span> : <span className="text-yellow-300">?</span>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl bg-black/50 border border-yellow-300/60 p-2 text-yellow-300 font-black">
                  {hiddenTargetRank ? `Match ${hiddenTargetRank} exactly | Matches: ${Math.max(0, hiddenPicks.length - 1)}` : "Pick your first card to set the target."}
                </div>
              </div>
            )}

            {bonusType === "FREE SPINS FEATURE" && (
              <div className="space-y-2">
                <div className="text-2xl font-black text-yellow-300">Free Spins Feature</div>
                <div className="text-sm font-black text-white">3 Free Spins</div>
                <div className="grid grid-cols-3 gap-2 max-w-[360px] mx-auto rounded-2xl bg-black/50 border-4 border-yellow-300 p-2 overflow-hidden">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const symbol = freeSpinGrid[i] || FREE_SPIN_SYMBOLS[0];
                    const isBigBonus = ["GRAND", "MAJOR", "MINI", "WILD", "PROGRESSIVE", "+2 SPINS"].includes(symbol.label);
                    return (
                      <div key={`${symbol.label}-${i}-${freeSpinsLeft}`} className={`h-14 rounded-xl border-2 grid place-items-center overflow-hidden ${isBigBonus ? "bg-gradient-to-b from-yellow-200 to-yellow-500 border-white" : "bg-white border-slate-200"}`}>
                        {freeSpinSpinning ? (
                          <motion.div animate={{ y: ["-65%", "18%", "-65%"] }} transition={{ duration: 0.16, repeat: Infinity, ease: "linear" }} className="flex flex-col gap-4">
                            {["$2", "$5", "$10", ...(freeSpinExtraAwarded < 2 ? ["+2 SPINS"] : []), "WILD", "MINI", "MAJOR"].map((s, k) => (
                              <div key={k} className={`text-lg font-black ${["WILD", "MINI", "MAJOR", "+2 SPINS"].includes(s) ? "text-red-700" : "text-black"}`}>{s}</div>
                            ))}
                          </motion.div>
                        ) : (
                          <div className="text-center">
                            <div className={`text-lg font-black ${isBigBonus ? "text-red-800" : "text-black"}`}>{symbol.label}</div>
                            {symbol.value > 0 ? <div className="text-[10px] font-black text-green-800">+${symbol.value.toLocaleString()}</div> : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center justify-center gap-5">
                  <div className="rounded-xl bg-black/60 border border-yellow-300 px-3 py-2 text-yellow-300 font-black text-sm">Spins Left: {freeSpinsLeft}</div>
                  <div className="rounded-xl bg-black/60 border border-green-400 px-3 py-2 text-green-400 font-black text-sm">Bonus Total: ${freeSpinTotal.toLocaleString()}</div>
                  <div className="rounded-xl bg-black/60 border border-cyan-300 px-3 py-2 text-cyan-200 font-black text-sm">Extra Spins: {freeSpinExtraAwarded}/2</div>
                </div>
                <button onClick={playFreeSpin} disabled={freeSpinsLeft <= 0 || freeSpinSpinning} className="mt-1 bg-yellow-400 text-black px-6 py-2 rounded-xl font-black disabled:opacity-40">PLAY FREE SPIN</button>
              </div>
            )}

            <button onClick={continueAfterBonus} className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white text-black px-7 py-3 rounded-xl font-black z-[999] pointer-events-auto shadow-2xl">BACK TO TABLE</button>
          </motion.div>
        )}
      </div>
    </div>
  );
}