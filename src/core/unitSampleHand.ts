export const SAMPLE_DRAW_HAND_SIZE = 5;
export const SAMPLE_HAND_TURN_STRAIN_RELIEF = 1;

export interface UnitSampleHandState {
  unitId: string;
  deckSignature: string;
  drawPile: string[];
  discardPile: string[];
  hand: string[];
  drawCount: number;
  strain: number;
}

type ShuffleFn = <T>(items: T[]) => T[];

export function shuffleUnitSampleDeck<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getUnitSampleDeckSignature(unitId: string, deck: string[]): string {
  return `${unitId}::${deck.join("|")}`;
}

export function resetUnitSampleHandState(
  unitId: string,
  deck: string[],
  shuffleFn: ShuffleFn = shuffleUnitSampleDeck,
): UnitSampleHandState | null {
  if (deck.length === 0) {
    return null;
  }

  return {
    unitId,
    deckSignature: getUnitSampleDeckSignature(unitId, deck),
    drawPile: shuffleFn(deck),
    discardPile: [],
    hand: [],
    drawCount: 0,
    strain: 0,
  };
}

export function ensureUnitSampleHandState(
  currentState: UnitSampleHandState | null,
  unitId: string,
  deck: string[],
  shuffleFn: ShuffleFn = shuffleUnitSampleDeck,
): UnitSampleHandState | null {
  const deckSignature = getUnitSampleDeckSignature(unitId, deck);
  if (!currentState || currentState.deckSignature !== deckSignature) {
    return resetUnitSampleHandState(unitId, deck, shuffleFn);
  }
  return currentState;
}

export function drawNextUnitSampleHand(
  currentState: UnitSampleHandState | null,
  unitId: string,
  deck: string[],
  shuffleFn: ShuffleFn = shuffleUnitSampleDeck,
): UnitSampleHandState | null {
  const state = ensureUnitSampleHandState(currentState, unitId, deck, shuffleFn);
  if (!state) {
    return null;
  }

  let drawPile = [...state.drawPile];
  let discardPile = [...state.discardPile];

  if (state.hand.length > 0) {
    discardPile.push(...state.hand);
  }

  const hand: string[] = [];
  while (hand.length < SAMPLE_DRAW_HAND_SIZE && (drawPile.length > 0 || discardPile.length > 0)) {
    if (drawPile.length === 0 && discardPile.length > 0) {
      drawPile = shuffleFn(discardPile);
      discardPile = [];
    }

    const nextCard = drawPile.shift();
    if (!nextCard) {
      break;
    }
    hand.push(nextCard);
  }

  const shouldCoolStrain = state.drawCount > 0 || state.hand.length > 0 || state.discardPile.length > 0;

  return {
    ...state,
    drawPile,
    discardPile,
    hand,
    drawCount: state.drawCount + 1,
    strain: shouldCoolStrain ? Math.max(0, state.strain - SAMPLE_HAND_TURN_STRAIN_RELIEF) : state.strain,
  };
}

export function playUnitSampleHandCard(
  currentState: UnitSampleHandState | null,
  handIndex: number,
  strainDelta: number,
): UnitSampleHandState | null {
  if (!currentState || handIndex < 0 || handIndex >= currentState.hand.length) {
    return currentState;
  }

  const hand = [...currentState.hand];
  const [playedCard] = hand.splice(handIndex, 1);
  if (!playedCard) {
    return currentState;
  }

  return {
    ...currentState,
    hand,
    discardPile: [...currentState.discardPile, playedCard],
    strain: Math.max(0, currentState.strain + strainDelta),
  };
}
