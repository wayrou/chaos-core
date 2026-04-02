import type { FieldMap } from "../../field/types";
import type { Quest } from "../../quests/types";

export type DialogueEffect = {
  type: "set_flag";
  key: string;
  value: string | number | boolean;
};

export type DialogueChoice = {
  id: string;
  text: string;
  targetNodeId: string;
  condition?: string;
  tags?: string[];
  effects?: DialogueEffect[];
  metadata?: Record<string, unknown>;
};

export type DialogueNode =
  | {
      id: string;
      type: "line";
      speaker: string;
      text: string;
      mood?: string;
      portraitKey?: string;
      sceneId?: string;
      condition?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
      nextNodeId?: string;
    }
  | {
      id: string;
      type: "choice_set";
      choices: DialogueChoice[];
    }
  | {
      id: string;
      type: "effect";
      effects: DialogueEffect[];
      nextNodeId?: string;
      condition?: string;
    }
  | {
      id: string;
      type: "jump";
      targetNodeId: string;
      condition?: string;
    }
  | {
      id: string;
      type: "end";
    };

export interface ImportedDialogue {
  id: string;
  title: string;
  sceneId: string;
  entryNodeId: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  nodes: DialogueNode[];
  source?: {
    rawSource: string;
  };
}

export type ImportedFieldMap = FieldMap;
export type ImportedQuest = Quest;
