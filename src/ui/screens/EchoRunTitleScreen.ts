import { setMusicCue } from "../../core/audioSystem";
import { clearActiveEchoRun, getActiveEchoRun, startEchoRunSession } from "../../core/echoRuns";
import { showConfirmDialog } from "../components/confirmDialog";

function getEchoRunStageLabel(stage: string): string {
  switch (stage) {
    case "initial_units":
      return "Initial Unit Draft";
    case "initial_field":
      return "Initial Echo Field";
    case "map":
      return "Route Map";
    case "reward":
      return "Reward Draft";
    case "milestone":
      return "Milestone";
    case "results":
      return "Results";
    default:
      return "Echo Run";
  }
}

async function beginNewEchoRun(): Promise<void> {
  const existingRun = getActiveEchoRun();
  if (existingRun && existingRun.stage !== "results") {
    const confirmed = await showConfirmDialog({
      title: "OVERWRITE ACTIVE ECHO RUN",
      message: "Start a brand-new Echo Run and discard the current active simulation?",
      confirmLabel: "BEGIN NEW RUN",
      cancelLabel: "CANCEL",
      variant: "danger",
    });
    if (!confirmed) {
      return;
    }
  }

  clearActiveEchoRun();
  startEchoRunSession();
  const { renderEchoRunScreen } = await import("./EchoRunScreen");
  renderEchoRunScreen();
}

async function resumeEchoRun(): Promise<void> {
  const { renderEchoRunScreen } = await import("./EchoRunScreen");
  renderEchoRunScreen();
}

export function renderEchoRunTitleScreen(): void {
  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  setMusicCue("main-menu");

  const activeRun = getActiveEchoRun();
  const hasResumeRun = !!activeRun && activeRun.stage !== "results";
  const activeRunStageLabel = activeRun ? getEchoRunStageLabel(activeRun.stage) : "";

  app.innerHTML = `
    <div class="echo-run-root echo-run-root--title">
      <div class="echo-run-shell echo-run-shell--title">
        <section class="echo-run-title-screen">
          <div class="echo-run-title-screen__hero">
            <div class="echo-run-title-screen__lead">
              <div class="echo-run-title-screen__signal">S/COM_OS // ECHO RUNS</div>
              <h1 class="echo-run-title-screen__title">ECHO RUN</h1>
              <p class="echo-run-title-screen__copy">
                Enter a draft-only simulation run built around temporary operators, branching strata,
                escalating boss chains, and endlessly climbing route maps.
              </p>
              <div class="echo-run-title-screen__chip-row">
                <span class="echo-run-title-screen__chip">Branching Strata</span>
                <span class="echo-run-title-screen__chip">Echo Field Drafting</span>
                <span class="echo-run-title-screen__chip">Boss Chains</span>
                <span class="echo-run-title-screen__chip">No Carryover</span>
              </div>
              ${hasResumeRun ? `
                <div class="echo-run-title-screen__resume-note">
                  ACTIVE RUN DETECTED // STRATUM ${activeRun.currentStratum} // ENCOUNTER ${activeRun.encounterNumber} // ${activeRunStageLabel.toUpperCase()}
                </div>
              ` : ""}
              <div class="echo-run-title-screen__actions">
                ${hasResumeRun ? `
                  <button class="echo-run-secondary-btn echo-run-title-screen__action" type="button" id="echoRunResumeBtn">RESUME ACTIVE RUN</button>
                ` : ""}
                <button class="echo-run-primary-btn echo-run-title-screen__action echo-run-title-screen__action--primary" type="button" id="echoRunBeginBtn">
                  ${hasResumeRun ? "BEGIN NEW RUN" : "BEGIN ECHO RUN"}
                </button>
                <button class="echo-run-secondary-btn echo-run-title-screen__action" type="button" id="echoRunTitleBackBtn">RETURN TO MAIN MENU</button>
              </div>
            </div>

            <div class="echo-run-title-screen__side">
              <section class="echo-run-title-screen__panel">
                <div class="echo-run-title-screen__panel-kicker">Simulation Profile</div>
                <div class="echo-run-title-screen__stat-grid">
                  <div class="echo-run-title-screen__stat">
                    <span>Format</span>
                    <strong>Endless Draft Run</strong>
                  </div>
                  <div class="echo-run-title-screen__stat">
                    <span>Squad Model</span>
                    <strong>Temporary Operators</strong>
                  </div>
                  <div class="echo-run-title-screen__stat">
                    <span>Pressure</span>
                    <strong>Persistent HP</strong>
                  </div>
                  <div class="echo-run-title-screen__stat">
                    <span>Route Logic</span>
                    <strong>Encounter / Support / Boss</strong>
                  </div>
                </div>
              </section>

              <section class="echo-run-title-screen__panel echo-run-title-screen__panel--route">
                <div class="echo-run-title-screen__panel-kicker">Route Preview</div>
                <div class="echo-run-title-screen__route">
                  <div class="echo-run-title-screen__route-row echo-run-title-screen__route-row--single">
                    <span class="echo-run-title-screen__route-chip echo-run-title-screen__route-chip--milestone">Milestone</span>
                  </div>
                  <div class="echo-run-title-screen__route-links">
                    <span></span><span></span><span></span>
                  </div>
                  <div class="echo-run-title-screen__route-row">
                    <span class="echo-run-title-screen__route-chip echo-run-title-screen__route-chip--boss">Boss</span>
                    <span class="echo-run-title-screen__route-chip echo-run-title-screen__route-chip--boss">Boss Chain</span>
                  </div>
                  <div class="echo-run-title-screen__route-links">
                    <span></span><span></span><span></span>
                  </div>
                  <div class="echo-run-title-screen__route-row">
                    <span class="echo-run-title-screen__route-chip echo-run-title-screen__route-chip--support">Support</span>
                    <span class="echo-run-title-screen__route-chip echo-run-title-screen__route-chip--elite">Elite</span>
                    <span class="echo-run-title-screen__route-chip echo-run-title-screen__route-chip--support">Support</span>
                  </div>
                  <div class="echo-run-title-screen__route-links">
                    <span></span><span></span><span></span>
                  </div>
                  <div class="echo-run-title-screen__route-row">
                    <span class="echo-run-title-screen__route-chip">Encounter</span>
                    <span class="echo-run-title-screen__route-chip">Encounter</span>
                    <span class="echo-run-title-screen__route-chip">Encounter</span>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <div class="echo-run-title-screen__feature-grid">
            <article class="echo-run-title-screen__feature">
              <div class="echo-run-title-screen__feature-kicker">Draft</div>
              <h2>Assemble a temporary squad</h2>
              <p>Choose operators, build a field kit, and grow your run through one pick at a time.</p>
            </article>
            <article class="echo-run-title-screen__feature">
              <div class="echo-run-title-screen__feature-kicker">Adapt</div>
              <h2>Shape the battlefield</h2>
              <p>Stack Echo Fields, recovery choices, and team-wide training to keep the run alive.</p>
            </article>
            <article class="echo-run-title-screen__feature">
              <div class="echo-run-title-screen__feature-kicker">Climb</div>
              <h2>Push into higher strata</h2>
              <p>Route upward through encounters, pressure nodes, boss chains, and recurring milestone layers.</p>
            </article>
          </div>
        </section>
      </div>
    </div>
  `;

  const beginBtn = document.getElementById("echoRunBeginBtn");
  beginBtn?.addEventListener("click", () => {
    void beginNewEchoRun();
  });

  const resumeBtn = document.getElementById("echoRunResumeBtn");
  resumeBtn?.addEventListener("click", () => {
    void resumeEchoRun();
  });

  const backBtn = document.getElementById("echoRunTitleBackBtn");
  backBtn?.addEventListener("click", () => {
    import("./MainMenuScreen").then(({ renderMainMenu }) => {
      renderMainMenu();
    });
  });
}

export default renderEchoRunTitleScreen;
