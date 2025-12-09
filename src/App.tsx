import { useEffect, useRef, useState } from "react";
import "./App.css";

const GRID_SIZE = 6;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const INITIAL_TIME = 30;
const COLOR_POOL = ["#f97316", "#0ea5e9", "#facc15", "#22d3ee", "#a855f7", "#ec4899"];
const MIN_MATCH = 3;
const COMBO_RESOLVE_DELAY = 320;
const FILL_DELAY = 140;

type ComboStep = {
  indices: number[];
  gridAfter: string[];
  score: number;
  comboLevel: number;
};

type ComboResult = {
  steps: ComboStep[];
  totalScore: number;
  combos: number;
  totalCleared: number;
  finalGrid: string[];
};

const randomColor = () => COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];

const createGrid = () => Array.from({ length: TOTAL_CELLS }, randomColor);

const cycleColor = (color: string) => {
  const index = COLOR_POOL.indexOf(color);
  if (index === -1) return randomColor();
  return COLOR_POOL[(index + 1) % COLOR_POOL.length];
};

const formatTime = (seconds: number) => {
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
};

function findMatches(grid: string[]): Set<number> {
  const matches = new Set<number>();

  // Horizontal matches
  for (let row = 0; row < GRID_SIZE; row += 1) {
    let runColor = grid[row * GRID_SIZE];
    let runStart = 0;
    let runLength = 1;

    for (let col = 1; col < GRID_SIZE; col += 1) {
      const index = row * GRID_SIZE + col;
      const currentColor = grid[index];
      if (currentColor === runColor) {
        runLength += 1;
      } else {
        if (runColor && runLength >= MIN_MATCH) {
          for (let offset = 0; offset < runLength; offset += 1) {
            matches.add(row * GRID_SIZE + runStart + offset);
          }
        }
        runColor = currentColor;
        runStart = col;
        runLength = 1;
      }
    }

    if (runColor && runLength >= MIN_MATCH) {
      for (let offset = 0; offset < runLength; offset += 1) {
        matches.add(row * GRID_SIZE + runStart + offset);
      }
    }
  }

  // Vertical matches
  for (let col = 0; col < GRID_SIZE; col += 1) {
    let runColor = grid[col];
    let runStart = 0;
    let runLength = 1;

    for (let row = 1; row < GRID_SIZE; row += 1) {
      const index = row * GRID_SIZE + col;
      const currentColor = grid[index];
      if (currentColor === runColor) {
        runLength += 1;
      } else {
        if (runColor && runLength >= MIN_MATCH) {
          for (let offset = 0; offset < runLength; offset += 1) {
            matches.add((runStart + offset) * GRID_SIZE + col);
          }
        }
        runColor = currentColor;
        runStart = row;
        runLength = 1;
      }
    }

    if (runColor && runLength >= MIN_MATCH) {
      for (let offset = 0; offset < runLength; offset += 1) {
        matches.add((runStart + offset) * GRID_SIZE + col);
      }
    }
  }

  return matches;
}

function resolveCombos(grid: string[]): ComboResult {
  let workingGrid = [...grid];
  const steps: ComboStep[] = [];
  let combos = 0;
  let totalScore = 0;
  let totalCleared = 0;

  while (combos < 15) {
    const matches = findMatches(workingGrid);
    if (matches.size === 0) {
      break;
    }

    combos += 1;
    const indices = Array.from(matches);
    totalCleared += indices.length;

    const comboMultiplier = combos;
    const basePoints = 90;
    const stepScore = indices.length * basePoints * comboMultiplier;
    totalScore += stepScore;

    const gridAfter = [...workingGrid];
    indices.forEach((idx) => {
      gridAfter[idx] = randomColor();
    });

    steps.push({
      indices,
      gridAfter,
      score: stepScore,
      comboLevel: combos,
    });

    workingGrid = gridAfter;
  }

  return {
    steps,
    totalScore,
    combos,
    totalCleared,
    finalGrid: workingGrid,
  };
}

function App() {
  const [grid, setGrid] = useState<string[]>(() => createGrid());
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window === "undefined") return 0;
    const stored = window.localStorage.getItem("chainReactionHighScore");
    return stored ? Number(stored) : 0;
  });
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [highlightedCells, setHighlightedCells] = useState<number[]>([]);
  const [lastCombo, setLastCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [justScored, setJustScored] = useState<number | null>(null);
  const [shakeBoard, setShakeBoard] = useState(false);
  const [comboPulse, setComboPulse] = useState(false);
  const [multiplierTrail, setMultiplierTrail] = useState<number[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutsRef = useRef<number[]>([]);

  const clearScheduled = () => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
  };

  const schedule = (callback: () => void, delay: number) => {
    const id = window.setTimeout(() => {
      timeoutsRef.current = timeoutsRef.current.filter((stored) => stored !== id);
      callback();
    }, delay);
    timeoutsRef.current.push(id);
  };

  const runComboSequence = (steps: ComboStep[], onComplete: () => void) => {
    if (steps.length === 0) {
      onComplete();
      return;
    }

    let delay = 0;

    steps.forEach((step) => {
      schedule(() => {
        setHighlightedCells(step.indices);
      }, delay);

      schedule(() => {
        setGrid(step.gridAfter);
        setHighlightedCells([]);
      }, delay + COMBO_RESOLVE_DELAY);

      delay += COMBO_RESOLVE_DELAY + FILL_DELAY;
    });

    schedule(() => {
      setHighlightedCells([]);
      onComplete();
    }, delay);
  };

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning, timeLeft]);

  useEffect(() => clearScheduled, []);

  const ensureHighScore = (value: number) => {
    setHighScore((prev) => {
      if (value > prev) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("chainReactionHighScore", String(value));
        }
        return value;
      }
      return prev;
    });
  };

  const handleCellClick = (index: number) => {
    if (timeLeft === 0 || isAnimating) return;

    if (!isRunning) {
      setIsRunning(true);
    }

    const clickedGrid = [...grid];
    clickedGrid[index] = cycleColor(clickedGrid[index]);

    const result = resolveCombos(clickedGrid);

    clearScheduled();
    setHighlightedCells([]);
    setGrid(clickedGrid);

    if (result.totalScore > 0) {
      setScore((prev) => {
        const updated = prev + result.totalScore;
        ensureHighScore(updated);
        return updated;
      });
      setJustScored(result.totalScore);
      schedule(() => setJustScored(null), 900);
    } else {
      setJustScored(null);
    }

    setLastCombo(result.combos);
    setBestCombo((prev) => Math.max(prev, result.combos));

    if (result.combos > 0) {
      setComboPulse(true);
      schedule(() => setComboPulse(false), 480);
      setMultiplierTrail((prev) => [...prev.slice(-3), result.combos]);
    } else {
      setComboPulse(false);
    }

    if (result.combos > 1) {
      setShakeBoard(true);
      schedule(() => setShakeBoard(false), 480);
    } else {
      setShakeBoard(false);
    }

    if (result.steps.length > 0) {
      setIsAnimating(true);
      runComboSequence(result.steps, () => {
        setIsAnimating(false);
        setHighlightedCells([]);
      });
    } else {
      setIsAnimating(false);
    }
  };

  const handleRestart = () => {
    clearScheduled();
    setGrid(createGrid());
    setScore(0);
    setTimeLeft(INITIAL_TIME);
    setIsRunning(false);
    setHighlightedCells([]);
    setLastCombo(0);
    setBestCombo(0);
    setJustScored(null);
    setShakeBoard(false);
    setComboPulse(false);
    setMultiplierTrail([]);
    setIsAnimating(false);
  };

  const progress = Math.max(0, Math.min(100, (timeLeft / INITIAL_TIME) * 100));

  return (
    <div className="app">
      <header className="hud">
        <div className="hud__card">
          <span className="label">Pontuação</span>
          <strong>{score}</strong>
          {justScored ? <span className="delta">+{justScored}</span> : null}
        </div>
        <div className={`hud__card hud__combo ${comboPulse ? "hud__combo--pulse" : ""}`}>
          <span className="label">Multiplicador</span>
          <strong>x{Math.max(1, lastCombo)}</strong>
          <span className="sub">Maior combo x{Math.max(1, bestCombo)}</span>
        </div>
        <div className="hud__card hud__timer">
          <span className="label">Tempo</span>
          <div className="timer">
            <div className="timer__bar">
              <div className="timer__fill" style={{ width: `${progress}%` }} />
            </div>
            <strong>{formatTime(timeLeft)}</strong>
          </div>
        </div>
        <div className="hud__card">
          <span className="label">Recorde</span>
          <strong>{highScore}</strong>
        </div>
      </header>

      <main className="arena">
        <div className={`board ${shakeBoard ? "board--shake" : ""}`}>
          {grid.map((color, index) => (
            <button
              key={index}
              type="button"
              className={`cell ${highlightedCells.includes(index) ? "cell--boom" : ""}`}
              style={{ backgroundColor: color }}
              onClick={() => handleCellClick(index)}
              disabled={timeLeft === 0 || isAnimating}
            />
          ))}
          {justScored ? <div className="score-float">+{justScored}</div> : null}
        </div>

        <aside className="sidebar">
          <h2>Chain Reaction 🎮</h2>
          <p>
            Clique para girar cores, alinhe 3+ blocos iguais e cause reações em cadeia
            explosivas. Cada combo aumenta o multiplicador! Você tem apenas 30 segundos.
          </p>

          <div className="combo-feed">
            <h3>Combos recentes</h3>
            <div className="combo-feed__trail">
              {multiplierTrail.length === 0 ? (
                <span className="combo-feed__empty">Ainda sem combos — bora começar!</span>
              ) : (
                multiplierTrail.map((combo, idx) => (
                  <span key={`${combo}-${idx}`} className="combo-feed__item">
                    x{combo}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="rules">
            <h3>Como jogar</h3>
            <ol>
              <li>Clique em qualquer célula para trocar sua cor.</li>
              <li>
                Forme linhas ou colunas com 3 ou mais cores iguais para explodir e pontuar.
              </li>
              <li>Reações em cadeia aumentam drasticamente o multiplicador.</li>
              <li>Bata seu recorde antes do tempo acabar!</li>
            </ol>
          </div>
        </aside>
      </main>

      <footer className="footer">
        {timeLeft === 0 ? (
          <div className="footer__content">
            <span className="footer__headline">Tempo esgotado!</span>
            <button type="button" className="action" onClick={handleRestart}>
              Jogar novamente
            </button>
          </div>
        ) : (
          <div className="footer__content">
            <span className="footer__headline">Reaja rápido e combine tudo!</span>
            <button type="button" className="action action--ghost" onClick={handleRestart}>
              Reiniciar agora
            </button>
          </div>
        )}
      </footer>
    </div>
  );
}

//vlw v0w samp.
export default App;
