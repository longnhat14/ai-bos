# AI BOS Backend – Sprint 1-2: Platform Core + Ticket + CRM + Kho + Invoice

Đây là khung code cho **Tuần 1 + Tuần 2** trong kế hoạch 4 tuần của AI BOS:
Auth (JWT, 2 vai trò Admin/Technician) + Database (MariaDB, có `tenant_id` mọi bảng) +
Event Bus (Redis/BullMQ + outbox pattern) + Ticket module (đầy đủ vòng đời) + Customer (CRM tối giản) +
**Kho (Warehouse)** + **Invoice (tự động sinh hóa đơn khi đóng ticket)**.

> **Lưu ý:** Ban đầu dự án dùng PostgreSQL, đã chuyển sang **MariaDB** để khớp với hosting thực tế (không hỗ trợ PostgreSQL). Yêu cầu MariaDB 10.7+ để dùng `DEFAULT (UUID())` — xem ghi chú cuối file `src/database/schema.sql` nếu hosting dùng bản cũ hơn.

> **Quan trọng về kiến trúc Event Bus:** Ban đầu mỗi module tự đăng ký `@Processor` riêng trên cùng 1 queue BullMQ — đây là lỗi, vì BullMQ hoạt động theo kiểu "competing consumers" (nhiều Processor cùng 1 queue sẽ giành nhau xử lý job, không phải cùng nhận được). Đã sửa: chỉ còn **1 `EventDispatcherProcessor` duy nhất** (`src/common/event-bus/event-dispatcher.processor.ts`), nó gọi tuần tự tới các Service thuần (`NotificationService`, `InvoiceEventHandler`...) theo loại event. Khi thêm module mới cần lắng nghe event, chỉ cần thêm 1 dòng trong `EventDispatcherProcessor`, không đụng đến code nghiệp vụ gốc.

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

> Lưu ý: `docker-compose.yml` đã tự động chạy `src/database/schema.sql` khi khởi tạo container MariaDB lần đầu (tạo bảng + seed tenant `pctech`). Nếu bạn đã chạy `docker compose up` trước đó và đổi schema, cần xóa volume cũ: `docker compose down -v` rồi `docker compose up -d` lại.
>
> **Khi deploy lên hosting thật (không dùng Docker):** import `src/database/schema.sql` trực tiếp vào MariaDB trên hosting qua phpMyAdmin/Adminer hoặc lệnh `mysql -u <user> -p ai_bos < src/database/schema.sql`.

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

### Test Kho (Warehouse) + Invoice tự động

**Tạo 1 linh kiện trong kho:**
```bash
curl -X POST http://localhost:3000/api/v1/warehouse/items \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"sku":"RAM-8GB-DDR4","name":"RAM 8GB DDR4","unit":"cai","quantityOnHand":10,"lowStockThreshold":3,"costPrice":500000,"sellPrice":700000}'
```
Lưu lại `id` linh kiện vừa tạo.

**Dùng linh kiện đó cho ticket (thay `TICKET_ID` và `ITEM_ID`):**
```bash
curl -X POST http://localhost:3000/api/v1/warehouse/tickets/TICKET_ID/parts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"inventoryItemId":"ITEM_ID","quantity":1}'
```
Kiểm tra lại tồn kho đã trừ đúng: `GET /api/v1/warehouse/items/ITEM_ID` → `quantityOnHand` phải giảm 1.

**Đóng ticket để test Invoice tự động sinh ra** (ticket cần đi qua đủ các bước trạng thái hợp lệ trước, hoặc test nhanh bằng cách báo giá rồi chuyển thẳng qua các bước):
```bash
# Chuyen qua tung buoc: diagnosing -> quoted (kem gia) -> confirmed -> repairing -> testing -> closed
curl -X PATCH http://localhost:3000/api/v1/tickets/TICKET_ID/status -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"status":"diagnosing"}'
curl -X PATCH http://localhost:3000/api/v1/tickets/TICKET_ID/quote -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"quotedPrice":900000}'
curl -X PATCH http://localhost:3000/api/v1/tickets/TICKET_ID/status -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"status":"confirmed"}'
curl -X PATCH http://localhost:3000/api/v1/tickets/TICKET_ID/status -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"status":"repairing"}'
curl -X PATCH http://localhost:3000/api/v1/tickets/TICKET_ID/status -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"status":"testing"}'
curl -X PATCH http://localhost:3000/api/v1/tickets/TICKET_ID/status -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" -d '{"status":"closed"}'
```

Sau bước cuối, xem log terminal sẽ thấy:
```
[Notification] Ticket da dong: PCT-2026-0001
Da tu dong sinh hoa don INV-2026-0001 cho ticket ...
[Notification] Hoa don INV-2026-0001 da duoc tao, tong tien: 900000
```

Kiểm tra hóa đơn vừa tạo:
```bash
curl http://localhost:3000/api/v1/invoices/by-ticket/TICKET_ID -H "Authorization: Bearer TOKEN"
```
Sẽ thấy `partsAmount` (từ linh kiện RAM đã dùng = 700000) và `laborAmount` = 900000 - 700000 = 200000.

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
