import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const MAIN_BONUS_TYPES = ["21 BONUS WHEEL", "HIDDEN HAND", "FREE SPINS FEATURE"];
const PROGRESSIVE_JACKPOT = 500000;
const WHEEL_PRIZES = [10, 20, 25, 40, 50, 75, 100, 150, "MINI", "MAJOR", "GRAND"];
const WHEEL_SEGMENTS = [...WHEEL_PRIZES, "PROGRESSIVE JACKPOT"];
const SIDE_BONUS_AMOUNTS = [5, 10, 15, 20, 25, 40, 50, 75];
const FREE_SPIN_SYMBOLS = [
  { label: "$2", value: 2 },
  { label: "$3", value: 3 },
  { label: "$5", value: 5 },
  { label: "$8", value: 8 },
  { label: "$10", value: 10 },
  { label: "$15", value: 15 },
  { label: "$20", value: 20 },
  { label: "+2 SPINS", value: 0, spins: 2 },
  { label: "+2 SPINS", value: 0, spins: 2 },
  { label: "WILD", value: 5 },
  { label: "MINI", value: 25 },
  { label: "MAJOR", value: 100 },
  { label: "GRAND", value: 1000 },
  { label: "—", value: 0 },
  { label: "—", value: 0 },
];

const DEMO_BLACKJACK_CHANCE = 0.10;
const DEMO_SPLIT_CHANCE = 0.125;
const DEMO_DOUBLE_TOTAL_CHANCE = 0.155;
const DEMO_SPIN_TO_21_CHANCE = 0.36;
const WHEEL_PROGRESSIVE_CHANCE = 0.02;
const FREE_SPIN_PROGRESSIVE_CHANCE = 0.001;

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

  bigWin: "/assets/audio/big_win.mp3",
  twentyOne: "/assets/audio/twenty_one.mp3",
  bonusAmount: "/assets/audio/bonus_amount.mp3",
  doubleDownPress: "/assets/audio/double_down_press.mp3",
  splitPress: "/assets/audio/split_press.mp3",
  hiddenMatch: "/assets/audio/hidden_match.mp3",
  hiddenRamp3: "/assets/audio/hidden_ramp_3.mp3",
  hiddenRamp3Win: "/assets/audio/hidden_ramp_3_win.mp3",
  hiddenRamp3Lose: "/assets/audio/hidden_ramp_3_lose.mp3",
  hiddenRamp4: "/assets/audio/hidden_ramp_4.mp3",
  standPress: "/assets/audio/stand_press.mp3",
  spinPress: "/assets/audio/spin_press.mp3",
  quickStop: "/assets/audio/quick_stop.mp3",
  regularWin: "/assets/audio/regular_win.mp3",
};

function playTone(kind = "click") {
  // Synthetic browser tones disabled; all intentional audio goes through playAudioFile.
  return;
}

const audioCache = new Map();
let lastSoundAt = 0;
const exclusiveAudioPlaying = new Set();
let bigWinLockedUntil = 0;

function allAudioSources() {
  return Object.values(AUDIO).flat().filter(Boolean);
}

function warmAudioCache() {
  if (typeof window === "undefined") return;
  allAudioSources().forEach((src) => {
    if (audioCache.has(src)) return;
    try {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.load();
      audioCache.set(src, audio);
    } catch {}
  });
}

function pickAudioSource(src, fallbackKind = "click") {
  if (Array.isArray(src)) {
    if (src.length === 0) return null;
    if (fallbackKind === "bonus" && typeof window !== "undefined") {
      const bonusIndex = window.__slotjackBonusAudioIndex || 0;
      const chosen = src[bonusIndex % src.length];
      window.__slotjackBonusAudioIndex = bonusIndex + 1;
      return chosen;
    }
    return src[Math.floor(Math.random() * src.length)];
  }
  return src;
}

function playAudioFile(src, fallbackKind = "click") {
  if (typeof window !== "undefined" && window.__slotjackSoundEnabled === false) return;

  // Suppress the old short UI/result files that read like browser beeps.
  // Custom SFX are allowed through.
  if (["click", "stop", "win", "lose"].includes(fallbackKind)) return;

  // Do not stack long/important sounds. If one is already playing, skip the new one.
  const EXCLUSIVE_KINDS = new Set(["bigWin"]);
  if (fallbackKind === "bigWin") {
    const now = Date.now();
    if (exclusiveAudioPlaying.has("bigWin") || now < bigWinLockedUntil) return;
    bigWinLockedUntil = now + 3200;
  }
  if (EXCLUSIVE_KINDS.has(fallbackKind) && exclusiveAudioPlaying.has(fallbackKind)) return;

  const VOLUME = {
    chip: 0.13,
    card: 0.16,
    spin: 0.16,
    bonus: 0.20,
    bigWin: 0.30,
    twentyOne: 0.26,
    bonusAmount: 0.24,
    doubleDownPress: 0.24,
    splitPress: 0.24,
    hiddenMatch: 0.23,
    hiddenRamp3: 0.24,
    hiddenRamp3Win: 0.28,
    hiddenRamp3Lose: 0.26,
    hiddenRamp4: 0.27,
    standPress: 0.22,
    spinPress: 0.22,
    quickStop: 0.23,
    regularWin: 0.24,
  };

  try {
    const now = Date.now();

    // Only throttle tiny repeated chip/card sounds. Never throttle quickStop or custom event sounds.
    if (now - lastSoundAt < 25 && ["card", "chip"].includes(fallbackKind)) return;
    if (["card", "chip"].includes(fallbackKind)) lastSoundAt = now;

    const chosenSrc = pickAudioSource(src, fallbackKind);
    if (!chosenSrc) return;

    if (!audioCache.has(chosenSrc)) warmAudioCache();
    const cached = audioCache.get(chosenSrc);
    const audio = cached ? cached.cloneNode(true) : new Audio(chosenSrc);
    audio.volume = VOLUME[fallbackKind] ?? 0.18;
    audio.currentTime = 0;

    if (EXCLUSIVE_KINDS.has(fallbackKind)) {
      exclusiveAudioPlaying.add(fallbackKind);
      const release = () => exclusiveAudioPlaying.delete(fallbackKind);
      audio.addEventListener("ended", release, { once: true });
      audio.addEventListener("error", release, { once: true });
      setTimeout(release, 3200);
    }

    const result = audio.play();
    if (result?.catch) {
      result.catch(() => {
        if (EXCLUSIVE_KINDS.has(fallbackKind)) exclusiveAudioPlaying.delete(fallbackKind);
      });
    }
  } catch {
    if (EXCLUSIVE_KINDS.has(fallbackKind)) exclusiveAudioPlaying.delete(fallbackKind);
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
function hardHandValue(hand) {
  return hand.reduce((sum, card) => {
    if (!card) return sum;
    if (card.rank === "A") return sum + 1;
    return sum + cardValue(card);
  }, 0);
}
function isSoftHand(hand) {
  return hand.some((card) => card?.rank === "A") && hardHandValue(hand) + 10 === handValue(hand);
}
function handDisplayValue(hand) {
  const hard = hardHandValue(hand);
  const best = handValue(hand);
  if (isSoftHand(hand) && hard !== best) return `${hard}/${best}`;
  return String(best);
}
function canDoubleTotal(hand) {
  const hard = hardHandValue(hand);
  const best = handValue(hand);
  return [10, 11].includes(hard) || [10, 11].includes(best);
}
function naturalBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}
function randomChoice(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function money(value) {
  const num = Number(value) || 0;
  const sign = num < 0 ? "-" : "";
  return `${sign}$${Math.abs(num).toLocaleString()}`;
}
function symbolRank(symbol) {
  return String(symbol).replace(/[♠♥♦♣]/g, "");
}
function findCardByValue(deck, value) {
  return deck.find((card) => cardValue(card) === value);
}
function findNonDealerBlackjackSecondCard(deck, dealerFirst) {
  if (!dealerFirst) return null;
  return deck.find((card) => handValue([dealerFirst, card]) !== 21);
}
function findDealerHitAvoidingExact21(deck, currentDealer) {
  const currentTotal = handValue(currentDealer);
  return deck.find((card) => handValue([...currentDealer, card]) !== 21 && handValue([...currentDealer, card]) >= currentTotal);
}
function resolvePrizeAmount(prize) {
  if (prize === "PROGRESSIVE JACKPOT") return PROGRESSIVE_JACKPOT;
  if (prize === "MINI") return 100;
  if (prize === "MAJOR") return 1000;
  if (prize === "GRAND") return 10000;
  return Number(prize) || 0;
}
function prizeLabel(prize) {
  if (prize === "PROGRESSIVE JACKPOT") return "PROGRESSIVE";
  if (["MINI", "MAJOR", "GRAND"].includes(prize)) return `$${resolvePrizeAmount(prize).toLocaleString()}`;
  return String(prize);
}
function makeFreeSpinAmountGrid(allowExtraSpins = true) {
  const availableSymbols = allowExtraSpins
    ? FREE_SPIN_SYMBOLS
    : FREE_SPIN_SYMBOLS.filter((symbol) => !symbol.spins);
  const grid = Array.from({ length: 9 }, () => randomChoice(availableSymbols));
  let grandSeen = false;
  let majorSeen = false;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]?.label === "GRAND") {
      if (grandSeen || Math.random() < 0.62) grid[i] = randomChoice([{ label: "$10", value: 10 }, { label: "$20", value: 20 }, { label: "MINI", value: 25 }]);
      grandSeen = true;
    }
    if (grid[i]?.label === "MAJOR") {
      if (majorSeen || Math.random() < 0.32) grid[i] = randomChoice([{ label: "$15", value: 15 }, { label: "$20", value: 20 }, { label: "MINI", value: 25 }]);
      majorSeen = true;
    }
  }
  if (allowExtraSpins && !grid.some((symbol) => symbol?.spins) && Math.random() < 0.34) {
    grid[Math.floor(Math.random() * grid.length)] = { label: "+2 SPINS", value: 0, spins: 2 };
  }
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
  const safeCard = hidden ? { rank: "?", suit: "", id: card.id } : card;
  const red = !hidden && (safeCard.suit === "♥" || safeCard.suit === "♦");
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
          <div className={`font-black text-xl leading-none ${red ? "text-red-600" : "text-black"}`}>{safeCard.rank}</div>
          <div className={`text-4xl text-center leading-none ${red ? "text-red-600" : "text-black"}`}>{safeCard.suit}</div>
          <div className={`font-black text-xl self-end leading-none ${red ? "text-red-600" : "text-black"}`}>{safeCard.rank}</div>
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
            return <div key={i} className={`h-12 w-[86%] rounded-md bg-white border border-slate-200 grid place-items-center font-black text-[26px] leading-none tracking-[-0.05em] shadow-md ${red ? "text-red-600" : "text-black"}`}>{s}</div>;
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
      className={`relative z-[120] pointer-events-auto bg-transparent border-0 p-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 transition-transform duration-200 ${
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
          <div className={`${small ? "w-8 h-8 text-sm" : "w-11 h-11 text-xl"} rounded-full border-2 border-yellow-200 grid place-items-center text-yellow-200 font-black`}>${amount.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}


function SideBetMarker({ label, amount, active, disabled, onToggle, icon, className = "", dropKey = 0, tooltip = "", tooltipClassName = "", tooltipOpen = false, onTooltipToggle, hoverEnabled = true, onTooltipMouseLeave }) {
  return (
    <div onMouseLeave={onTooltipMouseLeave} className={`group absolute z-30 flex items-center gap-[2px] ${className}`}>
      {tooltip ? (
        <div className={`absolute z-[200] ${tooltipOpen ? "block" : hoverEnabled ? "hidden group-hover:block" : "hidden"} w-[260px] rounded-xl bg-black/90 border-2 border-yellow-300 px-4 py-2 text-yellow-200 text-[13px] font-black leading-tight shadow-[0_0_22px_rgba(250,204,21,.55)] pointer-events-none ${tooltipClassName || "left-[92px] top-[-46px]"}`}>
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
        className={`relative w-[225px] h-[92px] bg-transparent border-0 p-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 transition ${
          active ? "opacity-100" : "opacity-50 grayscale"
        } ${disabled ? "cursor-not-allowed" : "hover:scale-105 active:scale-95"}`}
      >
        {icon ? (
          <img src={icon} className="absolute inset-0 w-full h-full object-contain p-0 pointer-events-none scale-[1.12]" draggable="false" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-yellow-300 font-black text-sm leading-tight px-2">{label}</span>
        )}
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        title={active ? "Click to remove side bet" : "Click to add side bet"}
        className={`relative -ml-[2px] w-14 h-14 rounded-full border-4 border-yellow-300 grid place-items-center shadow-[0_0_18px_rgba(250,204,21,.7)] transition bg-transparent p-0 ${
          active ? "bg-gradient-to-br from-red-500 via-red-800 to-black opacity-100" : "bg-slate-800 opacity-35"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer hover:scale-105 active:scale-95"}`}
      >
        {active ? (
          <motion.div
            key={dropKey}
            initial={{ x: -95, y: -55, scale: 0.35, opacity: 0 }}
            animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 15 }}
            className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500 via-red-800 to-black border-4 border-yellow-300 shadow-2xl"
          />
        ) : null}
        <div className="relative z-10 w-9 h-9 rounded-full border-2 border-yellow-100 grid place-items-center text-yellow-100 font-black text-sm pointer-events-none">
          ${amount.toLocaleString()}
        </div>
      </button>

      {active ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTooltipToggle?.();
          }}
          className="ml-2 whitespace-nowrap text-green-400 text-[12px] font-black tracking-wider uppercase drop-shadow-[0_0_10px_rgba(34,197,94,.95)] bg-transparent border-0 p-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 cursor-pointer hover:scale-105 active:scale-95 transition"
        >
          BONUS ACTIVE
        </button>
      ) : null}
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
              return <div key={i} className={`h-12 w-[86%] rounded-md bg-white grid place-items-center font-black text-[40px] leading-none ${red ? "text-red-600" : "text-black"}`}>{s}</div>;
            })}
          </motion.div>
        ) : (
          <div className={`h-full grid place-items-center bg-white text-5xl font-black ${String(value).includes("♥") || String(value).includes("♦") ? "text-red-600" : "text-black"}`}>{value || "?"}</div>
        )}
      </div>
    </div>
  );
}

function BonusAmountFlash({ amount }) {
  if (!amount) return null;
  return (
    <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: [0.4, 1.15, 1], opacity: 1 }} exit={{ opacity: 0, scale: 0.7 }} className="absolute inset-0 z-[20000] pointer-events-none grid place-items-center">
      <div className="rounded-3xl bg-green-500 border-4 border-white px-12 py-6 text-black text-6xl font-black shadow-[0_0_60px_rgba(34,197,94,.9)]">{`BONUS = ${money(amount)}`}</div>
    </motion.div>
  );
}

function ConfettiBurst({ show }) {
  if (!show) return null;
  const pieces = Array.from({ length: 72 }, (_, i) => i);
  return (
    <div className="absolute inset-0 z-[30050] pointer-events-none overflow-hidden">
      {pieces.map((i) => {
        const left = `${(i * 37) % 100}%`;
        const delay = (i % 12) * 0.035;
        const duration = 1.15 + (i % 8) * 0.08;
        const rotate = (i % 2 === 0 ? 1 : -1) * (180 + i * 13);
        const bg = ["bg-yellow-300", "bg-green-400", "bg-cyan-300", "bg-red-400", "bg-purple-400"][i % 5];
        return (
          <motion.div
            key={i}
            initial={{ y: -40, x: 0, opacity: 1, rotate: 0 }}
            animate={{ y: 950, x: ((i % 9) - 4) * 38, opacity: [1, 1, 0], rotate }}
            transition={{ duration, delay, ease: "easeOut" }}
            className={`absolute top-0 ${bg} w-3 h-5 rounded-sm shadow-lg`}
            style={{ left }}
          />
        );
      })}
    </div>
  );
}

function ProgressiveWinnerFlash({ amount }) {
  if (!amount) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.45 }}
      animate={{ opacity: 1, scale: [0.45, 1.13, 1] }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.42 }}
      className="absolute inset-0 z-[30060] pointer-events-none grid place-items-center bg-black/80"
    >
      <div className="rounded-[48px] bg-green-500 border-8 border-white px-20 py-14 text-black text-[92px] font-black tracking-widest text-center shadow-[0_0_120px_rgba(34,197,94,1)] leading-tight">
        PROGRESSIVE JACKPOT WINNER!!!
        <div className="mt-6 text-[72px]">{`+${money(amount)}`}</div>
      </div>
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
      className="absolute inset-0 z-[20000] pointer-events-none grid place-items-center bg-black/70"
    >
      <div className="rounded-[40px] bg-green-500 border-8 border-white px-20 py-12 text-black text-8xl font-black tracking-widest text-center shadow-[0_0_90px_rgba(34,197,94,1)]">
        BIG WINNER
        <div className="mt-4 text-5xl">{`+${money(amount)}`}</div>
      </div>
    </motion.div>
  );
}

function TwentyOneFlash({ show }) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.55, y: 18 }}
      animate={{ opacity: 1, scale: [0.55, 1.12, 1], y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -10 }}
      transition={{ duration: 0.28 }}
      className="absolute left-1/2 bottom-[17%] z-[210] pointer-events-none -translate-x-1/2"
    >
      <div className="rounded-[28px] bg-yellow-400 border-6 border-white px-16 py-6 text-black text-7xl font-black tracking-widest text-center shadow-[0_0_70px_rgba(250,204,21,1)]">
        21
      </div>
    </motion.div>
  );
}

function HandResultFlash({ amount }) {
  if (amount === null || amount === undefined) return null;
  const isPush = amount === "push" || amount?.kind === "push";
  const numericAmount = Number(amount) || 0;
  const isWin = numericAmount >= 0;

  if (isPush) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.65, y: 18 }}
        animate={{ opacity: 1, scale: [0.65, 1.08, 1], y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: -10 }}
        transition={{ duration: 0.25 }}
        className="absolute left-1/2 bottom-[24%] z-[21000] pointer-events-none -translate-x-1/2"
      >
        <div className="bg-green-500 rounded-[24px] border-4 border-white px-10 py-4 text-black text-5xl font-black tracking-wider text-center shadow-[0_0_55px_rgba(34,197,94,.9)]">
          PUSH
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.65, y: 18 }}
      animate={{ opacity: 1, scale: [0.65, 1.08, 1], y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -10 }}
      transition={{ duration: 0.25 }}
      className={`${isWin ? "left-1/2 bottom-[24%] -translate-x-1/2" : "left-[21%] bottom-[21%]"} absolute z-[21000] pointer-events-none`}
    >
      <div className={`${isWin ? "bg-green-500 px-10 py-4 text-5xl shadow-[0_0_55px_rgba(34,197,94,.9)]" : "bg-red-600 px-4 py-2 text-2xl shadow-[0_0_30px_rgba(239,68,68,.75)]"} rounded-[24px] border-4 border-white text-black font-black tracking-wider text-center`}>
        {isWin ? `WIN ${money(numericAmount)}` : `LOSS ${money(numericAmount)}`}
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
  const [rulesOpen, setRulesOpen] = useState(false);
  const [oddsOpen, setOddsOpen] = useState(false);
  const [suppressOddsHover, setSuppressOddsHover] = useState(false);
  const [openSideBetTooltip, setOpenSideBetTooltip] = useState(null);
  const [suppressedSideBetHover, setSuppressedSideBetHover] = useState(null);
  const [suppressRulesHover, setSuppressRulesHover] = useState(false);

  const [deck, setDeck] = useState(buildDeck());
  const [player, setPlayer] = useState([]);
  const [dealer, setDealer] = useState([]);
  const [hitCards, setHitCards] = useState([]);
  const [splitHand, setSplitHand] = useState(null);
  const [splitPlayActive, setSplitPlayActive] = useState(false);
  const [splitActiveHandIndex, setSplitActiveHandIndex] = useState(0);
  const [splitCompletedHands, setSplitCompletedHands] = useState([]);
  const [splitHandNotice, setSplitHandNotice] = useState(null);
  const [splitAcesLocked, setSplitAcesLocked] = useState(false);
  const [splitCurrentHandLocked, setSplitCurrentHandLocked] = useState(false);
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
  const [dealerResolving, setDealerResolving] = useState(false);
  const [dealerUpcardVisible, setDealerUpcardVisible] = useState(false);
  const [dealerRevealCards, setDealerRevealCards] = useState([]);

  const [bonusType, setBonusType] = useState(null);
  const [bonusIndex, setBonusIndex] = useState(0);
  const [bonusIntro, setBonusIntro] = useState(false);
  const [bonusCinematic, setBonusCinematic] = useState(false);
  const [bonusGameVisible, setBonusGameVisible] = useState(false);
  const [bonusResolved, setBonusResolved] = useState(false);
  const [bonusFlashAmount, setBonusFlashAmount] = useState(null);
  const [twentyOneFlash, setTwentyOneFlash] = useState(false);
  const [bigWinnerAmount, setBigWinnerAmount] = useState(null);
  const [progressiveWinnerAmount, setProgressiveWinnerAmount] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [handResultFlash, setHandResultFlash] = useState(null);
  const [pendingHandResult, setPendingHandResult] = useState(null);
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
  const [freeSpinPrizeFlash, setFreeSpinPrizeFlash] = useState(null);
  const [freeSpinExtraFlash, setFreeSpinExtraFlash] = useState(null);
  const [freeSpinFinalFlash, setFreeSpinFinalFlash] = useState(null);

  const [stageScale, setStageScale] = useState(1);
  const postBonusActionRef = useRef(null);
  const bonusReturnTimerRef = useRef(null);
  const dealCardAudioPrimedAtRef = useRef(0);
  const wheelSpinTimerRef = useRef(null);
  const wheelPrizeTimerRef = useRef(null);
  const freeSpinTimerRef = useRef(null);
  const spinHitAnticipationTimerRef = useRef(null);
  const spinHitFinishTimerRef = useRef(null);
  const doubleSideBonusTimerRef = useRef(null);
  const splitSideBonusTimerRef = useRef(null);
  const bigWinnerVisualTimerRef = useRef(null);
  const bigWinnerActiveRef = useRef(false);
  const handResultTimerRef = useRef(null);
  const latestPendingHandResultRef = useRef(null);
  const roundBonusWinRef = useRef(0);
  const suppressNextHandResultFlashRef = useRef(false);

  function triggerConfetti(duration = 1700) {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), duration);
  }

  function showBigWinner(amount, duration = 1800) {
    if (!amount || amount < 1000) return;
    if (bigWinnerActiveRef.current) return;

    bigWinnerActiveRef.current = true;
    triggerConfetti(duration);
    playAudioFile(AUDIO.bigWin, "bigWin");
    setBigWinnerAmount(amount);

    if (bigWinnerVisualTimerRef.current) clearTimeout(bigWinnerVisualTimerRef.current);
    bigWinnerVisualTimerRef.current = setTimeout(() => {
      setBigWinnerAmount(null);
    setProgressiveWinnerAmount(null);
    setShowConfetti(false);
      bigWinnerActiveRef.current = false;
      bigWinnerVisualTimerRef.current = null;
    }, duration);
  }

  function showProgressiveWinner(amount = PROGRESSIVE_JACKPOT, duration = 3600) {
    if (!amount) return;
    triggerConfetti(duration);
    playAudioFile(AUDIO.bigWin, "bigWin");
    setProgressiveWinnerAmount(amount);
    if (bigWinnerVisualTimerRef.current) clearTimeout(bigWinnerVisualTimerRef.current);
    bigWinnerVisualTimerRef.current = setTimeout(() => {
      setProgressiveWinnerAmount(null);
      bigWinnerActiveRef.current = false;
      bigWinnerVisualTimerRef.current = null;
    }, duration);
  }

  function showHandResult(amount) {
    if (suppressNextHandResultFlashRef.current) {
      suppressNextHandResultFlashRef.current = false;
      return;
    }
    latestPendingHandResultRef.current = amount;
    setPendingHandResult({ amount, id: Date.now() + Math.random() });
  }

  function showHandResultNow(amount) {
    if (handResultTimerRef.current) {
      clearTimeout(handResultTimerRef.current);
      handResultTimerRef.current = null;
    }
    latestPendingHandResultRef.current = amount;
    setPendingHandResult(null);
    setHandResultFlash(amount);
    setTimeout(() => {
      setHandResultFlash(null);
      latestPendingHandResultRef.current = null;
    }, 1325);
  }

  const [wheelQuickStopJolt, setWheelQuickStopJolt] = useState(false);
  const [freeSpinQuickStopJolt, setFreeSpinQuickStopJolt] = useState(false);
  const [spinHitQuickStopJolt, setSpinHitQuickStopJolt] = useState(false);

  useEffect(() => {
    warmAudioCache();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__slotjackSoundEnabled = soundEnabled;
    }
  }, [soundEnabled]);

  useEffect(() => {
    if (!pendingHandResult || phase !== "complete") return;

    if (handResultTimerRef.current) clearTimeout(handResultTimerRef.current);
    handResultTimerRef.current = setTimeout(() => {
      const resultAmount = pendingHandResult.amount;
      const isRegularWin = typeof resultAmount === "number" && resultAmount > 0 && roundBonusWinRef.current <= 0;
      if (isRegularWin) playAudioFile(AUDIO.regularWin, "regularWin");
      setHandResultFlash(resultAmount);
      handResultTimerRef.current = setTimeout(() => {
        setHandResultFlash(null);
    setPendingHandResult(null);
    setPendingHandResult(null);
        setPendingHandResult(null);
        latestPendingHandResultRef.current = null;
        handResultTimerRef.current = null;
      }, 1325);
    }, 175);

    return () => {
      if (handResultTimerRef.current) {
        clearTimeout(handResultTimerRef.current);
        handResultTimerRef.current = null;
      }
    };
  }, [pendingHandResult, phase]);

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
  const canSplit = phase === "player" && handReady && !splitPlayActive && !splitHand && player.length === 2 && player[0]?.rank === player[1]?.rank && cardValue(player[0]) !== 10 && !pendingSplitHand && credits >= blackjackBet;
  const canDoubleDown = phase === "player" && handReady && !splitPlayActive && !splitHand && player.length === 2 && credits >= blackjackBet && canDoubleTotal(player);

  function showBonusFlash(amount) {
    if (!amount || amount <= 0) return;
    roundBonusWinRef.current += amount;
    playAudioFile(AUDIO.bonusAmount, "bonusAmount");
    setBonusFlashAmount(amount);
    if (amount >= PROGRESSIVE_JACKPOT) {
      showProgressiveWinner(amount, 3600);
    } else if (amount >= 1000) {
      showBigWinner(amount, 2400);
    }
    setTimeout(() => setBonusFlashAmount(null), 1300);
  }

  function showHiddenPrizeFlash(amount) {
    if (!amount || amount <= 0) return;
    setHiddenPrizeFlash(amount);
    setTimeout(() => setHiddenPrizeFlash(null), 1150);
  }

  function celebrate21AndTriggerBonus(message = "Player hand = 21. Bonus feature activated.") {
    setPhase("bonus");
    setMessage("Player hand = 21!");
    setTwentyOneFlash(true);
    playAudioFile(AUDIO.twentyOne, "twentyOne");
    setTimeout(() => {
      setTwentyOneFlash(false);
      setMessage(message);
      triggerMainBonus();
    }, 950);
  }

  function resetBonus() {
    if (bonusReturnTimerRef.current) {
      clearTimeout(bonusReturnTimerRef.current);
      bonusReturnTimerRef.current = null;
    }
    if (wheelSpinTimerRef.current) {
      clearTimeout(wheelSpinTimerRef.current);
      wheelSpinTimerRef.current = null;
    }
    if (wheelPrizeTimerRef.current) {
      clearTimeout(wheelPrizeTimerRef.current);
      wheelPrizeTimerRef.current = null;
    }
    if (freeSpinTimerRef.current) {
      clearTimeout(freeSpinTimerRef.current);
      freeSpinTimerRef.current = null;
    }
    if (spinHitAnticipationTimerRef.current) {
      clearTimeout(spinHitAnticipationTimerRef.current);
      spinHitAnticipationTimerRef.current = null;
    }
    if (spinHitFinishTimerRef.current) {
      clearTimeout(spinHitFinishTimerRef.current);
      spinHitFinishTimerRef.current = null;
    }
    if (doubleSideBonusTimerRef.current) {
      clearTimeout(doubleSideBonusTimerRef.current);
      doubleSideBonusTimerRef.current = null;
    }
    if (splitSideBonusTimerRef.current) {
      clearTimeout(splitSideBonusTimerRef.current);
      splitSideBonusTimerRef.current = null;
    }
    if (bigWinnerVisualTimerRef.current) {
      clearTimeout(bigWinnerVisualTimerRef.current);
      bigWinnerVisualTimerRef.current = null;
    }
    if (handResultTimerRef.current) {
      clearTimeout(handResultTimerRef.current);
      handResultTimerRef.current = null;
    }
    bigWinnerActiveRef.current = false;
    postBonusActionRef.current = null;
    roundBonusWinRef.current = 0;
    suppressNextHandResultFlashRef.current = false;
    setBonusType(null);
    setBonusIntro(false);
    setBonusCinematic(false);
    setBonusGameVisible(false);
    setBonusResolved(false);
    setBonusFlashAmount(null);
    setTwentyOneFlash(false);
    setDealerResolving(false);
    setDealerUpcardVisible(false);
    setDealerRevealCards([]);
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
    setFreeSpinPrizeFlash(null);
    setFreeSpinExtraFlash(null);
    setFreeSpinFinalFlash(null);
    setWheelQuickStopJolt(false);
    setFreeSpinQuickStopJolt(false);
    setSpinHitQuickStopJolt(false);
    setSplitHandNotice(null);
    setSplitAcesLocked(false);
    setSplitCurrentHandLocked(false);
    setPendingSplitHand(null);
    setSplitPlayActive(false);
    setSplitActiveHandIndex(0);
    setSplitCompletedHands([]);
    setSplitCurrentHandLocked(false);
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
    if (pendingHandResult && handResultFlash === null && latestPendingHandResultRef.current !== null) {
      if (handResultTimerRef.current) {
        clearTimeout(handResultTimerRef.current);
        handResultTimerRef.current = null;
      }
      const resultAmount = latestPendingHandResultRef.current;
      const isRegularWin = typeof resultAmount === "number" && resultAmount > 0 && roundBonusWinRef.current <= 0;
      if (isRegularWin) playAudioFile(AUDIO.regularWin, "regularWin");
      setHandResultFlash(resultAmount);
      setTimeout(() => {
        setHandResultFlash(null);
        setPendingHandResult(null);
        latestPendingHandResultRef.current = null;
      }, 900);
    }

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

    // Fire dealing sound on click if it was not already triggered on pointer-down.
    if (Date.now() - dealCardAudioPrimedAtRef.current > 300) {
      playAudioFile(AUDIO.card, "card");
      dealCardAudioPrimedAtRef.current = Date.now();
    }
    resetBonus();
    setPlayer([]);
    setDealer([]);
    setHitCards([]);
    setSplitHand(null);
    setSplitPlayActive(false);
    setSplitActiveHandIndex(0);
    setSplitCompletedHands([]);
    setHandReady(false);
    setDealerResolving(false);
    setDealerUpcardVisible(false);
    setDealerRevealCards([]);
    setPhase("dealing");
    if (spinBetOn || doubleBonusOn || splitBonusOn) setAutoChipDropKey((k) => k + 1);
    setMessage("Dealing cards...");
    setCredits((c) => c - roundCost);
    setLastWin(0);
    roundBonusWinRef.current = 0;
    suppressNextHandResultFlashRef.current = false;
    if (handResultTimerRef.current) {
      clearTimeout(handResultTimerRef.current);
      handResultTimerRef.current = null;
    }
    setHandResultFlash(null);

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
    let newDealer = drawDealer.drawn;
    workingDeck = drawDealer.remaining;

    // Demo pacing: avoid dealer natural blackjack/instant 21 too often so players see more feature play.
    if (naturalBlackjack(newDealer) && Math.random() < 0.88) {
      const replacement = findNonDealerBlackjackSecondCard(workingDeck, newDealer[0]);
      if (replacement) {
        workingDeck = [newDealer[1], ...removeCardsFromDeck(workingDeck, [replacement])];
        newDealer = [newDealer[0], replacement];
      }
    }
    setDeck(workingDeck);
    setPlayer(newPlayer);
    setDealer(newDealer);

    setTimeout(() => {
      setDealerUpcardVisible(true);
      setHandReady(true);

      if (naturalBlackjack(newDealer)) {
        const playerHasBlackjack = naturalBlackjack(newPlayer);
        let payout = 0;
        let netResult = 0;
        let result = "Dealer has blackjack.";

        if (playerHasBlackjack) {
          payout = blackjackBet;
          netResult = -sideBetCost;
          result = "Dealer has blackjack. Player blackjack pushes. Bet returned.";
        } else {
          netResult = -(blackjackBet + sideBetCost);
          result = "Dealer has blackjack. Player loses.";
        }

        setTimeout(() => {
          setCredits((c) => c + payout);
          setLastWin(netResult);
          setPhase("complete");
          setMessage(result);
          setTimeout(() => showHandResult(playerHasBlackjack ? "push" : netResult), 450);
        }, 650);
        return;
      }

      if (spinBetOn && naturalBlackjack(newPlayer)) {
        celebrate21AndTriggerBonus("Natural blackjack. 21 Spin bonus feature activated.");
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
    setBonusResolved(false);
    setTimeout(() => {
      setBonusCinematic(false);
      setBonusGameVisible(true);
    }, 1125);
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

  function finishSpinToHit(quickStopped = false) {
    if (quickStopped) {
      setSpinHitQuickStopJolt(true);
      setTimeout(() => setSpinHitQuickStopJolt(false), 320);
    }

    const draw = drawFrom(deck, 1);
    let card = draw.drawn[0];
    let nextDeck = draw.remaining;
    if (!splitPlayActive && spinBetOn && playerTotal < 21 && Math.random() < DEMO_SPIN_TO_21_CHANCE) {
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
    if (splitPlayActive) {
      if (total > 21) {
        setSplitCurrentHandLocked(true);
        setHandReady(false);
        setMessage(`Hand ${splitActiveHandIndex + 1} busts.`);
        setTimeout(() => finishSplitHand(nextPlayer, nextDeck), quickStopped ? 350 : 650);
      } else if (total === 21) {
        setSplitCurrentHandLocked(true);
        setHandReady(false);
        setMessage(`Hand ${splitActiveHandIndex + 1} has 21.`);
        setTimeout(() => finishSplitHand(nextPlayer, nextDeck), quickStopped ? 350 : 650);
      } else {
        setMessage(`Hand ${splitActiveHandIndex + 1} has ${handDisplayValue(nextPlayer)}. Spin again or stand.`);
      }
      return;
    }
    if (total === 21 && spinBetOn) {
      celebrate21AndTriggerBonus("Player hand = 21. Bonus feature activated.");
    } else if (total > 21) {
      setLastWin(currentLoss);
      showHandResultNow(currentLoss);
      setPhase("complete");
      setMessage("Player loses. BUSTED.");
    } else {
      setMessage(`Player has ${handDisplayValue(nextPlayer)}. Spin again or stand.`);
    }
  }

  function spinToHit() {
    if (phase !== "player" || !handReady || (splitPlayActive && (splitAcesLocked || splitCurrentHandLocked || handValue(player) >= 21))) return;

    if (spinning) {
      if (spinHitAnticipationTimerRef.current) {
        clearTimeout(spinHitAnticipationTimerRef.current);
        spinHitAnticipationTimerRef.current = null;
      }
      if (spinHitFinishTimerRef.current) {
        clearTimeout(spinHitFinishTimerRef.current);
        spinHitFinishTimerRef.current = null;
      }
      playAudioFile(AUDIO.quickStop, "quickStop");
      finishSpinToHit(true);
      return;
    }

    playAudioFile(AUDIO.spinPress, "spinPress");
    playAudioFile(AUDIO.spin, "spin");
    setSpinHitQuickStopJolt(false);
    setSpinning(true);
    setAnticipatingSpin(false);
    setMessage("Spinning for your hit card... Click Spin again to quick stop.");
    spinHitAnticipationTimerRef.current = setTimeout(() => {
      spinHitAnticipationTimerRef.current = null;
      setAnticipatingSpin(true);
      setMessage("Almost there...");
      playAudioFile(AUDIO.stop, "stop");
    }, 450);
    spinHitFinishTimerRef.current = setTimeout(() => {
      spinHitFinishTimerRef.current = null;
      finishSpinToHit(false);
    }, 1350);
  }

  function stand() {
    playAudioFile(AUDIO.standPress, "standPress");
    if (phase !== "player" || !handReady || (splitPlayActive && splitCurrentHandLocked)) return;
    if (splitPlayActive) {
      finishSplitHand(player, deck);
      return;
    }
    playDealer(player, deck);
  }

  function beginSplitHandPlay(firstHandFinal, secondHandFinal, nextDeck = deck) {
    const splitAces = firstHandFinal?.[0]?.rank === "A" && secondHandFinal?.[0]?.rank === "A";
    setPlayer(firstHandFinal);
    setSplitHand(secondHandFinal);
    setSplitCompletedHands([]);
    setSplitHandNotice(null);
    setSplitActiveHandIndex(0);
    setSplitPlayActive(!splitAces);
    setSplitAcesLocked(splitAces);
    setSplitCurrentHandLocked(splitAces);
    setDeck(nextDeck);
    setPhase("player");
    setHandReady(!splitAces);
    setHitCards([]);

    if (splitAces) {
      setMessage("Split aces receive one card each. No more hits allowed.");
      setTimeout(() => {
        setSplitCompletedHands([firstHandFinal, secondHandFinal]);
        setPlayer(firstHandFinal);
        setSplitHand(secondHandFinal);
        setSplitPlayActive(false);
        setSplitActiveHandIndex(0);
        setHandReady(false);
        playDealerForSplit([firstHandFinal, secondHandFinal], nextDeck);
      }, 950);
    } else {
      setMessage(`Playing hand 1. Hand has ${handDisplayValue(firstHandFinal)}. Spin or stand.`);
    }
  }

  function finishSplitHand(finalHand, currentDeck = deck) {
    if (!splitPlayActive) return;
    if (splitActiveHandIndex === 0) {
      const completedFirst = finalHand;
      const second = splitHand || [];
      setSplitCompletedHands([completedFirst]);
      setSplitCurrentHandLocked(true);
      setHandReady(false);
      setSplitHandNotice("HAND 1 COMPLETE");
      setMessage("Hand 1 complete.");
      setTimeout(() => {
        setPlayer(second);
        setSplitHand(completedFirst);
        setSplitActiveHandIndex(1);
        setDeck(currentDeck);
        setHitCards([]);
        setSplitCurrentHandLocked(false);
        setHandReady(true);
        setSplitHandNotice(null);
        setMessage(`Playing hand 2. Hand has ${handDisplayValue(second)}. Spin or stand.`);
      }, 750);
      return;
    }

    const completedHands = [...splitCompletedHands, finalHand];
    setSplitCurrentHandLocked(true);
    setHandReady(false);
    setSplitHandNotice("HAND 2 COMPLETE");
    setMessage("Hand 2 complete.");
    setTimeout(() => {
      setSplitPlayActive(false);
      setSplitActiveHandIndex(0);
      setSplitCurrentHandLocked(false);
      setSplitCompletedHands(completedHands);
      setPlayer(completedHands[0] || []);
      setSplitHand(completedHands[1] || []);
      setHitCards([]);
      setSplitHandNotice(null);
      playDealerForSplit(completedHands, currentDeck);
    }, 750);
  }

  function playDealerForSplit(finalHands, currentDeck = deck) {
    setDealerResolving(true);
    setDealerUpcardVisible(true);

    let nextDealer = [...dealer];
    let nextDeck = [...currentDeck];

    const revealSequence = async () => {
      setDealerRevealCards([nextDealer[0]].filter(Boolean));
      await new Promise((resolve) => setTimeout(resolve, 450));

      if (nextDealer[1]) {
        setDealerRevealCards([nextDealer[0], nextDealer[1]]);
        await new Promise((resolve) => setTimeout(resolve, 550));
      }

      while (handValue(nextDealer) < 17) {
        const draw = drawFrom(nextDeck, 1);
        let newCard = draw.drawn[0];
        nextDeck = draw.remaining;
        if (handValue([...nextDealer, newCard]) === 21 && Math.random() < 0.65) {
          const softerDealerCard = findDealerHitAvoidingExact21(nextDeck, nextDealer);
          if (softerDealerCard) {
            nextDeck = [newCard, ...removeCardsFromDeck(nextDeck, [softerDealerCard])];
            newCard = softerDealerCard;
          }
        }
        nextDealer = [...nextDealer, newCard];
        setDealer(nextDealer);
        setDealerRevealCards([...nextDealer]);
        playAudioFile(AUDIO.card, "card");
        await new Promise((resolve) => setTimeout(resolve, 650));
      }

      setDealer(nextDealer);
      setDeck(nextDeck);
      setTimeout(() => {
        setDealerResolving(false);
        setDealerRevealCards([]);
        resolveSplitBlackjack(finalHands, nextDealer);
      }, 175);
    };

    revealSequence();
  }

  function resolveSplitBlackjack(finalHands, finalDealer) {
    const dealerScore = handValue(finalDealer);
    let payoutTotal = 0;
    const results = finalHands.map((hand, index) => {
      const score = handValue(hand);
      let payout = 0;
      let label = "loses";
      if (score > 21) {
        label = "busts";
      } else if (dealerScore > 21 || score > dealerScore) {
        payout = blackjackBet * 2;
        label = "wins";
      } else if (score === dealerScore) {
        payout = blackjackBet;
        label = "pushes";
      }
      payoutTotal += payout;
      return `Hand ${index + 1} ${label}`;
    });
    const netResult = payoutTotal - blackjackBet * finalHands.length - sideBetCost;
    const allPush = dealerScore <= 21 && finalHands.length > 0 && finalHands.every((hand) => handValue(hand) <= 21 && handValue(hand) === dealerScore);
    setCredits((c) => c + payoutTotal);
    setLastWin((w) => w + netResult);
    showHandResult(allPush ? "push" : roundBonusWinRef.current + netResult);
    setPhase("complete");
    setMessage(`${results.join(". ")}. Dealer has ${dealerScore}.`);
  }

  function splitPair() {
    playAudioFile(AUDIO.splitPress, "splitPress");
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
    setSplitAcesLocked(originalLeft.rank === "A" && originalRight.rank === "A");
    setPendingSplitHand({ firstHandFinal, secondHandFinal, cardA: draw.drawn[0], cardB: draw.drawn[1], nextDeck: draw.remaining });

    if (splitBonusOn) {
      setSideBonus({ kind: "split", cardA: draw.drawn[0], cardB: draw.drawn[1], amountA: randomChoice(SIDE_BONUS_AMOUNTS), amountB: randomChoice(SIDE_BONUS_AMOUNTS), spinning: false, revealed: false });
      setPhase("bonus");
      setMessage("Split Screen side bet activated.");
      setTimeout(() => launchBonusPanel("SPLIT SCREEN"), 550);
    } else {
      beginSplitHandPlay(firstHandFinal, secondHandFinal, draw.remaining);
    }
  }

  function doubleDown() {
    playAudioFile(AUDIO.doubleDownPress, "doubleDownPress");
    if (!canDoubleDown) {
      setMessage("Only active on player 10 or 11, including soft 10 or 11.");
      return;
    }
    setCredits((c) => c - blackjackBet);
    if (!doubleBonusOn) setSpinning(true);
    setMessage("Double Down / Double Up. One hit card.");
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
        showHandResultNow(-(blackjackBet * 2 + sideBetCost));
        setPhase("complete");
        setMessage("Player loses. BUSTED.");
      } else if (handValue(nextPlayer) === 21 && spinBetOn) {
        setPlayer(nextPlayer);
        setHitCards((h) => [...h, card]);
        celebrate21AndTriggerBonus("Double down hit card made 21. 21 Spin bonus activated.");
      } else {
        setPlayer(nextPlayer);
        setHitCards((h) => [...h, card]);
        playDealer(nextPlayer, nextDeck, blackjackBet * 2);
      }
    }, 550);
  }

  function playDealer(finalPlayer = player, currentDeck = deck, effectiveBet = blackjackBet) {
    setDealerResolving(true);
    setDealerUpcardVisible(true);

    let nextDealer = [...dealer];
    let nextDeck = [...currentDeck];

    const revealSequence = async () => {
      setDealerRevealCards([nextDealer[0]].filter(Boolean));
      await new Promise((resolve) => setTimeout(resolve, 450));

      if (nextDealer[1]) {
        setDealerRevealCards([nextDealer[0], nextDealer[1]]);
        await new Promise((resolve) => setTimeout(resolve, 550));
      }

      while (handValue(nextDealer) < 17) {
        const draw = drawFrom(nextDeck, 1);
        let newCard = draw.drawn[0];
        nextDeck = draw.remaining;
        if (handValue([...nextDealer, newCard]) === 21 && Math.random() < 0.65) {
          const softerDealerCard = findDealerHitAvoidingExact21(nextDeck, nextDealer);
          if (softerDealerCard) {
            nextDeck = [newCard, ...removeCardsFromDeck(nextDeck, [softerDealerCard])];
            newCard = softerDealerCard;
          }
        }
        nextDealer = [...nextDealer, newCard];
        setDealer(nextDealer);
        setDealerRevealCards([...nextDealer]);
        playAudioFile(AUDIO.card, "card");
        await new Promise((resolve) => setTimeout(resolve, 650));
      }

      setDealer(nextDealer);
      setDeck(nextDeck);
      setTimeout(() => {
        setDealerResolving(false);
        setDealerRevealCards([]);
        resolveBlackjack(finalPlayer, nextDealer, effectiveBet);
      }, 175);
    };

    revealSequence();
  }

  function resolveBlackjack(finalPlayer, finalDealer, effectiveBet = blackjackBet) {
    const p = handValue(finalPlayer);
    const d = handValue(finalDealer);
    let payout = 0;
    let result = "";
    let netResult = 0;
    let resultKind = ""; 
    if (p > 21) {
      result = "Player loses. BUSTED.";
      resultKind = "loss";
      netResult = -(effectiveBet + sideBetCost);
    } else if (naturalBlackjack(finalPlayer)) {
      const blackjackProfit = Math.floor(effectiveBet * 1.2);
      payout = effectiveBet + blackjackProfit;
      result = `Blackjack pays 6:5. Paid ${money(payout)}.`;
      resultKind = "win";
      netResult = payout - effectiveBet - sideBetCost;
    } else if (d > 21 || p > d) {
      payout = effectiveBet * 2;
      result = `Player wins. Paid ${money(payout)}.`;
      resultKind = "win";
      netResult = payout - effectiveBet - sideBetCost;
    } else if (p === d) {
      payout = effectiveBet;
      result = "Push. Bet returned.";
      resultKind = "push";
      netResult = -sideBetCost;
    } else {
      result = "Player loses.";
      resultKind = "loss";
      netResult = -(effectiveBet + sideBetCost);
    }
    setCredits((c) => c + payout);
    setLastWin((w) => w + netResult);
    if (resultKind === "push") {
      showHandResult("push");
      setMessage(result);
    } else {
      showHandResult(roundBonusWinRef.current + netResult);
      setMessage(result);
    }
    setPhase("complete");
  }

  function finishWheelSpin(quickStopped = false) {
    if (quickStopped) {
      setWheelQuickStopJolt(true);
      setTimeout(() => setWheelQuickStopJolt(false), 320);
    }
    const prize = Math.random() < WHEEL_PROGRESSIVE_CHANCE ? "PROGRESSIVE JACKPOT" : randomChoice(WHEEL_PRIZES);
    const amount = resolvePrizeAmount(prize);
    setWheelSpinning(false);
    playAudioFile(AUDIO.stop, "stop");
    setWheelResult(prizeLabel(prize));
    setMessage(prize === "PROGRESSIVE JACKPOT" ? `Progressive Jackpot hits for ${money(amount)}!` : `Bonus Wheel lands on ${prizeLabel(prize)}.`);
    wheelPrizeTimerRef.current = setTimeout(() => {
      setCredits((c) => c + amount);
      setLastWin((w) => w + amount);
      showBonusFlash(amount);
      setMessage(prize === "PROGRESSIVE JACKPOT" ? `Progressive Jackpot pays ${money(amount)}!` : `Bonus Wheel pays ${money(amount)}.`);
      scheduleBonusReturn(null, 3000);
      wheelPrizeTimerRef.current = null;
    }, quickStopped ? 250 : 700);
  }

  function spinWheel() {
    if (bonusType !== "21 BONUS WHEEL" || wheelResult !== null) return;
    if (wheelSpinning) {
      if (wheelSpinTimerRef.current) {
        clearTimeout(wheelSpinTimerRef.current);
        wheelSpinTimerRef.current = null;
      }
      playAudioFile(AUDIO.quickStop, "quickStop");
      finishWheelSpin(true);
      return;
    }
    playAudioFile(AUDIO.spin, "spin");
    setWheelQuickStopJolt(false);
    setWheelSpinning(true);
    wheelSpinTimerRef.current = setTimeout(() => {
      wheelSpinTimerRef.current = null;
      finishWheelSpin(false);
    }, 1100);
  }

  function pickHiddenHand(columnIndex, cardIndex) {
    if (bonusType !== "HIDDEN HAND" || hiddenGameOver || columnIndex !== hiddenColumnIndex) return;
    const card = hiddenColumns[columnIndex]?.[cardIndex];
    if (!card) return;
    playAudioFile(AUDIO.spinPress, "spinPress");
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
      playAudioFile(AUDIO.hiddenMatch, "hiddenMatch");
      if (matchLevel === 1 || matchLevel === 2) {
        showHiddenPrizeFlash(hiddenHandPrize(matchLevel, false, blackjackBet));
      }
      const nextColumn = columnIndex + 1;
      if (nextColumn === 2) playAudioFile(AUDIO.hiddenRamp3, "hiddenRamp3");
      if (nextColumn === 3) playAudioFile(AUDIO.hiddenRamp4, "hiddenRamp4");
      if (nextColumn >= 4) {
        setHiddenMatchLevel(4);
        const prize = hiddenHandPrize(4, true, blackjackBet);
        setHiddenGameOver(true);
        setCredits((c) => c + prize);
        setLastWin((w) => w + prize);
        showBonusFlash(prize);
        setMessage(`Hidden Hand jackpot match! Four ${hiddenTargetRank}s pay ${money(prize)}.`);
        scheduleBonusReturn(null, 3000);
      } else {
        if (columnIndex === 2) playAudioFile(AUDIO.hiddenRamp3Win, "hiddenRamp3Win");
        setHiddenColumnIndex(nextColumn);
        setMessage(`Match! Pick ${hiddenTargetRank} in column ${nextColumn + 1}.`);
      }
    } else {
      if (columnIndex === 2) playAudioFile(AUDIO.hiddenRamp3Lose, "hiddenRamp3Lose");
      const prize = hiddenHandPrize(columnIndex, false, blackjackBet);
      setHiddenGameOver(true);
      setCredits((c) => c + prize);
      setLastWin((w) => w + prize);
      showBonusFlash(prize);
      setMessage(`No match. Hidden Hand ends and pays ${money(prize)}.`);
      scheduleBonusReturn(null, 3000);
    }
  }

  function finishFreeSpin(quickStopped = false) {
    if (quickStopped) {
      setFreeSpinQuickStopJolt(true);
      setTimeout(() => setFreeSpinQuickStopJolt(false), 320);
    }
    const grid = makeFreeSpinAmountGrid(freeSpinExtraAwarded < 2);
    const prize = freeSpinGridValue(grid);
    const rawExtraSpins = grid.filter((symbol) => symbol.spins).reduce((sum, symbol) => sum + (symbol.spins || 0), 0);
    const remainingExtraSpinCap = Math.max(0, 2 - freeSpinExtraAwarded);
    const awardedExtraSpins = Math.min(rawExtraSpins, remainingExtraSpinCap);
    const nextSpinsLeft = Math.max(0, freeSpinsLeft - 1 + awardedExtraSpins);
    const nextFreeSpinTotal = freeSpinTotal + prize;

    setFreeSpinGrid(grid);
    setFreeSpinsLeft(nextSpinsLeft);
    setFreeSpinExtraAwarded((s) => Math.min(2, s + awardedExtraSpins));
    setFreeSpinTotal(nextFreeSpinTotal);
    setCredits((c) => c + prize);
    setLastWin((w) => w + prize);

    if (awardedExtraSpins > 0) {
      setFreeSpinExtraFlash(awardedExtraSpins);
      setTimeout(() => setFreeSpinExtraFlash(null), 900);
    }

    if (prize > 0) {
      setFreeSpinPrizeFlash(prize);
      if (prize >= PROGRESSIVE_JACKPOT) {
        showProgressiveWinner(prize, 3000);
      } else if (prize >= 1000) {
        showBigWinner(prize, 900);
      }
      setTimeout(() => setFreeSpinPrizeFlash(null), 900);
    }
    setFreeSpinSpinning(false);
    setMessage(awardedExtraSpins > 0 ? `Free spin pays ${money(prize)} and awards +${awardedExtraSpins} spins. Extra spin cap used: ${freeSpinExtraAwarded + awardedExtraSpins}/2.` : rawExtraSpins > 0 ? `Free Spins Feature pays ${money(prize)}. Extra spin cap already reached.` : `Free Spins Feature pays ${money(prize)}. Bonus total is now ${money(nextFreeSpinTotal)}.`);
    if (nextSpinsLeft <= 0) {
      setTimeout(() => {
        setFreeSpinPrizeFlash(null);
        setFreeSpinFinalFlash(nextFreeSpinTotal);
        if (nextFreeSpinTotal >= PROGRESSIVE_JACKPOT) {
          showProgressiveWinner(nextFreeSpinTotal, 3400);
        } else if (nextFreeSpinTotal >= 1000) {
          showBigWinner(nextFreeSpinTotal, 1800);
        }
        scheduleBonusReturn(null, 3000);
      }, prize > 0 ? 900 : 250);
    }
  }

  function playFreeSpin() {
    if (bonusType !== "FREE SPINS FEATURE" || freeSpinsLeft <= 0) return;

    setFreeSpinPrizeFlash(null);
    setFreeSpinExtraFlash(null);
    setFreeSpinFinalFlash(null);
    if (freeSpinSpinning) {
      if (freeSpinTimerRef.current) {
        clearTimeout(freeSpinTimerRef.current);
        freeSpinTimerRef.current = null;
      }
      playAudioFile(AUDIO.quickStop, "quickStop");
      finishFreeSpin(true);
      return;
    }
    playAudioFile(AUDIO.spin, "spin");
    setFreeSpinQuickStopJolt(false);
    setFreeSpinSpinning(true);
    setFreeSpinPrizeFlash(null);
    setFreeSpinExtraFlash(null);
    setFreeSpinFinalFlash(null);
    setMessage("Free Spins Feature reels are spinning...");
    freeSpinTimerRef.current = setTimeout(() => {
      freeSpinTimerRef.current = null;
      finishFreeSpin(false);
    }, 900);
  }

  function finishDoubleSideBonus(quickStopped = false) {
    if (quickStopped) {
      playAudioFile(AUDIO.quickStop, "quickStop");
      setFreeSpinQuickStopJolt(true);
      setTimeout(() => setFreeSpinQuickStopJolt(false), 320);
    }
    const amount = sideBonus?.amount || 0;
    const card = sideBonus?.card || pendingDoubleCard;
    const nextPlayer = card ? [...player, card] : player;
    doubleSideBonusTimerRef.current = null;
    setSideBonus((b) => ({ ...b, spinning: false, revealed: true }));
    if (card) {
      setPlayer(nextPlayer);
      setHitCards((h) => [...h, card]);
    }
    setPendingDoubleCard(null);
    setCredits((c) => c + amount);
    setLastWin((w) => w + amount);
    showBonusFlash(amount);
    setMessage(`Double Up Double Down bonus pays ${money(amount)}.`);
    scheduleBonusReturn(() => {
      if (handValue(nextPlayer) > 21) {
        setLastWin(-(blackjackBet * 2 + sideBetCost) + amount);
        setPhase("complete");
        setMessage("Player loses. BUSTED.");
      } else {
        playDealer(nextPlayer, pendingDoubleDeck || deck, pendingDoubleBet || blackjackBet * 2);
      }
    }, 3000);
  }

  function startDoubleSideBonus() {
    if (!sideBonus || sideBonus.revealed) return;

    if (sideBonus.spinning) {
      if (doubleSideBonusTimerRef.current) {
        clearTimeout(doubleSideBonusTimerRef.current);
        doubleSideBonusTimerRef.current = null;
      }
      finishDoubleSideBonus(true);
      return;
    }

    playAudioFile(AUDIO.spin, "spin");
    setSideBonus((b) => ({ ...b, spinning: true }));
    doubleSideBonusTimerRef.current = setTimeout(() => {
      finishDoubleSideBonus(false);
    }, 1000);
  }

  function finishSplitSideBonus(quickStopped = false) {
    if (quickStopped) {
      playAudioFile(AUDIO.quickStop, "quickStop");
      setFreeSpinQuickStopJolt(true);
      setTimeout(() => setFreeSpinQuickStopJolt(false), 320);
    }
    const amount = (sideBonus?.amountA || 0) + (sideBonus?.amountB || 0);
    const resolvedSplit = pendingSplitHand;
    splitSideBonusTimerRef.current = null;
    setSideBonus((b) => ({ ...b, spinning: false, revealed: true }));
    if (resolvedSplit) {
      setPlayer(resolvedSplit.firstHandFinal);
      setSplitHand(resolvedSplit.secondHandFinal);
      setHitCards((h) => [...h, resolvedSplit.cardA, resolvedSplit.cardB]);
    }
    setPendingSplitHand(null);
    setCredits((c) => c + amount);
    setLastWin((w) => w + amount);
    showBonusFlash(amount);
    setMessage(`Split Screen bonus pays ${money(amount)}.`);
    scheduleBonusReturn(() => {
      if (resolvedSplit) {
        beginSplitHandPlay(resolvedSplit.firstHandFinal, resolvedSplit.secondHandFinal, resolvedSplit.nextDeck || deck);
      }
    }, 3000);
  }

  function startSplitSideBonus() {
    if (!sideBonus || sideBonus.revealed) return;

    if (sideBonus.spinning) {
      if (splitSideBonusTimerRef.current) {
        clearTimeout(splitSideBonusTimerRef.current);
        splitSideBonusTimerRef.current = null;
      }
      finishSplitSideBonus(true);
      return;
    }

    playAudioFile(AUDIO.spin, "spin");
    setSideBonus((b) => ({ ...b, spinning: true }));
    splitSideBonusTimerRef.current = setTimeout(() => {
      finishSplitSideBonus(false);
    }, 1000);
  }

  function scheduleBonusReturn(action = null, delay = 3000) {
    if (bonusReturnTimerRef.current) clearTimeout(bonusReturnTimerRef.current);
    setBonusResolved(true);
    postBonusActionRef.current = action;
    bonusReturnTimerRef.current = setTimeout(() => {
      continueAfterBonus();
    }, delay);
  }

  function continueAfterBonus() {
    if (bonusReturnTimerRef.current) {
      clearTimeout(bonusReturnTimerRef.current);
      bonusReturnTimerRef.current = null;
    }
    setBonusGameVisible(false);
    setBonusResolved(false);
    setFreeSpinPrizeFlash(null);
    setFreeSpinExtraFlash(null);
    setFreeSpinFinalFlash(null);
    setBonusIntro(false);
    const action = postBonusActionRef.current;
    postBonusActionRef.current = null;
    if (action) {
      action();
    } else {
      playDealer(player, deck);
    }
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
          0%, 100% {
            transform: scale(1);
            filter: brightness(1);
          }
          50% {
            transform: scale(1.03);
            filter: brightness(1.12);
          }
        }

        @keyframes quickStopPulse {
          0% {
            transform: scale(1);
            filter: brightness(1);
          }
          14% {
            transform: scale(1.045);
            filter: brightness(1.11);
          }
          28%, 100% {
            transform: scale(1.035);
            filter: brightness(1.08);
          }
          62% {
            transform: scale(1.055);
            filter: brightness(1.14);
          }
        }
        @keyframes quickStopPulseFast {
          0%, 100% {
            transform: scale(1.035);
            filter: brightness(1.08);
          }
          50% {
            transform: scale(1.065);
            filter: brightness(1.16);
          }
        }
        @keyframes edgeGlowPulse {
          0%, 100% {
            box-shadow: 0 0 10px rgba(250,204,21,.55);
          }
          50% {
            box-shadow: 0 0 20px rgba(250,204,21,.95);
          }
        }
        .slotjack-stage,
        .slotjack-stage * {
          user-select: none;
          -webkit-user-select: none;
        }

        .slotjack-stage button,
        .slotjack-stage img,
        .slotjack-stage div {
          -webkit-tap-highlight-color: transparent;
        }
        .slotjack-stage button:focus,
        .slotjack-stage button:focus-visible,
        .slotjack-stage img:focus,
        .slotjack-stage img:focus-visible,
        .slotjack-stage div:focus,
        .slotjack-stage div:focus-visible {
          outline: none !important;
        }
      `}</style>

     <div
  className="slotjack-stage"
  style={{ transform: `translate(-50%, -50%) scale(${stageScale})` }}
>
        <img src="/assets/table-bg.png" className="absolute inset-0 w-full h-full object-cover select-none" draggable="false" />
        <div className="absolute inset-0 bg-black/10" />
        <AnimatePresence><BonusAmountFlash amount={bonusFlashAmount} /></AnimatePresence>
        <AnimatePresence><TwentyOneFlash show={twentyOneFlash} /></AnimatePresence>
        <AnimatePresence><BigWinnerFlash amount={bigWinnerAmount} /></AnimatePresence>
        <AnimatePresence><ProgressiveWinnerFlash amount={progressiveWinnerAmount} /></AnimatePresence>
        <AnimatePresence><ConfettiBurst show={showConfetti} /></AnimatePresence>
        <AnimatePresence><HandResultFlash amount={handResultFlash} /></AnimatePresence>

        <img src="/assets/dealer-shoe.png" className="absolute top-[-7.8%] right-[-4%] z-10 w-[330px] h-auto drop-shadow-2xl" draggable="false" />

        {bonusCinematic && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[30000] bg-black/60 grid place-items-center pointer-events-none">
            <motion.div initial={{ scale: 0.4, rotate: -8 }} animate={{ scale: [0.4, 1.2, 1], rotate: 0 }} transition={{ duration: 0.55 }} className="text-yellow-300 font-black text-[120px] drop-shadow-[0_0_80px_rgba(250,204,21,1)]">
              BONUS ACTIVATED
            </motion.div>
          </motion.div>
        )}


        <img src="/assets/slotjack-logo.png" className="absolute top-[3.5%] left-1/2 -translate-x-1/2 w-[37%] max-w-[595px] z-10" draggable="false" />

        <div className={`absolute top-[2%] left-[3%] z-20 rounded-xl bg-black/80 border-2 border-green-400 px-5 py-3 text-green-400 font-black shadow-[0_0_25px_rgba(34,197,94,.55)] ${progressiveGlow ? "animate-pulse scale-105 shadow-[0_0_60px_rgba(34,197,94,.9)]" : ""}`}>
          <div className="text-xs tracking-widest text-green-200">PROGRESSIVE JACKPOT</div>
          <div className="text-2xl">{money(PROGRESSIVE_JACKPOT)}</div>
        </div>

        <div className="absolute top-[13%] left-[3%] z-20 rounded-xl bg-black/70 border border-yellow-400/60 px-5 py-3 text-yellow-300 font-black shadow-2xl">
          <div>Credits: {money(credits)}</div>
          <div>Total Bet: {money(roundCost)}</div>
          <div>Last Win: {money(lastWin)}</div>
        </div>

        <div onMouseLeave={() => setSuppressOddsHover(false)} className="group absolute top-[19.5%] left-[17.2%] z-[300] pointer-events-auto">
          <button
            type="button"
            onClick={() => { setOddsOpen((v) => !v); setSuppressOddsHover(true); }}
            className="w-[82px] text-center rounded-full bg-black/80 border-2 border-yellow-300 px-4 py-2 text-yellow-300 text-sm font-black tracking-widest shadow-[0_0_18px_rgba(250,204,21,.45)] hover:scale-105 active:scale-95 transition outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
          >
            ODDS
          </button>
          <div className={`absolute left-0 top-[48px] ${oddsOpen ? "block" : suppressOddsHover ? "hidden" : "hidden group-hover:block"} w-[720px] rounded-3xl bg-black/95 border-4 border-yellow-300 p-7 text-left text-yellow-100 shadow-[0_0_45px_rgba(250,204,21,.75)] z-[30000] pointer-events-auto`}>
            <div className="mb-4 text-yellow-300 text-3xl font-black tracking-widest">ODDS / RTP NOTE</div>
            <ol className="space-y-5 text-xl font-black leading-snug list-decimal list-inside">
              <li>The game is currently tuned to have favorable player outcomes and frequent 21s to show off features of the game.</li>
              <li>The game can be tuned to traditional blackjack probabilities and return to player will result in a house edge due to the player sidebet costs and player deviation from basic strategy in attempts to reach 21 bonus.</li>
              <li>Sidebets only pay out in 21, split, or double down situations, and prize frequency in the side bet bonus games can be adjusted to find a return to player that balances house edge with player engagement.</li>
            </ol>
          </div>
        </div>

        <div onMouseLeave={() => setSuppressRulesHover(false)} className="group absolute top-[11.0%] left-[17.2%] z-[30000] pointer-events-auto">
          <button
            type="button"
            onClick={() => { setRulesOpen((v) => !v); setSuppressRulesHover(true); }}
            className="w-[82px] text-center rounded-full bg-black/80 border-2 border-yellow-300 px-4 py-2 text-yellow-300 text-sm font-black tracking-widest shadow-[0_0_18px_rgba(250,204,21,.45)] hover:scale-105 active:scale-95 transition outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
          >
            RULES
          </button>
          <div className={`absolute left-0 top-[48px] ${rulesOpen ? "block" : suppressRulesHover ? "hidden" : "hidden group-hover:block"} w-[720px] rounded-3xl bg-black/95 border-4 border-yellow-300 p-7 text-left text-yellow-100 shadow-[0_0_45px_rgba(250,204,21,.75)] z-[9999] pointer-events-auto`}>
            <div className="mb-4 text-yellow-300 text-3xl font-black tracking-widest">SLOTJACK RULES</div>
            <ol className="space-y-5 text-xl font-black leading-snug list-decimal list-inside">
              <li>Bet "21 spin" sidebet to activate "spin to hit" mechanism. All hit cards taken by spinning slot reels.</li>
              <li>Press spin again quickly to stop reels mid spin.</li>
              <li>With "21 spin" sidebet active, any player 21 activates a bonus game.</li>
              <li>With "double down double up" sidebet active, any 10 or 11 (except blackjack) can be doubled down and results in a bonus game.</li>
              <li>With "split screen" sidebet active, any hands the player splits will result in a bonus game.</li>
              <li>10s cannot be split, no re-splitting of any cards, no double after split.</li>
              <li>There is no surrender.</li>
              <li>Blackjack pays 6:5.</li>
            </ol>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSoundEnabled((v) => !v)}
          className="absolute top-[14.2%] right-[5%] z-[140] rounded-full bg-black/80 border-2 border-yellow-300 px-4 py-2 text-yellow-300 text-sm font-black tracking-widest shadow-[0_0_18px_rgba(250,204,21,.45)] hover:scale-105 active:scale-95 transition outline-none focus:outline-none focus-visible:outline-none focus:ring-0"
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
            tooltipOpen={openSideBetTooltip === "double"}
            hoverEnabled={suppressedSideBetHover !== "double"}
            onTooltipMouseLeave={() => setSuppressedSideBetHover(null)}
            onTooltipToggle={() => { setOpenSideBetTooltip((v) => v === "double" ? null : "double"); setSuppressedSideBetHover("double"); }}
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
            tooltipOpen={openSideBetTooltip === "split"}
            hoverEnabled={suppressedSideBetHover !== "split"}
            onTooltipMouseLeave={() => setSuppressedSideBetHover(null)}
            onTooltipToggle={() => { setOpenSideBetTooltip((v) => v === "split" ? null : "split"); setSuppressedSideBetHover("split"); }}
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
            tooltipOpen={openSideBetTooltip === "spin"}
            hoverEnabled={suppressedSideBetHover !== "spin"}
            onTooltipMouseLeave={() => setSuppressedSideBetHover(null)}
            onTooltipToggle={() => { setOpenSideBetTooltip((v) => v === "spin" ? null : "spin"); setSuppressedSideBetHover("spin"); }}
            dropKey={autoChipDropKey}
            className="left-0 top-[210px] scale-[1.0] drop-shadow-[0_0_18px_rgba(255,215,0,.9)]"
          />

          <button
            type="button"
            disabled={lockBets || blackjackBet <= 0}
            onClick={reduceMainBet}
            title="Click to reduce main bet"
            className="absolute left-[118px] top-[330px] w-[120px] h-[110px] flex flex-col items-center justify-center bg-transparent border-0 p-0 pointer-events-auto transition hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
          >
            <div className="relative w-14 h-14 rounded-full border-4 border-yellow-300/70 bg-black/35 grid place-items-center overflow-visible shadow-[0_0_20px_rgba(250,204,21,.5)]">
              {Array.from({ length: Math.min(9, Math.ceil(blackjackBet / 25) || 1) }).map((_, i) => (
                <div
                  key={`rail-chip-${i}`}
                  className="absolute w-14 h-14 rounded-full bg-gradient-to-br from-red-600 via-red-800 to-black border-4 border-yellow-300 shadow-xl grid place-items-center"
                  style={{ transform: `translate(0px, ${8 - i * 7}px)`, zIndex: i }}
                >
                  <span className="text-yellow-100 font-black text-xs">{i === Math.min(8, Math.ceil(blackjackBet / 25) || 1) - 1 ? `$${lastChip.toLocaleString()}` : ""}</span>
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
                  {money(lastChip)}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="absolute left-[112px] top-[40px] -translate-y-1/2 rounded-md bg-black/85 border-2 border-yellow-300 px-2.5 py-0.5 text-yellow-300 text-xs font-black shadow-[0_0_14px_rgba(250,204,21,.5)] whitespace-nowrap pointer-events-none">
              {money(blackjackBet)}
            </div>
            <div className="mt-2 text-center text-yellow-300 font-black text-lg drop-shadow-[0_0_8px_rgba(0,0,0,.9)]">MAIN BET</div>
          </button>
        </div>

        <div className="absolute top-[26.75%] left-[49.5%] -translate-x-1/2 z-20 flex flex-col items-center transition">
          <div className={`mb-2 min-w-[116px] text-center rounded-xl bg-black/75 border px-[17px] py-[3px] text-yellow-300 font-black text-sm shadow-xl transition ${dealerResolving ? "border-yellow-300 animate-[edgeGlowPulse_2.2s_infinite]" : "border-yellow-300/60"}`}>DEALER HAND</div>
          <div className="flex gap-3 min-h-[105px] rounded-xl transition">
            {(dealerResolving ? dealerRevealCards : dealer).length ? (dealerResolving ? dealerRevealCards : dealer).map((card, i) => (
              <CardFace
                key={`${card.rank}${card.suit}-${i}`}
                card={card}
                hidden={!dealerResolving && phase !== "complete" ? i === 1 : false}
                delay={dealerResolving ? 0 : (i === 0 ? 0.18 : 0.54)}
              />
            )) : null}
          </div>
          <div className={`mt-1 bg-black/65 border rounded-full px-3 py-1 font-black text-yellow-300 text-sm transition ${dealerResolving ? "border-yellow-300 animate-[edgeGlowPulse_2.2s_infinite]" : "border-yellow-300/50"}`}>
            {dealer.length ? (dealerResolving ? (dealerRevealCards.length ? handValue(dealerRevealCards) : handDisplayValue([dealer[0]])) : phase === "complete" ? dealerTotal : handDisplayValue([dealer[0]])) : "—"}
          </div>
        </div>

        <div className={`absolute top-[54.5%] ${splitHand ? "left-[40%]" : "left-[49.5%]"} -translate-x-1/2 ${splitHand ? "z-[120]" : "z-20"} flex flex-col items-center transition`}>
          {splitPlayActive && splitActiveHandIndex === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-300 text-4xl font-black drop-shadow-[0_0_14px_rgba(250,204,21,1)] pointer-events-none"
            >
              ↓
            </motion.div>
          ) : null}
          {(() => {
            const handOneDisplay = splitHand && splitActiveHandIndex === 1 ? splitHand : player;
            return (
              <>
                <div className={`mb-2 min-w-[128px] text-center rounded-xl bg-black/75 border px-5 py-1 text-yellow-300 font-black text-sm shadow-xl transition ${splitPlayActive && splitActiveHandIndex === 0 ? "border-green-400 animate-[edgeGlowPulse_2.2s_infinite]" : phase === "player" && handReady && !splitHand ? "border-yellow-300 animate-[edgeGlowPulse_2.2s_infinite]" : "border-yellow-300/60"}`}>{splitHand ? "HAND 1" : "PLAYER HAND"}</div>
                <div className="flex gap-3 min-h-[105px]">
                  {handOneDisplay.length ? handOneDisplay.map((card, i) => <CardFace key={`hand-one-${card.rank}${card.suit}-${i}`} card={card} delay={i === 0 ? 0.36 : i === 1 ? 0.72 : 0} fromShoe={i < 2 && !splitHand} />) : null}
                </div>
                <div className="mt-1 bg-black/70 border border-yellow-300/50 rounded-full px-4 py-1 text-xl font-black text-yellow-300">
                  {handOneDisplay.length ? handValue(handOneDisplay) : "—"}
                </div>
              </>
            );
          })()}
          {splitHand ? (
            <div className="absolute left-[112%] top-[10%] flex flex-col items-center">
              {splitPlayActive && splitActiveHandIndex === 1 ? (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-10 left-1/2 -translate-x-1/2 text-yellow-300 text-4xl font-black drop-shadow-[0_0_14px_rgba(250,204,21,1)] pointer-events-none"
                >
                  ↓
                </motion.div>
              ) : null}
              {(() => {
                const handTwoDisplay = splitPlayActive && splitActiveHandIndex === 1 ? player : splitHand;
                return (
                  <>
                    <div className={`mb-2 min-w-[128px] text-center rounded-xl bg-purple-950/90 border px-3 py-1 text-yellow-300 font-black text-sm transition ${splitPlayActive && splitActiveHandIndex === 1 ? "border-green-400 animate-[edgeGlowPulse_2.2s_infinite]" : "border-yellow-300"}`}>HAND 2</div>
                    <div className="flex gap-2">
                      {handTwoDisplay.map((card, i) => <CardFace key={`hand-two-${card.rank}${card.suit}-${i}`} card={card} delay={0.1 * i} fromShoe={false} />)}
                    </div>
                    <div className="mt-1 bg-black/70 border border-yellow-300/50 rounded-full px-4 py-1 text-lg font-black text-yellow-300">{handValue(handTwoDisplay)}</div>
                  </>
                );
              })()}
            </div>
          ) : null}
        </div>
        <AnimatePresence>
          {splitHandNotice ? (
            <motion.div
              key={splitHandNotice}
              initial={{ opacity: 0, scale: 0.75, y: 12 }}
              animate={{ opacity: 1, scale: [0.75, 1.08, 1], y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              className="absolute left-[40%] top-[49%] -translate-x-1/2 z-[140] rounded-2xl bg-yellow-400 border-4 border-white px-8 py-3 text-black text-3xl font-black shadow-[0_0_38px_rgba(250,204,21,.95)] pointer-events-none"
            >
              {splitHandNotice}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="absolute top-[40.5%] right-[1.5%] z-20 w-[38%] max-w-[610px]">
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap text-yellow-300 font-black text-[46px] tracking-[0.04em] font-extrabold drop-shadow-[0_0_28px_rgba(250,204,21,1)]">SPIN TO HIT</div>
          <img src="/assets/spin-to-hit-panel.png" className={`w-full drop-shadow-2xl ${spinning ? "animate-pulse" : ""} ${anticipatingSpin ? "scale-105 brightness-125" : ""}`} draggable="false" />
          <motion.div
            animate={spinHitQuickStopJolt ? { x: [0, -12, 10, -6, 3, 0], rotate: [0, -1.4, 1.1, -0.6, 0.2, 0] } : { x: 0, rotate: 0 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="absolute left-[7.7%] right-[7.5%] top-[16.25%] h-[60%] grid grid-cols-5 gap-2 origin-center"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`rounded-md grid place-items-center font-black text-white transform scale-x-[0.86] scale-y-[0.885] translate-y-[3px] origin-bottom ${hitCards[i] ? "bg-white" : "bg-transparent"}`}>
                {hitCards[i] ? (
                  <motion.span initial={{ scale: 0.2, opacity: 0, rotateY: 90 }} animate={{ scale: 1, opacity: 1, rotateY: 0 }} transition={{ type: "spring", stiffness: 180, damping: 16 }} className={`${hitCards[i].suit === "♥" || hitCards[i].suit === "♦" ? "text-red-600" : "text-black"} text-[26px] leading-none font-black tracking-[-0.04em]`}>
                    {hitCards[i].rank}{hitCards[i].suit}
                  </motion.span>
                ) : spinning && i === hitCards.length ? <SpinningReelCell active /> : ""}
              </div>
            ))}
          </motion.div>
        </div>

        <div
          className="absolute top-[58.6%] right-[17%] z-[500] pointer-events-auto"
          onPointerDown={() => {
            if (phase === "idle" || phase === "complete") {
              warmAudioCache();
              dealCardAudioPrimedAtRef.current = Date.now();
              playAudioFile(AUDIO.card, "card");
            }
          }}
        >
          {phase === "idle" || phase === "complete" ? <ImgButton src="/assets/deal-button.png" onClick={dealRound} disabled={false} className="z-[520] w-[482px] h-[217px] drop-shadow-[0_0_26px_rgba(250,204,21,.9)]" glow="gold" /> : null}
        </div>

        <div className="absolute bottom-[3.2%] left-[50%] -translate-x-1/2 z-[95] flex items-center justify-center gap-3 pointer-events-auto">
          <ImgButton src="/assets/stand-button.png" onClick={stand} disabled={phase !== "player" || spinning || !handReady} className="w-[118px] h-[118px]" glow="blue" />
          <div className="relative w-[205px] h-[205px]">
            <ImgButton
              src="/assets/spin-button.png"
              onClick={spinToHit}
              disabled={phase !== "player" || !handReady || (splitPlayActive && (splitCurrentHandLocked || splitAcesLocked || handValue(player) >= 21))}
              className={`w-[205px] h-[205px] drop-shadow-[0_0_18px_rgba(239,68,68,.65)] will-change-transform ${
                phase === "player" && handReady && spinning
                  ? anticipatingSpin
                    ? "animate-[quickStopPulseFast_0.42s_infinite]"
                    : "animate-[quickStopPulse_0.72s_infinite]"
                  : phase === "player" && handReady && !spinning
                    ? "animate-[buttonPulse_1.9s_infinite] [animation-delay:0.4s]"
                    : ""
              }`}
              glow="red"
            />
            {phase === "player" && handReady && spinning ? (
              <div className="absolute left-1/2 bottom-[-13px] z-[150] -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/85 border border-yellow-300/80 px-3.5 py-1.5 text-yellow-300 text-[12px] font-black tracking-wider uppercase shadow-[0_0_14px_rgba(250,204,21,.45)] pointer-events-none">
                spin again to quick stop
              </div>
            ) : null}
          </div>
        </div>

        <div className="absolute bottom-[7.5%] left-[83%] -translate-x-1/2 z-[88] flex items-end justify-center gap-0 pointer-events-auto">
          <div className="flex flex-col items-center gap-1">
            <ImgButton src="/assets/double-button.png" onClick={doubleDown} disabled={!canDoubleDown || spinning} className="w-[292px] h-[148px] translate-x-[-10px] translate-y-[14px] drop-shadow-[0_0_22px_rgba(250,204,21,.75)]" glow="gold" />
            {doubleBonusOn ? (
              <div className="rounded-lg bg-black/80 border border-yellow-300/70 px-4 py-1.5 text-yellow-300 font-black text-[12px] leading-tight text-center shadow-xl -mt-2">
                ONLY ACTIVE ON PLAYER 10 OR 11
              </div>
            ) : null}
          </div>
          <div className="flex flex-col items-center gap-1 -ml-8">
            <ImgButton src="/assets/split-button.png" onClick={splitPair} disabled={!canSplit || spinning} className="w-[347px] h-[177px] translate-x-[-10px] translate-y-[14px] drop-shadow-[0_0_22px_rgba(168,85,247,.75)]" glow="purple" />
            {splitBonusOn ? (
              <div className="rounded-lg bg-black/80 border border-yellow-300/70 px-4 py-1.5 text-yellow-300 font-black text-[12px] leading-tight text-center shadow-xl -mt-2">
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
          <motion.div initial={{ x: -520, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 115, damping: 18 }} className="absolute top-[145px] left-[48px] z-[12000] w-[540px] h-[665px] overflow-y-auto overflow-x-hidden touch-pan-y rounded-3xl bg-[#10216c]/95 border-4 border-yellow-300 p-4 pb-32 text-center shadow-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ WebkitOverflowScrolling: "touch" }}>
            {bonusType === "DOUBLE UP DOUBLE DOWN" && sideBonus && (
              <div className="space-y-4">
                <MiniSpinDevice title="HIT CARD REEL" value={sideBonus.revealed ? `${sideBonus.card.rank}${sideBonus.card.suit}` : null} spinning={sideBonus.spinning} />
                <MiniSpinDevice title="BONUS AMOUNT REEL" value={sideBonus.revealed ? money(sideBonus.amount) : null} spinning={sideBonus.spinning} type="amount" />
                <button onClick={startDoubleSideBonus} disabled={sideBonus.revealed} className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-black disabled:opacity-40">{sideBonus.spinning ? "QUICK STOP" : "SPIN DOUBLE BONUS"}</button>
                <div className="mx-auto max-w-[430px] rounded-xl bg-black/55 border border-yellow-300/50 px-4 py-2 text-yellow-100 text-sm font-black leading-snug shadow-[0_0_18px_rgba(250,204,21,.25)]">
                  Spin to reveal the hit card and bonus prize for double down hand.
                </div>
              </div>
            )}

            {bonusType === "SPLIT SCREEN" && sideBonus && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <MiniSpinDevice title="SPLIT HAND 1" value={sideBonus.revealed ? `${sideBonus.cardA.rank}${sideBonus.cardA.suit}` : null} spinning={sideBonus.spinning} />
                  <MiniSpinDevice title="SPLIT HAND 2" value={sideBonus.revealed ? `${sideBonus.cardB.rank}${sideBonus.cardB.suit}` : null} spinning={sideBonus.spinning} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniSpinDevice title="BONUS 1" value={sideBonus.revealed ? money(sideBonus.amountA) : null} spinning={sideBonus.spinning} type="amount" />
                  <MiniSpinDevice title="BONUS 2" value={sideBonus.revealed ? money(sideBonus.amountB) : null} spinning={sideBonus.spinning} type="amount" />
                </div>
                <button onClick={startSplitSideBonus} disabled={sideBonus.revealed} className="bg-yellow-400 text-black px-6 py-3 rounded-xl font-black disabled:opacity-40">{sideBonus.spinning ? "QUICK STOP" : "SPIN SPLIT SCREEN"}</button>
                <div className="mx-auto max-w-[430px] rounded-xl bg-black/55 border border-yellow-300/50 px-4 py-2 text-yellow-100 text-sm font-black leading-snug shadow-[0_0_18px_rgba(250,204,21,.25)]">
                  Spin to reveal the hit card and bonus prize for each split hand.
                </div>
              </div>
            )}

            {bonusType === "21 BONUS WHEEL" && (
              <>
                <motion.div
                  animate={wheelQuickStopJolt ? { x: [0, -10, 8, -5, 3, 0], rotate: [0, -8, 5, -3, 1, 0] } : wheelSpinning ? { rotate: 1440 } : { rotate: 0 }}
                  transition={wheelQuickStopJolt ? { duration: 0.32, ease: "easeOut" } : { duration: 1 }}
                  className="relative mx-auto mt-10 w-72 h-72 rounded-full border-8 border-yellow-300 overflow-hidden shadow-[0_0_38px_rgba(250,204,21,.65)]"
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
                    const radians = ((angle - 90) * Math.PI) / 180;
                    const radius = 106;
                    const x = Math.cos(radians) * radius;
                    const y = Math.sin(radians) * radius;
                    const label = typeof prize === "number" ? String(prize) : prize === "PROGRESSIVE JACKPOT" ? "??" : String(resolvePrizeAmount(prize));
                    return (
                      <div
                        key={`${prize}-${i}`}
                        className="absolute z-10 w-[40px] h-[20px] rounded-full bg-black/65 border border-white/50 grid place-items-center text-[9px] leading-none font-black text-white drop-shadow-[0_0_5px_rgba(0,0,0,1)]"
                        style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, transform: "translate(-50%, -50%)" }}
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
                        className="absolute left-1/2 top-1/2 h-[144px] w-[2px] origin-bottom bg-black/45"
                        style={{ transform: `translate(-50%, -100%) rotate(${i * segment}deg)` }}
                      />
                    );
                  })}
                  <div className="absolute left-1/2 top-1/2 z-20 w-28 h-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black border-4 border-yellow-300 grid place-items-center text-yellow-300 text-2xl font-black shadow-[0_0_18px_rgba(0,0,0,.9)]">{wheelResult ?? "SPIN"}</div>
                </motion.div>
                <button onClick={spinWheel} disabled={wheelResult !== null} className="mt-6 bg-yellow-400 text-black px-6 py-3 rounded-xl font-black disabled:opacity-40">{wheelSpinning ? "QUICK STOP" : "SPIN WHEEL"}</button>
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
                    className="absolute left-1/2 top-[185px] -translate-x-1/2 z-[20000] rounded-2xl bg-green-500 border-4 border-white px-6 py-3 text-black text-3xl font-black shadow-[0_0_38px_rgba(34,197,94,.95)] pointer-events-none"
                  >
                    +{money(hiddenPrizeFlash)}
                  </motion.div>
                ) : null}
              </AnimatePresence>

                <div className="grid grid-cols-4 gap-2 mx-auto">
                  {Array.from({ length: 4 }).map((_, colIndex) => {
                    const active = colIndex === hiddenColumnIndex && !hiddenGameOver;
                    return (
                      <div key={colIndex} className={`relative overflow-visible rounded-2xl border-4 p-1.5 space-y-1.5 ${active ? "border-yellow-300 bg-yellow-300/20 shadow-[0_0_22px_rgba(250,204,21,.7)]" : "border-white/20 bg-black/30"}`}>
                        {active ? (
                          <motion.div
                            className="absolute inset-[-8px] z-[1] rounded-3xl border-4 border-cyan-300/90 shadow-[0_0_26px_rgba(34,211,238,.95)] pointer-events-none"
                            animate={hiddenColumnIndex >= 2 ? { y: [-7, 7, -7], opacity: [0.72, 1, 0.72] } : { opacity: [0.7, 1, 0.7] }}
                            transition={{ duration: hiddenColumnIndex >= 3 ? 0.42 : hiddenColumnIndex >= 2 ? 0.75 : 1.4, repeat: Infinity, ease: "easeInOut" }}
                          />
                        ) : null}
                        <div className={`relative z-[2] text-xs font-black ${active ? "text-yellow-300" : "text-white/50"}`}>COLUMN {colIndex + 1}</div>
                        {Array.from({ length: 3 }).map((_, cardIndex) => {
                          const card = hiddenColumns[colIndex]?.[cardIndex] || "?";
                          const picked = hiddenPicks.some((p) => p.columnIndex === colIndex && p.cardIndex === cardIndex);
                          const red = card.includes("♥") || card.includes("♦");
                          return (
                            <button key={`${colIndex}-${cardIndex}`} disabled={!active || picked} onClick={() => pickHiddenHand(colIndex, cardIndex)} className={`relative z-[2] h-14 w-full rounded-xl border-2 font-black text-xl transition ${picked ? "bg-white border-yellow-300" : active ? "bg-gradient-to-br from-red-800 to-slate-950 border-yellow-300 hover:scale-105" : "bg-slate-900 border-slate-700 opacity-45"}`}>
                              {picked ? <span className={red ? "text-red-600" : "text-black"}>{card}</span> : <span className="text-yellow-300">?</span>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl bg-black/50 border border-yellow-300/60 p-2 text-yellow-300 font-black">
                  {hiddenTargetRank ? `Match ${hiddenTargetRank} exactly | Matches: ${Math.max(0, hiddenPicks.length - 1)}` : "Pick a card then find its match in each column."}
                </div>
              </div>
            )}

            {bonusType === "FREE SPINS FEATURE" && (
              <div className="space-y-2">
                <div className="text-2xl font-black text-yellow-300">Free Spins Feature</div>
                <div className="text-sm font-black text-white">3 Free Spins</div>
                <motion.div animate={freeSpinQuickStopJolt ? { x: [0, -10, 8, -5, 0], rotate: [0, -1.5, 1, -0.5, 0] } : { x: 0, rotate: 0 }} transition={{ duration: 0.32, ease: "easeOut" }} className="grid grid-cols-3 gap-2 max-w-[360px] mx-auto rounded-2xl bg-black/50 border-4 border-yellow-300 p-2 overflow-hidden">
                  {Array.from({ length: 9 }).map((_, i) => {
                    const symbol = freeSpinGrid[i] || FREE_SPIN_SYMBOLS[0];
                    const isBigBonus = ["GRAND", "MAJOR", "MINI", "WILD", "PROGRESSIVE", "+2 SPINS"].includes(symbol.label);
                    return (
                      <div key={`${symbol.label}-${i}-${freeSpinsLeft}`} className={`h-14 rounded-xl border-2 grid place-items-center overflow-hidden ${isBigBonus ? "bg-gradient-to-b from-yellow-200 to-yellow-500 border-white" : "bg-white border-slate-200"}`}>
                        {freeSpinSpinning ? (
                          <motion.div animate={{ y: ["-65%", "18%", "-65%"] }} transition={{ duration: 0.16, repeat: Infinity, ease: "linear" }} className="flex flex-col gap-4">
                            {["$2", "$5", "$10", ...(freeSpinExtraAwarded < 2 ? ["+2 SPINS"] : []), "WILD", "MINI", "MAJOR", "GRAND"].map((s, k) => (
                              <div key={k} className={`text-lg font-black ${["WILD", "MINI", "MAJOR", "GRAND", "+2 SPINS"].includes(s) ? "text-red-700" : "text-black"}`}>{s}</div>
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
                </motion.div>
                <AnimatePresence>{freeSpinExtraFlash ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.55, x: -18 }}
                    animate={{ opacity: 1, scale: [0.55, 1.12, 1], x: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute left-[7%] bottom-[16%] z-[20001] rounded-2xl bg-green-500 border-4 border-white px-5 py-3 text-black text-3xl font-black shadow-[0_0_45px_rgba(34,197,94,.9)] pointer-events-none"
                  >
                    {`+${freeSpinExtraFlash} FREE SPINS`}
                  </motion.div>
                ) : null}</AnimatePresence>
                <AnimatePresence>
                  {freeSpinPrizeFlash ? (
                    <motion.div
                      key={`free-spin-prize-${freeSpinPrizeFlash}`}
                      initial={{ opacity: 0, scale: 0.55, y: 12 }}
                      animate={{ opacity: 1, scale: [0.55, 1.08, 1], y: 0 }}
                      exit={{ opacity: 0, scale: 0.85, y: -10 }}
                      className="absolute left-[92px] top-[425px] z-[20000] rounded-2xl bg-green-500 border-3 border-white px-5 py-2 text-black text-2xl font-black shadow-[0_0_32px_rgba(34,197,94,.95)] pointer-events-none"
                    >
                      WON {money(freeSpinPrizeFlash)}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <AnimatePresence>
                  {freeSpinFinalFlash ? (
                    <motion.div
                      key={`free-spin-final-${freeSpinFinalFlash}`}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: [0.5, 1.12, 1] }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      className="absolute left-1/2 top-[260px] -translate-x-1/2 z-[20000] rounded-3xl bg-green-500 border-4 border-white px-8 py-5 text-black text-4xl font-black text-center shadow-[0_0_50px_rgba(34,197,94,.95)] pointer-events-none"
                    >
                      TOTAL WON
                      <div className="mt-1 text-5xl">${freeSpinFinalFlash.toLocaleString()}</div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                <div className="flex items-center justify-center gap-5">
                  <div className="rounded-xl bg-black/60 border border-yellow-300 px-3 py-2 text-yellow-300 font-black text-sm">Spins Left: {freeSpinsLeft}</div>
                                  </div>
                <button onClick={playFreeSpin} disabled={freeSpinsLeft <= 0} className="mt-1 bg-yellow-400 text-black px-6 py-2 rounded-xl font-black disabled:opacity-40">{freeSpinSpinning ? "QUICK STOP" : "PLAY FREE SPIN"}</button>
              </div>
            )}

            {bonusResolved && (bonusType !== "HIDDEN HAND" || hiddenGameOver) && (bonusType !== "FREE SPINS FEATURE" || freeSpinsLeft <= 0) ? (
              <button onClick={continueAfterBonus} className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white text-black px-7 py-3 rounded-xl font-black z-[999] pointer-events-auto shadow-2xl">BACK TO TABLE</button>
            ) : null}
          </motion.div>
        )}
      </div>
    </div>
  );
}