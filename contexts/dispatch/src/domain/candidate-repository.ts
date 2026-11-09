import type { Candidate } from './candidate';

export interface CandidateRepository {
  /** Candidates who may receive offers today. Fed by the seed until a tailor directory context exists. */
  findActive(): Promise<Candidate[]>;
}
