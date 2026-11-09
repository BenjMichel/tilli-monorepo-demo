import type { Candidate } from '../domain/candidate';
import type { CandidateRepository } from '../domain/candidate-repository';

export class InMemoryCandidateRepository implements CandidateRepository {
  constructor(private readonly candidates: readonly Candidate[] = []) {}

  async findActive(): Promise<Candidate[]> {
    return [...this.candidates];
  }
}
