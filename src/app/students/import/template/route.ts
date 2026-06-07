import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HNCode";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Mẫu nhập học viên");
  sheet.columns = [
    { header: "Họ tên học viên", key: "studentName", width: 26 },
    { header: "Ngày sinh", key: "dateOfBirth", width: 14 },
    { header: "Giới tính", key: "gender", width: 12 },
    { header: "Số điện thoại học viên", key: "studentPhone", width: 22 },
    { header: "Email học viên", key: "studentEmail", width: 28 },
    { header: "Trường học", key: "school", width: 24 },
    { header: "Lớp ở trường", key: "schoolGrade", width: 16 },
    { header: "Mã lớp học", key: "classCode", width: 18 },
    { header: "Tài khoản HNCode", key: "hncodeAccount", width: 24 },
    { header: "Trình độ đầu vào", key: "entryLevel", width: 24 },
    { header: "Trạng thái", key: "status", width: 18 },
    { header: "Họ tên phụ huynh", key: "parentName", width: 24 },
    { header: "Số điện thoại phụ huynh", key: "parentPhone", width: 24 },
    { header: "Email phụ huynh", key: "parentEmail", width: 28 },
    { header: "Quan hệ", key: "relationship", width: 14 },
    { header: "Ghi chú", key: "note", width: 32 },
  ];

  sheet.addRow({
    studentName: "Nguyễn Khánh Vy",
    dateOfBirth: "12/08/2014",
    gender: "Nữ",
    studentPhone: "0988123456",
    studentEmail: "khanhvy.import@hncode.test",
    school: "THCS Nguyễn Du",
    schoolGrade: "Lớp 6",
    classCode: "PYTHON-KIDS-K01",
    hncodeAccount: "khanhvy.import",
    entryLevel: "Cần củng cố đại số cơ bản",
    status: "Đang học",
    parentName: "Nguyễn Thị Thu",
    parentPhone: "0912123456",
    parentEmail: "thu.import@hncode.test",
    relationship: "Mẹ",
    note: "Ưu tiên nhắn Zalo cho phụ huynh",
  });

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF17215C" },
  };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const column of sheet.columns) {
    column.alignment = { vertical: "middle", wrapText: true };
  }
  sheet.getColumn(4).numFmt = "@";
  sheet.getColumn(13).numFmt = "@";

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="mau-import-hoc-vien-hncode.xlsx"',
    },
  });
}
