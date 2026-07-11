# AI BOS Backend – Sprint 1 (Tuần 1-2): Platform Core + Ticket + CRM

Đây là khung code khởi động cho **Tuần 1** trong kế hoạch 4 tuần của AI BOS:
Auth (JWT, 2 vai trò Admin/Technician) + Database (PostgreSQL, có `tenant_id` mọi bảng) +
Event Bus (Redis/BullMQ + outbox pattern) + Ticket module (đầy đủ vòng đời) + Customer (CRM tối giản).

Đã build thử và **không có lỗi biên dịch TypeScript**.

## 1. Yêu cầu môi trường

- Node.js 20+ (khuyến nghị dùng bản LTS)
- Docker + Docker Compose (để chạy PostgreSQL + Redis nhanh, không cần cài thủ công)

## 2. Cài đặt

```bash
# 1. Cài dependencies
npm install

# 2. Copy file môi trường và chỉnh sửa nếu cần (đặc biệt JWT_SECRET trước khi lên production)
cp .env.example .env

# 3. Bật PostgreSQL + Redis bằng Docker
docker compose up -d

# 4. Chạy ứng dụng ở chế độ dev (tự reload khi sửa code)
npm run start:dev
```

Server sẽ chạy tại `http://localhost:3000`.

> Lưu ý: `docker-compose.yml` đã tự động chạy `src/database/schema.sql` khi khởi tạo container Postgres lần đầu (tạo bảng + seed tenant `pctech`). Nếu bạn đã chạy `docker compose up` trước đó và đổi schema, cần xóa volume cũ: `docker compose down -v` rồi `docker compose up -d` lại.

## 3. Test nhanh bằng curl

**Đăng ký tài khoản Admin đầu tiên:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pctech.vn","password":"123456","fullName":"Quan Tri Vien","role":"admin"}'
```

**Đăng nhập (lấy accessToken):**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pctech.vn","password":"123456"}'
```

**Tạo khách hàng (thay `TOKEN` bằng accessToken vừa lấy):**
```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"fullName":"Nguyen Van A","phone":"0987654321","city":"Buon Ma Thuot"}'
```

**Tạo ticket (thay `CUSTOMER_ID` bằng id vừa tạo):**
```bash
curl -X POST http://localhost:3000/api/v1/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"customerId":"CUSTOMER_ID","issueDescription":"May tinh khong len nguon","deviceType":"desktop","skillRequired":["mainboard"]}'
```

Xem log terminal, bạn sẽ thấy dòng `[Notification] Ticket moi da tao: PCT-2026-0001` — đây là bằng chứng **Event Bus đang hoạt động**: TicketsService không hề gọi trực tiếp NotificationProcessor, mà chỉ phát event `ticket.created`, và Processor tự lắng nghe.

## 4. Cấu trúc thư mục

```
src/
├── app.module.ts              # Module gốc, gộp toàn bộ
├── main.ts                    # Entry point
├── database/
│   ├── schema.sql             # Schema SQL tham chiếu (dùng cho Docker init)
│   └── data-source.ts         # Cấu hình TypeORM CLI (dùng khi chạy migration thật)
├── common/
│   ├── entities/tenant-base.entity.ts   # Base entity mọi bảng kế thừa (có tenant_id)
│   ├── event-bus/             # Event Bus: EventBusService, EventLog, danh sách EventType
│   ├── guards/                # JwtAuthGuard, RolesGuard
│   └── decorators/             # @CurrentUser(), @Roles()
└── modules/
    ├── tenants/                # Quản lý tenant (chuẩn bị multi-tenant)
    ├── auth/                   # Đăng ký/đăng nhập, JWT
    ├── users/                  # User entity (Admin/Technician)
    ├── customers/              # CRM tối giản
    └── tickets/                # Module lõi: vòng đời ticket đầy đủ
```

## 5. Đã làm trong Tuần 1 (theo đúng kế hoạch)

- [x] Auth JWT, 2 vai trò Admin/Technician, RBAC cơ bản (`@Roles()` decorator)
- [x] Database schema đầy đủ `tenant_id` (multi-tenant-ready cho Giai đoạn 4)
- [x] Event Bus với outbox pattern (bảng `event_log` + BullMQ), có ví dụ Processor lắng nghe
- [x] Ticket module: tạo, gán KTV, báo giá, chuyển trạng thái theo luồng hợp lệ, đóng ticket
- [x] Customer module (CRM tối giản)
- [x] Build thành công, không lỗi TypeScript

## 6. Việc cần làm tiếp (chưa nằm trong phần đã code)

- **Roles Guard chưa được gắn vào endpoint nào** — cần quyết định endpoint nào chỉ Admin mới được gọi (ví dụ báo giá, đóng ticket) rồi thêm `@Roles(UserRole.ADMIN)` + `@UseGuards(JwtAuthGuard, RolesGuard)`
- **Chưa có migration thật** — hiện dùng `schema.sql` chạy qua Docker init cho nhanh; trước khi lên production nên chuyển sang TypeORM migration (`npm run migration:generate`) để kiểm soát thay đổi schema theo thời gian
- **Ticket code generation có race condition nhẹ** (ghi chú trong code) — nên thay bằng DB sequence riêng khi có nhiều người dùng đồng thời
- **Chưa có Frontend** — đây là phần Freelancer #1 sẽ làm song song theo kế hoạch Tuần 1
- **Chưa có test tự động** — nên bổ sung test cho luồng chuyển trạng thái ticket (`assertTransition`) vì đây là logic dễ sai nhất

## 7. Bước tiếp theo (Tuần 2 theo kế hoạch)

Module Kho (Warehouse), Invoice, Warranty, Shop, Dashboard — xem chi tiết trong `AI_BOS_4Week_Plan.md`.
