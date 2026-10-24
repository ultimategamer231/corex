import { describe, expect, it, vi } from "vitest";
import { balanceDue, BillingError, recordPayment, type RpcClient, voidPayment } from "./billing";

const ids = {
  payment: "0b6e6c1e-6a39-4d0e-9a4f-7f0b0f1b2c3d",
  invoice: "4c9f0d3a-2b1e-4f5a-8c7d-6e5f4a3b2c1d",
};

describe("recordPayment", () => {
  it("validates input, sends big amounts as strings and maps the result", async () => {
    const rpc = vi.fn<RpcClient["rpc"]>(() =>
      Promise.resolve({
        data: [
          {
            payment_id: ids.payment,
            receipt_id: "r1",
            receipt_number: "42",
            invoice_status: "partially_paid",
          },
        ],
        error: null,
      }),
    );
    const result = await recordPayment(
      { rpc },
      {
        paymentId: ids.payment,
        invoiceId: ids.invoice,
        amountMinor: 900719925474099312n,
        currency: "LRD",
        method: "mobile_money",
      },
    );
    expect(rpc).toHaveBeenCalledWith(
      "record_payment",
      expect.objectContaining({ p_amount_minor: "900719925474099312" }),
    );
    expect(result).toEqual({
      paymentId: ids.payment,
      receiptId: "r1",
      receiptNumber: 42,
      invoiceStatus: "partially_paid",
    });
  });

  it("rejects zero amounts before calling the server", async () => {
    const rpc = vi.fn<RpcClient["rpc"]>();
    await expect(
      recordPayment(
        { rpc },
        {
          paymentId: ids.payment,
          invoiceId: ids.invoice,
          amountMinor: 0n,
          currency: "USD",
          method: "cash",
        },
      ),
    ).rejects.toThrow(/greater than zero/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("passes database refusals through as BillingError", async () => {
    const rpc = vi.fn<RpcClient["rpc"]>(() =>
      Promise.resolve({
        data: null,
        error: { message: "Payment currency USD does not match invoice currency LRD" },
      }),
    );
    await expect(
      recordPayment(
        { rpc },
        {
          paymentId: ids.payment,
          invoiceId: ids.invoice,
          amountMinor: 1n,
          currency: "USD",
          method: "cash",
        },
      ),
    ).rejects.toThrow(BillingError);
  });
});

describe("voidPayment", () => {
  it("requires a real reason (CORE-07)", async () => {
    await expect(voidPayment({ rpc: vi.fn() }, ids.payment, "  ")).rejects.toThrow(/reason/);
  });
});

describe("balanceDue", () => {
  it("is total minus posted payments, in the invoice currency", () => {
    expect(balanceDue({ currency: "LRD", total_minor: "1500000", paid_minor: "500000" })).toEqual({
      amountMinor: 1000000n,
      currency: "LRD",
    });
  });
});
