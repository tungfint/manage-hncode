# HNCode - Quản Lý Trung Tâm

Website quản lý Câu lạc bộ lập trình HNCode, xây bằng Next.js App Router, TypeScript, Prisma ORM 7 và PostgreSQL.

## Chạy Local

Yêu cầu: Node.js, npm, PostgreSQL.

```powershell
npm install
Copy-Item .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Mở `http://localhost:3000`.

Các biến môi trường chính:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="chuoi-bi-mat-du-dai"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="http://localhost:3000/login/google/callback"
```

Google Login là tùy chọn. Hệ thống chỉ cho đăng nhập Google khi email Google đã tồn tại trong bảng tài khoản nội bộ.

## Kiểm Tra Trước Deploy

```powershell
npm run typecheck
npm run lint
npm run build
npm run start -- -p 3000
```

Trong workspace hiện tại, migration đã được apply vào database local `quan_ly_trung_tam_v2`.

## Kiểm Tra Trước Khi Đẩy Git

Trước khi commit/push, nên chạy đủ:

```powershell
npm run typecheck
npm run lint
npm run build
git status
```

Không commit file `.env`, database dump, log tạm hoặc thư mục `.next`.

## Đẩy Lên GitHub

Repo hiện dùng remote `origin` trỏ tới `https://github.com/tungfint/manage-hncode.git`.

```powershell
git status
git add .
git commit -m "Hoan thien MVP quan ly HNCode"
git push origin main
```

Nếu GitHub yêu cầu đăng nhập, dùng GitHub account hoặc Personal Access Token theo hướng dẫn của Git.

## Chạy Production Trên VPS

Không chạy `npm run dev` trên VPS vì chế độ dev sẽ compile theo request và chậm hơn production.

```powershell
npm ci
npm run db:generate
npm run db:deploy
npm run build
npm run start -- -p 3000
```

Khuyến nghị đặt `NODE_ENV=production`, cấu hình reverse proxy Nginx/Caddy, bật HTTPS và restart app bằng PM2 hoặc systemd.

Xem hướng dẫn chi tiết trong `DEPLOY_VPS.md`.

## Tài Khoản Seed

Mật khẩu mặc định: `Password123!`

- Admin: `admin@trungtam.test`
- Giáo viên chính: `linh.teacher@trungtam.test`
- Giáo viên phụ: `minh.assistant@trungtam.test`
- Kế toán: `hoa.accountant@trungtam.test`
- Lễ tân: `an.reception@trungtam.test`

## Chức Năng Chính

- Đăng nhập bằng email/số điện thoại hoặc Google theo email nội bộ.
- Session JWT, RBAC theo vai trò/quyền, mỗi request đọc lại trạng thái và quyền từ database.
- Sidebar và dashboard ẩn/hiện chức năng theo quyền tài khoản.
- Quản lý tài khoản, vai trò, quyền riêng từng tài khoản và audit log.
- Quản lý học viên kèm thông tin phụ huynh/người liên hệ, nhân sự; học viên có email, lớp ở CLB, tài khoản HNCode và tài khoản đăng nhập liên kết.
- Import học viên từ Excel theo mẫu tiếng Việt, bỏ qua dòng trùng.
- Quản lý lớp học, phân công giáo viên, thêm học viên bằng chọn trực tiếp hoặc danh sách email.
- Sửa/xóa khỏi lớp, ngừng phân công giáo viên, sửa/xóa lịch cố định, hủy buổi học có xác nhận.
- Tạo lịch cố định, tự sinh buổi học sắp tới, xem lịch học và danh sách buổi học.
- Điểm danh nhanh theo buổi, ghi nội dung đã dạy, bài tập, nhận xét học viên và tải file buổi học.
- Quản lý bài kiểm tra, nhập điểm thủ công, import điểm từ Excel mẫu tiếng Việt, tải file đính kèm bài kiểm tra.
- Học phí theo luồng chọn lớp -> chọn học viên -> xem công nợ/lịch sử -> thu tiền có xác nhận.
- Cấu hình học phí trọn khóa hoặc theo buổi dự kiến/thực học.
- Cấu hình lương, tạo bảng lương theo kỳ, tính theo buổi, phụ cấp/khấu trừ và xác nhận đã thanh toán.
- Báo cáo học tập, tài chính và nhân sự cơ bản.

## Route Chính

- `/login`, `/login/google`, `/dashboard`
- `/students`, `/students/new`, `/students/import`, `/students/import/template`, `/students/[id]/edit`
- `/staff`
- `/classes`, `/classes/new`, `/classes/[id]`, `/classes/[id]/edit`
- `/schedule`, `/sessions`, `/sessions/[id]/attendance`
- `/exams`, `/exams/[id]/scores`, `/exams/[id]/scores/template`
- `/tuition`, `/payments`
- `/salary/rules`, `/payrolls`, `/payrolls/[id]`
- `/admin/users`, `/admin/roles`, `/admin/audit-logs`
- `/reports/learning`, `/reports/finance`, `/reports/staff`

## Cấu Trúc

- `prisma/schema.prisma`: database schema cho auth, RBAC, học viên, lớp, lịch, điểm danh, điểm số, học phí, lương, file đính kèm và audit.
- `prisma/seed.ts`: seed dữ liệu mẫu.
- `src/lib/permissions.ts`: danh sách quyền, vai trò và quyền mặc định.
- `src/lib/auth.ts`: helper hash mật khẩu, JWT session và kiểm tra quyền.
- `src/app/actions.ts`: server actions có kiểm tra quyền backend cho nghiệp vụ ghi dữ liệu.
- `src/components/app-shell.tsx`: layout quản trị có sidebar lọc theo quyền.
- `public/Logo-HNCode.svg`, `public/favicon-HNCode.svg`: logo và favicon HNCode gốc.

## Bảo Mật

Các page và server action đều kiểm tra quyền ở backend bằng `requirePermission`. UI chỉ hỗ trợ trải nghiệm và không phải lớp bảo vệ dữ liệu chính.
