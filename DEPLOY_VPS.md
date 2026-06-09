# Deploy HNCode Lên VPS

Hướng dẫn nhanh cho VPS Ubuntu/Debian. Không chạy `npm run dev` trên VPS.

## 1. Yêu Cầu

- Node.js 20 LTS hoặc mới hơn
- PostgreSQL 15 hoặc mới hơn
- Git
- PM2
- Nginx hoặc Caddy để reverse proxy

## 2. Cài Gói Cơ Bản

```bash
sudo apt update
sudo apt install -y git curl postgresql postgresql-contrib nginx

# Cài Node.js 20 LTS bằng NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

sudo npm install -g pm2
```

## 3. Tạo Database

```bash
sudo -u postgres psql
```

Trong PostgreSQL:

```sql
CREATE DATABASE manage_hncode;
CREATE USER manage_hncode_user WITH ENCRYPTED PASSWORD 'doi-mat-khau-manh';
GRANT ALL PRIVILEGES ON DATABASE manage_hncode TO manage_hncode_user;
\q
```

## 4. Clone Project

```bash
cd /var/www
sudo git clone https://github.com/tungfint/manage-hncode.git
sudo chown -R $USER:$USER /var/www/manage-hncode
cd /var/www/manage-hncode
```

## 5. Cấu Hình `.env`

```bash
cp .env.example .env
nano .env
```

Ví dụ production:

```env
DATABASE_URL="postgresql://manage_hncode_user:doi-mat-khau-manh@localhost:5432/manage_hncode?schema=public"
AUTH_SECRET="tao-chuoi-bi-mat-dai-it-nhat-32-ky-tu"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_REDIRECT_URI="https://ten-mien-cua-ban.vn/login/google/callback"
NODE_ENV="production"
```

Tạo secret nhanh:

```bash
openssl rand -base64 48
```

## 6. Cài, Migrate, Build

```bash
npm ci
npm run db:generate
npm run db:deploy
npm run build
```

Nếu cần dữ liệu mẫu lần đầu:

```bash
npm run db:seed
```

Sau khi seed, đăng nhập admin mẫu và đổi mật khẩu ngay.

## 7. Chuẩn Bị Upload Folder

App lưu file đính kèm trong `public/uploads`.

```bash
mkdir -p public/uploads
chmod -R 755 public/uploads
```

Nên backup thư mục này cùng database.

## 8. Chạy Bằng PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Kiểm tra:

```bash
pm2 status
pm2 logs manage-hncode
curl -I http://localhost:3000/login
```

## 9. Cấu Hình Nginx

Tạo file:

```bash
sudo nano /etc/nginx/sites-available/manage-hncode
```

Nội dung:

```nginx
server {
    listen 80;
    server_name ten-mien-cua-ban.vn www.ten-mien-cua-ban.vn;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Bật site:

```bash
sudo ln -s /etc/nginx/sites-available/manage-hncode /etc/nginx/sites-enabled/manage-hncode
sudo nginx -t
sudo systemctl reload nginx
```

## 10. HTTPS

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ten-mien-cua-ban.vn -d www.ten-mien-cua-ban.vn
```

Sau khi bật HTTPS, nếu dùng Google Login hãy cập nhật:

```env
GOOGLE_REDIRECT_URI="https://ten-mien-cua-ban.vn/login/google/callback"
```

## 11. Cập Nhật Phiên Bản Sau Này

```bash
cd /var/www/manage-hncode
git pull origin main
npm ci
npm run db:generate
npm run db:deploy
npm run build
pm2 restart manage-hncode
```

## 12. Kiểm Tra Sau Deploy

- Mở `/login`
- Đăng nhập admin
- Mở `/dashboard`
- Kiểm tra học viên, lớp học, lịch học, điểm danh, học phí
- Upload thử một file nhỏ trong buổi học hoặc bài kiểm tra nếu dùng chức năng file
- Kiểm tra `pm2 logs manage-hncode`
