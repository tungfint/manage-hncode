import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { canAccessClass } from "@/lib/data-scope";
import { prisma } from "@/lib/prisma";

type TemplateRouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: TemplateRouteContext) {
  const session = await requirePermission("score.view");
  const { id } = await context.params;
  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      courseClass: {
        include: {
          students: {
            where: { status: "ACTIVE" },
            include: { student: true },
            orderBy: { student: { fullName: "asc" } },
          },
        },
      },
    },
  });

  if (!exam) {
    return new NextResponse("Không tìm thấy bài kiểm tra", { status: 404 });
  }

  if (!(await canAccessClass(session, exam.classId, "score.view"))) {
    return new NextResponse("Không có quyền truy cập", { status: 403 });
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Nhap diem");
  sheet.columns = [
    { header: "Họ và tên", key: "fullName", width: 28 },
    { header: "Email học viên", key: "email", width: 30 },
    { header: "Tài khoản HNCode", key: "hncodeAccount", width: 24 },
    { header: "Điểm", key: "score", width: 12 },
    { header: "Nhận xét", key: "comment", width: 40 },
  ];
  sheet.getRow(1).font = { bold: true };

  exam.courseClass.students.forEach((enrollment) => {
    sheet.addRow({
      fullName: enrollment.student.fullName,
      email: enrollment.student.email ?? "",
      hncodeAccount: enrollment.student.hncodeAccount ?? "",
      score: "",
      comment: "",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `mau-nhap-diem-${exam.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
