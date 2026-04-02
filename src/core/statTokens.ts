import { GameState } from "./types";

export const STAT_SHORT_LABEL = "S.T.A.T.";
export const STAT_FULL_LABEL = "Strategic Training & Advancement Tokens";
export const STAT_LONG_LABEL = `${STAT_SHORT_LABEL} (${STAT_FULL_LABEL})`;

function getDispatchSnapshot(state: GameState) {
  return {
    missionSlots: 2,
    dispatchTick: 0,
    intelDossiers: 0,
    activeIntelBonus: 0,
    squadXpBank: 0,
    activeExpeditions: [],
    completedReports: [],
    ...(state.dispatch || {}),
  };
}

export function getStatBank(state: GameState): number {
  return Math.max(0, getDispatchSnapshot(state).squadXpBank || 0);
}

export function awardStatTokens(state: GameState, amount: number): GameState {
  const safeAmount = Math.max(0, Math.floor(amount || 0));
  if (safeAmount <= 0) return state;

  const dispatch = getDispatchSnapshot(state);

  return {
    ...state,
    dispatch: {
      ...dispatch,
      squadXpBank: dispatch.squadXpBank + safeAmount,
    },
  };
}

export function spendStatTokens(state: GameState, amount: number): GameState {
  const safeAmount = Math.max(0, Math.floor(amount || 0));
  if (safeAmount <= 0) return state;

  const dispatch = getDispatchSnapshot(state);

  return {
    ...state,
    dispatch: {
      ...dispatch,
      squadXpBank: Math.max(0, dispatch.squadXpBank - safeAmount),
    },
  };
}
