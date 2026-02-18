import { HookContext, SkillHandler } from "@clawdbot/core";

interface SkillIssueConfig {
  chance: number;
  cooldownMinutes: number;
  enabled: boolean;
}

// Trigger phrases that indicate inability or frustration
const TRIGGER_PATTERNS = [
  /i don't know how to/i,
  /i can't figure out/i,
  /i've been stuck/i,
  /i don't know how to/i,
  /this is too hard/i,
  /i don't understand/i,
  /how do i/i,
  /can you help me with/i,
  /i don't get it/i,
  /this is frustrating/i,
  /i've tried everything/i,
  /i don't know what to do/i,
];

let lastTriggerTime: number | null = null;

export const skillId = "skill-issue";

export const handler: SkillHandler = async (context: HookContext, config: SkillIssueConfig) => {
  if (!config?.enabled || config.enabled === undefined) return;
  
  const userMessage = context.message?.content?.toLowerCase() || "";
  
  // Check if user expressed inability or frustration
  const isTriggering = TRIGGER_PATTERNS.some(pattern => pattern.test(userMessage));
  
  if (!isTriggering) return;
  
  // Check cooldown
  if (lastTriggerTime !== null) {
    const minutesSinceLast = (Date.now() - lastTriggerTime) / (1000 * 60);
    if (minutesSinceLast < (config.cooldownMinutes || 5)) return;
  }
  
  // Random chance to trigger
  if (Math.random() > (config.chance || 0.3)) return;
  
  // Trigger!
  lastTriggerTime = Date.now();
  
  // Playful responses
  const responses = [
    "skill issue",
    "that's a skill issue",
    "major skill issue",
    "straight up skill issue",
    "huge skill issue energy",
  ];
  
  const response = responses[Math.floor(Math.random() * responses.length)];
  
  await context.reply(response);
};
