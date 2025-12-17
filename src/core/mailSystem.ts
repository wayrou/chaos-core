// ============================================================================
// QUARTERS - MAIL SYSTEM
// ============================================================================

export type MailCategory = "personal" | "official" | "system";

export interface MailItem {
  id: string;
  category: MailCategory;
  from: string;
  subject: string;
  bodyPages: string[];
  receivedAt: number; // Timestamp or operation index
  read: boolean;
}

export interface MailState {
  inbox: MailItem[];
}

// ============================================================================
// SAMPLE MAIL DATA
// ============================================================================

const SAMPLE_MAIL: Omit<MailItem, "receivedAt" | "read">[] = [
  {
    id: "mail_welcome",
    category: "system",
    from: "Scroll Link OS",
    subject: "Welcome to Quarters",
    bodyPages: [
      "Welcome to your personal quarters, Commander.",
      "This is your downtime space. Check your mailbox for messages, rest at your bunk, review operations on the pinboard, and make yourself at home.",
      "The footlocker stores your decorative items. Place them around the room to personalize your space.",
    ],
  },
  {
    id: "mail_first_success",
    category: "personal",
    from: "Aeriss",
    subject: "Good work out there",
    bodyPages: [
      "I saw the operation report. You handled yourself well.",
      "Keep it up, and we'll make real progress.",
    ],
  },
  {
    id: "mail_first_failure",
    category: "personal",
    from: "Aeriss",
    subject: "Don't let it get to you",
    bodyPages: [
      "I heard about what happened. It's okay.",
      "Every operation teaches us something. Rest up, and we'll try again when you're ready.",
    ],
  },
  {
    id: "mail_official_1",
    category: "official",
    from: "Command",
    subject: "Operation Status Update",
    bodyPages: [
      "Your recent operations have been noted.",
      "Continue completing objectives to unlock new areas and resources.",
    ],
  },
  {
    id: "mail_personal_1",
    category: "personal",
    from: "Squad Member",
    subject: "Thanks for having my back",
    bodyPages: [
      "Just wanted to say thanks for the support out there.",
      "Couldn't have made it without the team.",
    ],
  },
  {
    id: "mail_system_tutorial",
    category: "system",
    from: "Scroll Link OS",
    subject: "Quarters Features",
    bodyPages: [
      "QUARTERS GUIDE:",
      "• Mailbox: Check for messages after operations",
      "• Bunk: Rest to receive a small buff for your next run",
      "• Pinboard: Review completed operations and failures",
      "• Footlocker: Manage and place decorative items",
      "• Sable: Interact with your companion in her corner",
    ],
  },
  {
    id: "mail_official_2",
    category: "official",
    from: "Quartermaster",
    subject: "Resource Allocation",
    bodyPages: [
      "Your resource collection has been processed.",
      "Use the Workshop to craft new equipment with your materials.",
    ],
  },
  {
    id: "mail_personal_2",
    category: "personal",
    from: "Medic",
    subject: "Health Check",
    bodyPages: [
      "I've reviewed your unit status reports.",
      "Everyone's holding up well. Keep an eye on strain levels during operations.",
    ],
  },
];

// ============================================================================
// MAIL MANAGEMENT
// ============================================================================

/**
 * Get mail state from game state (with defaults)
 */
export function getMailState(state: { quarters?: { mail?: MailState } }): MailState {
  return state.quarters?.mail ?? { inbox: [] };
}

/**
 * Add mail to inbox
 */
export function addMail(
  mailId: string,
  receivedAt: number = Date.now()
): MailItem | null {
  const template = SAMPLE_MAIL.find(m => m.id === mailId);
  if (!template) {
    console.warn(`[MAIL] Mail template not found: ${mailId}`);
    return null;
  }

  const mail: MailItem = {
    ...template,
    receivedAt,
    read: false,
  };

  // Import here to avoid circular dependency
  import("../state/gameStore").then(({ updateGameState }) => {
    updateGameState(state => {
      const quarters = state.quarters ?? {};
      const mailState = quarters.mail ?? { inbox: [] };
      
      // Check if mail already exists
      if (mailState.inbox.some(m => m.id === mailId)) {
        return state;
      }

      return {
        ...state,
        quarters: {
          ...quarters,
          mail: {
            inbox: [...mailState.inbox, mail],
          },
        },
      };
    });
  });

  return mail;
}

/**
 * Mark mail as read
 */
export function markMailRead(mailId: string): void {
  import("../state/gameStore").then(({ updateGameState }) => {
    updateGameState(state => {
      const quarters = state.quarters ?? {};
      const mailState = quarters.mail ?? { inbox: [] };
      
      return {
        ...state,
        quarters: {
          ...quarters,
          mail: {
            inbox: mailState.inbox.map(m =>
              m.id === mailId ? { ...m, read: true } : m
            ),
          },
        },
      };
    });
  });
}

/**
 * Get unread mail count
 */
export function getUnreadCount(state: { quarters?: { mail?: MailState } }): number {
  const mailState = getMailState(state);
  return mailState.inbox.filter(m => !m.read).length;
}

/**
 * Get mail by ID
 */
export function getMailById(
  state: { quarters?: { mail?: MailState } },
  mailId: string
): MailItem | null {
  const mailState = getMailState(state);
  return mailState.inbox.find(m => m.id === mailId) ?? null;
}

// ============================================================================
// MAIL TRIGGERS
// ============================================================================

/**
 * Trigger mail after operation completion
 */
export function triggerMailOnOperationComplete(success: boolean): void {
  // Add mail based on success/failure
  import("../state/gameStore").then(({ getGameState }) => {
    const currentState = getGameState();
    const mailState = getMailState(currentState);
    
    if (success) {
      // Check if first success mail already sent
      const hasFirstSuccess = mailState.inbox.some(m => m.id === "mail_first_success");
      
      if (!hasFirstSuccess) {
        addMail("mail_first_success");
      } else {
        // Random chance for other success mails
        if (Math.random() < 0.3) {
          const options = ["mail_personal_1", "mail_official_1"];
          const selected = options[Math.floor(Math.random() * options.length)];
          addMail(selected);
        }
      }
    } else {
      // Failure mail
      const hasFirstFailure = mailState.inbox.some(m => m.id === "mail_first_failure");
      
      if (!hasFirstFailure) {
        addMail("mail_first_failure");
      }
    }
  });
}

/**
 * Trigger mail on returning to base camp (optional, low chance)
 */
export function triggerMailOnBaseCampReturn(): void {
  // Small chance for random mail
  if (Math.random() < 0.1) {
    const options = ["mail_personal_2", "mail_official_2"];
    const selected = options[Math.floor(Math.random() * options.length)];
    addMail(selected);
  }
}

