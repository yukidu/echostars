/** Canonical rank used only by the home playlist filter; original labels stay unchanged. */
export const baseSpeakerRank = (rank: string): string =>
  rank.trim().replace(/^GAR\s*/i, '').replace(/創辦人/g, '').trim();
