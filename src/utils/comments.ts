import type { Comment } from '../types';

// Flatten descendants beneath their root without hiding nested or orphan replies.
export function commentThreads(comments: Comment[]) {
  const byId = new Map(comments.map(comment => [comment.id, comment]));
  const groups = new Map<string, Comment[]>();
  for (const comment of comments) {
    let root = comment;
    const visited = new Set([comment.id]);
    while (root.replyToId && byId.has(root.replyToId) && !visited.has(root.replyToId)) {
      visited.add(root.replyToId);
      root = byId.get(root.replyToId)!;
    }
    if (root.replyToId && visited.has(root.replyToId)) root = byId.get([...visited].sort()[0])!;
    if (!groups.has(root.id)) groups.set(root.id, []);
    if (root.id !== comment.id) groups.get(root.id)!.push(comment);
  }
  return { roots: comments.filter(comment => groups.has(comment.id)), replies: groups };
}
