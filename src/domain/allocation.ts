/**
 * Allocation domain helpers
 */
import { allocateEqual, allocatePercentage, allocatePortions, Centimes } from "./money";

export type AllocationMode = "EQUAL" | "PERCENTAGE" | "CUSTOM_AMOUNT" | "PORTIONS";

export interface AllocationRequest {
  mode: AllocationMode;
  totalCentimes: Centimes;
  participantIds: string[];
  // For PERCENTAGE: basis points per participant (ordered same as participantIds)
  percentages?: number[];
  // For CUSTOM_AMOUNT: exact amounts per participant
  customAmounts?: Centimes[];
  // For PORTIONS: portions per participant
  portions?: number[];
}

export function calculateAllocations(req: AllocationRequest): { userId: string; amountCentimes: Centimes; percentageBasisPoints?: number; portions?: number }[] {
  const { mode, totalCentimes, participantIds } = req;

  if (participantIds.length === 0) throw new Error("At least one participant required");

  switch (mode) {
    case "EQUAL": {
      const amounts = allocateEqual(totalCentimes, participantIds.length);
      return participantIds.map((id, i) => ({ userId: id, amountCentimes: amounts[i] }));
    }
    case "PERCENTAGE": {
      if (!req.percentages || req.percentages.length !== participantIds.length) {
        throw new Error("Percentages required for PERCENTAGE mode");
      }
      const amounts = allocatePercentage(totalCentimes, req.percentages);
      return participantIds.map((id, i) => ({
        userId: id,
        amountCentimes: amounts[i],
        percentageBasisPoints: req.percentages![i],
      }));
    }
    case "CUSTOM_AMOUNT": {
      if (!req.customAmounts || req.customAmounts.length !== participantIds.length) {
        throw new Error("Custom amounts required");
      }
      const sum = req.customAmounts.reduce((a, b) => a + b, 0);
      if (sum !== totalCentimes) {
        throw new Error(`Custom amounts sum ${sum} != total ${totalCentimes}`);
      }
      return participantIds.map((id, i) => ({ userId: id, amountCentimes: req.customAmounts![i] }));
    }
    case "PORTIONS": {
      if (!req.portions || req.portions.length !== participantIds.length) {
        throw new Error("Portions required");
      }
      const amounts = allocatePortions(totalCentimes, req.portions);
      return participantIds.map((id, i) => ({
        userId: id,
        amountCentimes: amounts[i],
        portions: req.portions![i],
      }));
    }
    default:
      throw new Error(`Unknown allocation mode: ${mode}`);
  }
}
