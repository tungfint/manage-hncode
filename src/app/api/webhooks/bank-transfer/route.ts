import { NextResponse } from "next/server";
import {
  PaymentMethod,
  TuitionStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type BankEvent = {
  provider: string;
  reference: string;
  amount: number;
  description: string;
  rawData: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function textField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

function numberField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const number =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value.replace(/[^\d.-]/g, ""))
          : Number.NaN;

    if (Number.isFinite(number)) {
      return number;
    }
  }

  return 0;
}

function extractItems(payload: unknown) {
  const record = asRecord(payload);
  const data = record.data;
  const dataRecord = asRecord(data);

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(dataRecord.transactions)) {
    return dataRecord.transactions;
  }

  if (Array.isArray(record.transactions)) {
    return record.transactions;
  }

  return [data ?? payload];
}

function extractEvents(payload: unknown): BankEvent[] {
  return extractItems(payload)
    .map((item, index) => {
      const record = asRecord(item);
      const description = textField(record, [
        "description",
        "content",
        "addInfo",
        "memo",
        "paymentContent",
      ]);
      const amount = numberField(record, [
        "amount",
        "transferAmount",
        "creditAmount",
        "value",
      ]);
      const reference =
        textField(record, [
          "reference",
          "transactionId",
          "id",
          "orderCode",
          "paymentLinkId",
        ]) || `${description}-${amount}-${index}`;

      return {
        provider: textField(asRecord(payload), ["provider"]) || "bank_webhook",
        reference,
        amount,
        description,
        rawData: item,
      };
    })
    .filter((event) => event.description && event.amount > 0);
}

function extractChargeToken(description: string) {
  return description.match(/HNCODE[-\s:]*([a-z0-9]+)/i)?.[1] ?? null;
}

async function confirmCharge(input: BankEvent) {
  const existing = await prisma.bankTransferEvent.findUnique({
    where: { reference: input.reference },
  });

  if (existing) {
    return "duplicated";
  }

  const token = extractChargeToken(input.description);

  if (!token) {
    await prisma.bankTransferEvent.create({
      data: {
        provider: input.provider,
        reference: input.reference,
        amount: String(input.amount),
        description: input.description,
        status: "unmatched",
        rawData: input.rawData as never,
      },
    });
    return "unmatched";
  }

  const charge = await prisma.tuitionCharge.findFirst({
    where: {
      OR: [{ id: token }, { id: { endsWith: token } }],
    },
  });

  if (!charge) {
    await prisma.bankTransferEvent.create({
      data: {
        provider: input.provider,
        reference: input.reference,
        amount: String(input.amount),
        description: input.description,
        status: "unmatched",
        rawData: input.rawData as never,
      },
    });
    return "unmatched";
  }

  const paid = Number(charge.amountPaid.toString()) + input.amount;
  const due =
    Number(charge.amountDue.toString()) -
    Number(charge.discountAmount.toString());
  const status = paid >= due ? TuitionStatus.PAID : TuitionStatus.PARTIAL;

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        tuitionChargeId: charge.id,
        amount: String(input.amount),
        method: PaymentMethod.BANK_TRANSFER,
        note: `Tự động đối soát: ${input.reference}`,
      },
    }),
    prisma.tuitionCharge.update({
      where: { id: charge.id },
      data: {
        amountPaid: String(paid),
        status,
      },
    }),
    prisma.bankTransferEvent.create({
      data: {
        provider: input.provider,
        reference: input.reference,
        amount: String(input.amount),
        description: input.description,
        status: "matched",
        tuitionChargeId: charge.id,
        rawData: input.rawData as never,
      },
    }),
  ]);

  return "matched";
}

export async function POST(request: Request) {
  const secret = process.env.BANK_WEBHOOK_SECRET;
  const provided =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("secure-token") ??
    request.headers.get("x-casso-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || provided !== secret) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const payload = await request.json();
  const events = extractEvents(payload);
  let matched = 0;
  let unmatched = 0;
  let duplicated = 0;

  for (const event of events) {
    const result = await confirmCharge(event);

    if (result === "matched") {
      matched += 1;
    } else if (result === "duplicated") {
      duplicated += 1;
    } else {
      unmatched += 1;
    }
  }

  return NextResponse.json({
    success: true,
    matched,
    unmatched,
    duplicated,
  });
}
