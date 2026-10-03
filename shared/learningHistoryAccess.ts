export type LearningHistoryIdentity = {
  id?: unknown;
  email?: unknown;
  role?: unknown;
  isAdminUser?: unknown;
};

export type LearningHistoryScopeDecision =
  | { ok: true; aliases: string[]; isOwn: boolean }
  | { ok: false; status: number; error: string };

export function normalizeLearningIdentity(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

export function learningIdentityAliases(identity: LearningHistoryIdentity | null | undefined) {
  const aliases = new Set<string>();
  if (!identity) return [];
  const email = normalizeLearningIdentity(identity.email);
  const id = normalizeLearningIdentity(identity.id);
  if (email) aliases.add(email);
  if (id) aliases.add(id);
  return [...aliases];
}

// Public profile/leaderboard learning history is intentionally readable by
// visitors and members. The requested member — never the viewer/session — is
// the source of truth for the aliases used to read playback history.
export function decidePublicLearningHistoryTarget(
  requestedId: string,
  target: LearningHistoryIdentity | null | undefined
): LearningHistoryScopeDecision {
  const requested = normalizeLearningIdentity(requestedId);
  if (!requested) return { ok: false, status: 400, error: '缺少使用者識別' };
  if (!target) return { ok: false, status: 404, error: '找不到指定會員' };

  const aliases = learningIdentityAliases(target);
  if (!aliases.includes(requested)) {
    return { ok: false, status: 404, error: '找不到指定會員' };
  }

  return { ok: true, aliases, isOwn: false };
}

export function canInspectOtherLearningHistory(actor: LearningHistoryIdentity | null | undefined) {
  if (!actor) return false;
  const email = normalizeLearningIdentity(actor.email);
  return (
    email === 'yukidu@gmail.com' ||
    Boolean(actor.isAdminUser) ||
    actor.role === '獎銜審核員' ||
    actor.role === '管理員' ||
    actor.role === '超級管理員'
  );
}

// Authenticated scope is kept for destructive/self-service actions such as
// clearing history. Public GET reads use decidePublicLearningHistoryTarget().
export function decideLearningHistoryScope(
  actor: LearningHistoryIdentity | null | undefined,
  requestedId: string,
  target: LearningHistoryIdentity | null | undefined = null,
  allowAdminTarget = true
): LearningHistoryScopeDecision {
  if (!actor) return { ok: false, status: 401, error: '請先登入會員' };

  const requested = normalizeLearningIdentity(requestedId);
  if (!requested) return { ok: false, status: 400, error: '缺少使用者識別' };

  const actorAliases = learningIdentityAliases(actor);
  if (actorAliases.includes(requested)) {
    return { ok: true, aliases: actorAliases, isOwn: true };
  }

  if (!allowAdminTarget || !canInspectOtherLearningHistory(actor)) {
    return { ok: false, status: 403, error: '沒有權限查看其他會員的學習紀錄' };
  }

  if (!target) return { ok: false, status: 404, error: '找不到指定會員' };
  const targetAliases = learningIdentityAliases(target);
  if (!targetAliases.includes(requested)) {
    return { ok: false, status: 404, error: '找不到指定會員' };
  }

  return { ok: true, aliases: targetAliases, isOwn: false };
}
