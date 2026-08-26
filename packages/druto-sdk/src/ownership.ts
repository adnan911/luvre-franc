export type SellerOwnershipRequest = { marketplaceId: string; sellerId: string; origin: string };
export type OwnershipChallenge = { challengeId: string; nonce: string; message: string; walletAddress: string; expiresAt: string | Date };
export type WalletMessageSigner = (message: string) => Promise<`0x${string}`>;

export async function signOwnershipChallenge(challenge: Pick<OwnershipChallenge, "message">, signMessage: WalletMessageSigner) {
  if (!challenge.message.trim()) throw new Error("Ownership challenge message is required");
  return signMessage(challenge.message);
}

export function ownershipVerificationPayload(challenge: OwnershipChallenge, signature: `0x${string}`) {
  return { challengeId: challenge.challengeId, nonce: challenge.nonce, signature };
}
