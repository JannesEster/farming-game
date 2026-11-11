import type { FlowPhase, GameOverReason, YearEndReport } from "../types";
import type { TutorialStep } from "../tutorial";

export type FlowUiHandlers = {
  onYearEndContinue: () => void;
  onGameOverAck: () => void;
  onTutorialSkip: () => void;
  onTutorialNext: () => void;
};

export type FlowUiRenderModel = {
  phase: FlowPhase;
  yearEnd: YearEndReport | null;
  gameOverReason: GameOverReason | null;
};

export type FlowUi = {
  render: (model: FlowUiRenderModel) => void;
  showTutorial: (step: TutorialStep) => void;
  hideTutorial: () => void;
  hideAll: () => void;
  destroy: () => void;
};

export function mountFlowUi(handlers: FlowUiHandlers): FlowUi {
  let root = document.getElementById("flow-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "flow-root";
    root.className = "flow-root";
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <section class="flow-screen" id="flow-yearend" hidden>
      <div class="flow-card flow-card-wide" id="flow-yearend-card">
        <p class="flow-kicker" id="flow-yearend-season"></p>
        <h2 class="flow-title" id="flow-yearend-rating"></h2>
        <p class="flow-score" id="flow-yearend-score"></p>
        <ul class="flow-list" id="flow-yearend-goals"></ul>
        <ul class="flow-list flow-list-muted" id="flow-yearend-milestones"></ul>
        <button type="button" class="flow-btn flow-btn-primary" id="flow-yearend-continue">Next season</button>
      </div>
    </section>
    <section class="flow-screen" id="flow-gameover" hidden>
      <div class="flow-card">
        <h2 class="flow-title" id="flow-gameover-title">Game over</h2>
        <p class="flow-lede" id="flow-gameover-body"></p>
        <button type="button" class="flow-btn flow-btn-primary" id="flow-gameover-ok">Back to start</button>
      </div>
    </section>
    <aside class="flow-tutorial" id="flow-tutorial" hidden role="status" aria-live="polite">
      <div class="flow-tutorial-inner">
        <p class="flow-kicker">Tutorial</p>
        <h3 class="flow-tutorial-title" id="flow-tutorial-title"></h3>
        <p class="flow-tutorial-body" id="flow-tutorial-body"></p>
        <div class="flow-tutorial-actions">
          <button type="button" class="flow-btn flow-btn-ghost" id="flow-tutorial-skip">Skip</button>
          <button type="button" class="flow-btn flow-btn-primary" id="flow-tutorial-next">Got it</button>
        </div>
      </div>
    </aside>
  `;

  const yearEl = required(root, "flow-yearend");
  const gameOverEl = required(root, "flow-gameover");
  const tutorialEl = required(root, "flow-tutorial");

  required(root, "flow-yearend-continue").addEventListener("click", handlers.onYearEndContinue);
  required(root, "flow-gameover-ok").addEventListener("click", handlers.onGameOverAck);
  required(root, "flow-tutorial-skip").addEventListener("click", handlers.onTutorialSkip);
  required(root, "flow-tutorial-next").addEventListener("click", handlers.onTutorialNext);

  function hideScreens(): void {
    yearEl.hidden = true;
    gameOverEl.hidden = true;
  }

  return {
    render(model) {
      hideScreens();
      if (model.phase === "yearEndReview" && model.yearEnd) {
        yearEl.hidden = false;
        required(root, "flow-yearend-season").textContent = model.yearEnd.seasonLabel;
        required(root, "flow-yearend-rating").textContent = `Farm rating: ${model.yearEnd.rating}`;
        required(root, "flow-yearend-score").textContent = `Score ${model.yearEnd.score}/100`;
        const goals = required(root, "flow-yearend-goals");
        goals.innerHTML = "";
        for (const g of model.yearEnd.goalResults) {
          const li = document.createElement("li");
          li.textContent = `${g.met ? "✓" : "·"} ${g.label} — ${g.detail}`;
          goals.appendChild(li);
        }
        const miles = required(root, "flow-yearend-milestones");
        miles.innerHTML = "";
        for (const m of model.yearEnd.milestoneResults) {
          const li = document.createElement("li");
          li.textContent = `${m.met ? "✓" : "·"} ${m.label}`;
          miles.appendChild(li);
        }
        for (const line of model.yearEnd.summaryLines) {
          const li = document.createElement("li");
          li.textContent = line;
          goals.appendChild(li);
        }
      } else if (model.phase === "gameOver") {
        gameOverEl.hidden = false;
        const title = required(root, "flow-gameover-title");
        const body = required(root, "flow-gameover-body");
        if (model.gameOverReason === "bankrupt") {
          title.textContent = "Bankrupt";
          body.textContent = "Costs overtook cash. Balance sales, wages and drought costs to recover next run.";
        } else if (model.gameOverReason === "herdLost") {
          title.textContent = "Herd lost";
          body.textContent = "Condition or head count collapsed. Rest camps and water matter.";
        } else {
          title.textContent = "Game over";
          body.textContent = "The farm run ended.";
        }
      }
    },
    showTutorial(step) {
      tutorialEl.hidden = false;
      required(root, "flow-tutorial-title").textContent = step.title;
      required(root, "flow-tutorial-body").textContent = step.body;
    },
    hideTutorial() {
      tutorialEl.hidden = true;
    },
    hideAll() {
      hideScreens();
    },
    destroy() {
      root?.remove();
    },
  };
}

function required(root: ParentNode, id: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(`#${id}`);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}
