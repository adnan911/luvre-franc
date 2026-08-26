import { describe, expect, it, vi } from "vitest";
import { ownershipVerificationPayload, signOwnershipChallenge } from "./ownership.js";

describe("SDK ownership helpers", () => {
  it("signs the exact challenge message through the wallet provider", async () => {
    const signMessage = vi.fn(async () => "0xabcdef" as `0x${string}`);
    await expect(signOwnershipChallenge({ message: "Druto seller wallet ownership verification\nNonce: abc123" }, signMessage)).resolves.toBe("0xabcdef");
    expect(signMessage).toHaveBeenCalledWith("Druto seller wallet ownership verification\nNonce: abc123");
  });

  it("builds the server verification payload from the challenge", () => {
    expect(ownershipVerificationPayload({ challengeId: "oc_1", nonce: "abc123", message: "Nonce: abc123", walletAddress: "0x1", expiresAt: new Date() }, "0xabcdef")).toEqual({ challengeId: "oc_1", nonce: "abc123", signature: "0xabcdef" });
  });
});
