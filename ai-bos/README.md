# AI BOS Backend – Sprint 1-2 + Chat Auto-Translate + AI Dispatcher (Sprint 9)

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

### Test Warranty (tự động tạo cùng lúc với Invoice khi ticket đóng)

Sau khi đóng ticket ở bước trên, log cũng sẽ có thêm dòng:
```
Da tu dong tao bao hanh cho ticket ..., het han: ...
```

**Kiểm tra bảo hành vừa tạo (mặc định 3 tháng, đổi qua `DEFAULT_WARRANTY_MONTHS` trong `.env`):**
```bash
curl http://localhost:3000/api/v1/warranty/by-ticket/TICKET_ID -H "Authorization: Bearer TOKEN"
```

**Kiểm tra nhanh còn hạn hay không (endpoint quan trọng nhất cho nhân viên tiếp nhận):**
```bash
curl http://localhost:3000/api/v1/warranty/check/TICKET_ID -H "Authorization: Bearer TOKEN"
```
Trả về `isActive: true`, `daysRemaining: ~90`.

### Test Shop (bán hàng trực tiếp, dùng chung kho với Warehouse)

**Tạo đơn hàng** (dùng lại `ITEM_ID` linh kiện đã tạo ở phần Kho, và `CUSTOMER_ID` đã có):
```bash
curl -X POST http://localhost:3000/api/v1/shop/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"customerId":"CUSTOMER_ID","items":[{"inventoryItemId":"ITEM_ID","quantity":2}]}'
```

Kiểm tra tồn kho đã trừ **ngay lập tức** (khác với Ticket - Shop trừ kho ngay khi đặt hàng, không đợi xác nhận):
```bash
curl http://localhost:3000/api/v1/warehouse/items/ITEM_ID -H "Authorization: Bearer TOKEN"
```

**Test hoàn kho khi hủy đơn** (thay `ORDER_ID`):
```bash
curl -X PATCH http://localhost:3000/api/v1/shop/orders/ORDER_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"status":"cancelled"}'
```
Kiểm tra lại tồn kho — phải **cộng lại đúng số lượng** đã trừ trước đó.

### Test Dashboard (tổng hợp số liệu từ tất cả module trên)

```bash
curl http://localhost:3000/api/v1/dashboard/overview -H "Authorization: Bearer TOKEN"
```
Trả về: số ticket đang mở, số ticket đóng hôm nay, số linh kiện sắp hết hàng, số đơn hàng đang chờ, doanh thu hôm nay/tháng này (tính từ Invoice đã tạo).

```bash
curl http://localhost:3000/api/v1/dashboard/technician-workload -H "Authorization: Bearer TOKEN"
```
Trả về danh sách kỹ thuật viên kèm số ticket đang xử lý — dữ liệu này sẽ được **AI Dispatcher (Sprint 9)** dùng để biết ai đang rảnh/bận khi đề xuất giao việc.

### Test Chat AI Dịch tự động (CHỈ hoạt động với tenant `remoteit`)

**Bước 0 – Cấu hình API key:** thêm `ANTHROPIC_API_KEY` thật vào file `.env` (lấy tại https://console.anthropic.com/settings/keys), sau đó restart server.

**Bước 1 – Đăng ký tài khoản cho tenant RemoteIT** (chú ý thêm `tenantCode`):
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@remoteit.vn","password":"123456","fullName":"Nhan Vien Ho Tro","role":"admin","tenantCode":"remoteit"}'
```
Lấy `accessToken` (gọi là `TOKEN_REMOTEIT` bên dưới) — **token này khác với token của tenant `pctech`**, vì mỗi tenant có user riêng.

**Bước 2 – Tạo khách hàng (thuộc tenant RemoteIT):**
```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_REMOTEIT" \
  -d '{"fullName":"John Smith","phone":"+6591234567"}'
```

**Bước 3 – Tạo cuộc hội thoại, khai báo ngôn ngữ khách hàng là tiếng Anh:**
```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations \
  -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_REMOTEIT" \
  -d '{"customerId":"CUSTOMER_ID","customerLanguage":"en"}'
```
Lưu lại `id` cuộc hội thoại (gọi là `CONV_ID`).

**Bước 4 – Khách hàng nhắn tin bằng tiếng Anh:**
```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations/CONV_ID/messages \
  -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_REMOTEIT" \
  -d '{"senderType":"customer","text":"My internet connection keeps disconnecting every few minutes."}'
```

**Bước 5 – Nhân viên trả lời bằng tiếng Việt:**
```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations/CONV_ID/messages \
  -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_REMOTEIT" \
  -d '{"senderType":"staff","text":"Anh vui long kiem tra lai day cap mang xem co bi long khong."}'
```

**Bước 6 – Xem màn hình của NHÂN VIÊN (thấy cả bản gốc + bản dịch):**
```bash
curl http://localhost:3000/api/v1/chat/conversations/CONV_ID/messages/staff-view -H "Authorization: Bearer TOKEN_REMOTEIT"
```
Kết quả mong đợi: tin nhắn 1 có `originalText` tiếng Anh + `translatedText` đã dịch sang tiếng Việt; tin nhắn 2 có `originalText` tiếng Việt + `translatedText` đã dịch sang tiếng Anh.

**Bước 7 – Xem màn hình của KHÁCH HÀNG (chỉ thấy tiếng Anh, không bao giờ thấy tiếng Việt):**
```bash
curl http://localhost:3000/api/v1/chat/conversations/CONV_ID/messages/customer-view -H "Authorization: Bearer TOKEN_REMOTEIT"
```
Kết quả mong đợi: **cả 2 tin nhắn đều bằng tiếng Anh** — tin nhắn 1 là nguyên văn khách gõ, tin nhắn 2 là bản dịch từ tiếng Việt sang tiếng Anh.

**Đối chứng: test với tenant PCTech (không dịch)** — lặp lại các bước trên với `TOKEN` của `pctech` thay vì `tenantCode: "remoteit"` khi tạo conversation. Kết quả: `translatedText` sẽ **giống hệt** `originalText` (không gọi Claude API, không tốn chi phí), vì tính năng dịch chỉ bật cho RemoteIT.

**Trường hợp đặc biệt: PCTech gặp khách nước ngoài** — có thể bật dịch riêng cho đúng cuộc hội thoại đó, không ảnh hưởng đến các khách PCTech khác:
```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations \
  -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_PCTECH" \
  -d '{"customerId":"CUSTOMER_ID","customerLanguage":"en","enableAutoTranslate":true}'
```
Cuộc hội thoại này sẽ dịch bình thường dù thuộc tenant PCTech, vì `enableAutoTranslate: true` ghi đè mặc định của tenant.

### Test AI Dispatcher (Sprint 9)

**Bước 1 – Đăng ký 2 kỹ thuật viên khác nhau để so sánh điểm:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"ktv1@pctech.vn","password":"123456","fullName":"Ky Thuat Vien A","role":"technician"}'
curl -X POST http://localhost:3000/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"ktv2@pctech.vn","password":"123456","fullName":"Ky Thuat Vien B","role":"technician"}'
```
Lấy `id` của 2 user vừa tạo (nằm trong response `user.id`).

**Bước 2 – Cập nhật hồ sơ kỹ thuật viên (kỹ năng, khu vực)** — dùng token Admin:
```bash
# KTV A: gioi mainboard, o Buon Ma Thuot
curl -X PATCH http://localhost:3000/api/v1/users/TECH_A_ID/profile -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"skills":[{"skill":"mainboard","level":5}],"city":"Buon Ma Thuot"}'

# KTV B: gioi mainboard nhung it kinh nghiem hon, o tinh khac
curl -X PATCH http://localhost:3000/api/v1/users/TECH_B_ID/profile -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"skills":[{"skill":"mainboard","level":2}],"city":"Da Lat"}'
```

**Bước 3 – Tạo ticket của khách ở Buôn Ma Thuột, cần kỹ năng mainboard:**
```bash
curl -X POST http://localhost:3000/api/v1/tickets -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"customerId":"CUSTOMER_ID","issueDescription":"May khong len nguon","skillRequired":["mainboard"]}'
```
(Khách hàng `CUSTOMER_ID` cần có `city: "Buon Ma Thuot"` khi tạo ở bước Customer trước đó.)

**Bước 4 – Xem AI Dispatcher đề xuất (chế độ Manual/Semi-Auto):**
```bash
curl http://localhost:3000/api/v1/dispatcher/suggest/TICKET_ID -H "Authorization: Bearer TOKEN"
```
Kết quả mong đợi: **KTV A đứng đầu danh sách** (điểm cao hơn) vì vừa giỏi mainboard hơn (level 5 > 2) vừa cùng khu vực với khách (Buôn Ma Thuột), thấy rõ `breakdown` từng tiêu chí.

**Bước 5 – Test chế độ Auto (tự động giao luôn, không cần xác nhận):**
```bash
curl -X POST http://localhost:3000/api/v1/dispatcher/auto-assign/TICKET_ID -H "Authorization: Bearer TOKEN"
```
Kiểm tra lại ticket đã có `assignedTechnicianId` = id của KTV A:
```bash
curl http://localhost:3000/api/v1/tickets/TICKET_ID -H "Authorization: Bearer TOKEN"
```

### Test AI Dispatcher cho RemoteIT (Onsite vs Remote Engineer)

**Bước 1 – Đăng ký 1 Remote Engineer cho tenant RemoteIT:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/register -H "Content-Type: application/json" \
  -d '{"email":"remote1@remoteit.vn","password":"123456","fullName":"Remote Engineer X","role":"technician","tenantCode":"remoteit"}'
```

**Bước 2 – Cập nhật hồ sơ: đánh dấu `isRemote: true`, quốc gia Việt Nam:**
```bash
curl -X PATCH http://localhost:3000/api/v1/users/REMOTE_TECH_ID/profile -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_REMOTEIT" \
  -d '{"skills":[{"skill":"network","level":5}],"country":"VN","isRemote":true}'
```

**Bước 3 – Tạo khách hàng ở Singapore (khác quốc gia với KTV):**
```bash
curl -X POST http://localhost:3000/api/v1/customers -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_REMOTEIT" \
  -d '{"fullName":"Tan Wei Ling","phone":"+6598765432","country":"SG"}'
```

**Bước 4 – Tạo ticket cho khách Singapore, cần kỹ năng network:**
```bash
curl -X POST http://localhost:3000/api/v1/tickets -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_REMOTEIT" \
  -d '{"customerId":"CUSTOMER_SG_ID","issueDescription":"Internet keeps disconnecting","skillRequired":["network"]}'
```

**Bước 5 – Xem đề xuất:**
```bash
curl http://localhost:3000/api/v1/dispatcher/suggest/TICKET_ID -H "Authorization: Bearer TOKEN_REMOTEIT"
```
Kết quả mong đợi: Remote Engineer X **vẫn xuất hiện trong danh sách đề xuất** dù khác quốc gia với khách (VN vs SG) — vì `isRemote: true` không bị áp dụng luật "phải cùng quốc gia".

**Đối chứng:** nếu tạo thêm 1 KTV onsite (`isRemote: false`, `country: "VN"`) và thử đề xuất cho cùng ticket khách Singapore này, KTV onsite đó sẽ **không xuất hiện trong danh sách** — vì bị loại ngay từ đầu (khác quốc gia + không phải remote = không khả thi vật lý).

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
