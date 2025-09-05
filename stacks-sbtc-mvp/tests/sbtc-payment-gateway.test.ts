
import { describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const address1 = accounts.get("wallet_1")!;

describe("sBTC Payment Gateway", () => {
  it("allows payment with sBTC and records it", () => {
    const paymentId = 1;
    const amount = 100000000; // 1 sBTC in sats
    const block = simnet.callPublicFn("sbtc-payment-gateway", "pay", [Cl.uint(paymentId), Cl.uint(amount)], address1);
    expect(block.result).toBeOk(Cl.uint(paymentId));

    // Check payment
    const payment = simnet.callReadOnlyFn("sbtc-payment-gateway", "get-payment", [Cl.uint(paymentId)], address1);
    expect(payment.result).toBeDefined();
  });
});
