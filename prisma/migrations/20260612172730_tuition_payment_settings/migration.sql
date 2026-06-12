-- CreateTable
CREATE TABLE "tuition_payment_settings" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT,
    "bankAccount" TEXT,
    "accountName" TEXT,
    "messageTemplate" TEXT NOT NULL DEFAULT 'Kính gửi phụ huynh học viên {{studentName}},

HNCode thông báo khoản học phí lớp {{classCode}} - {{className}}.
Nội dung: {{content}}
Số tiền cần thanh toán: {{amount}}
Hạn đóng: {{dueDate}}
Nội dung chuyển khoản: {{qrContent}}

Sau khi chuyển khoản, phụ huynh vui lòng gửi lại ảnh xác nhận để trung tâm đối soát.
Trân trọng.',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tuition_payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transfer_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "description" TEXT,
    "status" TEXT NOT NULL,
    "tuitionChargeId" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transfer_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_transfer_events_reference_key" ON "bank_transfer_events"("reference");

-- CreateIndex
CREATE INDEX "bank_transfer_events_tuitionChargeId_idx" ON "bank_transfer_events"("tuitionChargeId");
