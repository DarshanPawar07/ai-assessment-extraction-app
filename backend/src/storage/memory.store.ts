// TODO: Implement backend/src/storage/memory.store.ts
import { Assessment } from "../types/assessment";

class MemoryStore {
  private assessments: Map<string, Assessment> = new Map();

  create(assessment: Assessment): Assessment {
    this.assessments.set(assessment.id, assessment);
    return assessment;
  }

  getById(id: string): Assessment | undefined {
    return this.assessments.get(id);
  }

  getAll(): Assessment[] {
    return Array.from(this.assessments.values());
  }

  update(
    id: string,
    updates: Partial<Assessment>
  ): Assessment | undefined {
    const existingAssessment = this.assessments.get(id);

    if (!existingAssessment) {
      return undefined;
    }

    const updatedAssessment: Assessment = {
      ...existingAssessment,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.assessments.set(id, updatedAssessment);

    return updatedAssessment;
  }

  delete(id: string): boolean {
    return this.assessments.delete(id);
  }

  clear(): void {
    this.assessments.clear();
  }
}

export const memoryStore = new MemoryStore();