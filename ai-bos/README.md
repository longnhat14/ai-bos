# AI BOS Backend – HOÀN CHỈNH: Platform Core + 7 Business Modules + 5 AI Engine + Vision + WhatsApp + Telegram + AI Chat Website + Branding

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

### Test AI Pricing (Sprint 10)

**Bước 1 – Tạo bảng giá công sửa theo kỹ năng:**
```bash
curl -X POST http://localhost:3000/api/v1/pricing/catalog -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"skillCode":"mainboard","description":"Sua loi mainboard","laborPrice":300000}'
curl -X POST http://localhost:3000/api/v1/pricing/catalog -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"skillCode":"data-recovery","description":"Cuu du lieu o cung/SSD","laborPrice":500000}'
```

**Bước 2 – Tạo ticket cần cả 2 kỹ năng trên:**
```bash
curl -X POST http://localhost:3000/api/v1/tickets -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"customerId":"CUSTOMER_ID","issueDescription":"May khong len nguon, nghi ngo mat du lieu","skillRequired":["mainboard","data-recovery"]}'
```

**Bước 3 – (Tùy chọn) Dùng thêm linh kiện cho ticket** (dùng lại `ITEM_ID` RAM đã tạo ở phần Kho):
```bash
curl -X POST http://localhost:3000/api/v1/warehouse/tickets/TICKET_ID/parts -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"inventoryItemId":"ITEM_ID","quantity":1}'
```

**Bước 4 – Xem AI Pricing đề xuất báo giá:**
```bash
curl http://localhost:3000/api/v1/pricing/suggest/TICKET_ID -H "Authorization: Bearer TOKEN"
```
Kết quả mong đợi: `laborTotal = 800000` (300.000 + 500.000), `partsAmount = 700000` (nếu đã làm Bước 3), `suggestedTotal = 1500000`, `missingSkills: []`.

**Test trường hợp thiếu giá:** tạo ticket với `skillRequired: ["network"]` (chưa có trong bảng giá) — `missingSkills` sẽ trả về `["network"]` và `laborTotal` không tính phần này, để nhân viên biết cần tự bổ sung giá thủ công thay vì tin vào con số thiếu.

**Áp dụng báo giá vào ticket** (nhân viên xác nhận, không tự động):
```bash
curl -X PATCH http://localhost:3000/api/v1/tickets/TICKET_ID/quote -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"quotedPrice":1500000}'
```

### Test AI Diagnostic (Sprint 11)

**Cần `ANTHROPIC_API_KEY` thật trong `.env`** (đã cấu hình từ phần Chat Auto-Translate).

**Tạo ticket với triệu chứng cụ thể:**
```bash
curl -X POST http://localhost:3000/api/v1/tickets -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"customerId":"CUSTOMER_ID","issueDescription":"May tinh de ban bat nguon nhung khong len man hinh, quat chay binh thuong, co 3 tieng beep lien tuc","deviceType":"desktop"}'
```

**Gọi AI Diagnostic:**
```bash
curl http://localhost:3000/api/v1/diagnostic/TICKET_ID -H "Authorization: Bearer TOKEN"
```

Kết quả mong đợi: `probableCauses` là mảng gồm vài nguyên nhân (vd RAM lỗi tiếp xúc, mainboard lỗi...) kèm `probability` (tổng ~100) và `suggestedAction`, cùng `recommendedPartsToPrepare` gợi ý linh kiện nên mang theo.

**Lưu ý quan trọng:** đây chỉ là **gợi ý xác suất để kỹ thuật viên chuẩn bị trước linh kiện**, không phải kết luận chẩn đoán cuối cùng — trường `note` trong response luôn nhắc lại điều này.

### Test AI Knowledge (Sprint 11) — và kiểm chứng nó nâng cấp AI Diagnostic

**Ghi chú thiết kế quan trọng:** kế hoạch ban đầu dự định dùng Vector DB (pgvector) để tìm kiếm ngữ nghĩa, nhưng sau khi chuyển sang MariaDB (theo hosting thực tế) và theo đúng nguyên tắc "không xây trước cho quy mô chưa có" đã thống nhất, Sprint này dùng **tìm kiếm theo từ khóa** (đơn giản, đủ dùng cho quy mô SOP của 1 tiệm sửa chữa). Xem ghi chú chi tiết trong `knowledge-entry.entity.ts`.

**Bước 1 – Tạo 1 SOP thật của PCTech (khác với kiến thức chung mà Claude vốn đã biết):**
```bash
curl -X POST http://localhost:3000/api/v1/knowledge -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"title":"Beep 3 tieng lien tuc - Quy trinh PCTech","content":"Theo kinh nghiem thuc te tai PCTech, may bat nguon co 3 tieng beep lien tuc tren 90% la do RAM long chan cam hoac oxy hoa chan tiep xuc, KHONG PHAI loi mainboard nhu nhieu noi khac hay chan doan. Quy trinh chuan cua PCTech: 1) Thao RAM ra, ve sinh chan tiep xuc bang gom tay hoac dung dich chuyen dung. 2) Cam lai chac chan. 3) Neu van beep, thu doi khe cam RAM khac. 4) Chi khi da thu ca 2 buoc tren van loi moi nghi den mainboard.","category":"mainboard","tags":["beep","RAM","khong len nguon","3 tieng"]}'
```

**Bước 2 – Test tìm kiếm trực tiếp (không qua AI):**
```bash
curl "http://localhost:3000/api/v1/knowledge/search?q=beep%203%20tieng%20khong%20len%20nguon" -H "Authorization: Bearer TOKEN"
```
Phải trả về đúng SOP vừa tạo.

**Bước 3 – Tạo ticket với triệu chứng tương tự, rồi gọi lại AI Diagnostic:**
```bash
curl -X POST http://localhost:3000/api/v1/tickets -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"customerId":"CUSTOMER_ID","issueDescription":"May tinh bat nguon co 3 tieng beep lien tuc, khong len man hinh","deviceType":"desktop"}'

curl http://localhost:3000/api/v1/diagnostic/TICKET_ID -H "Authorization: Bearer TOKEN"
```

**Kết quả mong đợi (đây là điểm quan trọng nhất để kiểm chứng):**
- Trường `matchedKnowledgeEntries` phải chứa `"Beep 3 tieng lien tuc - Quy trinh PCTech"` — chứng minh RAG đã tìm đúng SOP
- `probableCauses` giờ sẽ **ưu tiên nguyên nhân RAM lỏng chân cắm/oxy hóa** (đúng theo SOP riêng của PCTech) thay vì liệt kê chung chung nhiều khả năng ngang nhau như trước khi có Knowledge Base

### Test Cache chính xác + Xác nhận chẩn đoán (tiết kiệm chi phí + tự nuôi Knowledge Base)

**Gọi lại y hệt ticket vừa chẩn đoán ở trên (dùng lại `TICKET_ID`):**
```bash
curl http://localhost:3000/api/v1/diagnostic/TICKET_ID -H "Authorization: Bearer TOKEN"
```
Kết quả mong đợi: `fromCache: true` — **không gọi Claude API lần này**, trả về ngay lập tức từ cache. Kiểm tra log server sẽ thấy dòng `Cache hit cho ticket ... (da dung lai lan thu 1)`.

**Xác nhận nguyên nhân đúng thực tế** (giả sử nguyên nhân số 0 trong `probableCauses` là đúng sau khi kỹ thuật viên kiểm tra):
```bash
curl -X POST http://localhost:3000/api/v1/diagnostic/TICKET_ID/confirm -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"confirmedCauseIndex":0,"actualFindingNote":"Da kiem tra, dung la RAM long chan, ve sinh xong may len binh thuong"}'
```
Kết quả mong đợi: trả về `knowledgeEntryId` — kiểm tra lại bằng:
```bash
curl http://localhost:3000/api/v1/knowledge -H "Authorization: Bearer TOKEN"
```
Sẽ thấy 1 mục Knowledge Base **mới tự động được tạo**, ghi lại đúng nguyên nhân đã xác nhận — dữ liệu này sẽ giúp các ticket có triệu chứng **tương tự nhưng không giống hệt** trong tương lai được chẩn đoán chính xác hơn qua RAG, thay vì phải dựa vào cache "đoán mò".

### Test Upload ảnh + AI Diagnostic đọc hình ảnh (Claude Vision)

**Mới bổ sung:** trước đây hệ thống chưa có chức năng upload file thật (chỉ có trong `schema.sql` tham khảo). Giờ đã code đầy đủ: upload ảnh → lưu vào `uploads/tickets/` trên server → AI Diagnostic tự động "nhìn" ảnh khi chẩn đoán (không cần OCR riêng, Claude đọc trực tiếp).

**Bước 1 – Upload 1 ảnh cho ticket** (dùng `curl -F` để gửi multipart/form-data, thay `TICKET_ID` và đường dẫn ảnh thật trên máy bạn):
```bash
curl -X POST http://localhost:3000/api/v1/tickets/TICKET_ID/attachments \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@C:\duong\dan\anh_loi.jpg"
```
Kết quả trả về có `id`, `fileName`, `filePath` — file đã được lưu vào thư mục `uploads/tickets/` trong project.

**Bước 2 – Kiểm tra danh sách ảnh đã đính kèm:**
```bash
curl http://localhost:3000/api/v1/tickets/TICKET_ID/attachments -H "Authorization: Bearer TOKEN"
```

**Bước 3 – Gọi AI Diagnostic — giờ sẽ tự động đọc luôn ảnh vừa upload:**
```bash
curl http://localhost:3000/api/v1/diagnostic/TICKET_ID -H "Authorization: Bearer TOKEN"
```
Kết quả mong đợi: `imagesAnalyzed: 1`, và nếu ảnh có nội dung quan sát được (màn hình lỗi, linh kiện cháy, dây cắm lỏng...), `probableCauses` sẽ phản ánh những gì AI "nhìn thấy" trong ảnh, không chỉ dựa vào mô tả chữ.

**Giới hạn hiện tại cần biết:**
- Chỉ nhận `image/jpeg`, `image/png`, `image/webp`, `image/gif`, và `application/pdf` (PDF chưa được AI Diagnostic đọc, chỉ lưu trữ) — giới hạn dung lượng **10MB/file**
- File lưu **trực tiếp trên ổ đĩa server** (thư mục `uploads/`, đã thêm vào `.gitignore` để không đẩy nhầm lên GitHub) — khi mở rộng SaaS đa tenant thật sự, nên chuyển sang S3-compatible storage, chỉ cần sửa `AttachmentsService`, không đổi API
- Cache chính xác (Sprint trước) giờ tính **cả ảnh đính kèm** vào key — nếu thêm ảnh mới cho cùng 1 ticket, cache cũ sẽ không áp dụng nữa (đúng ý, vì có thêm dữ liệu mới cần chẩn đoán lại)

### Test AI Sales (rule-based, không gọi Claude API)

**Bước 1 – Tạo linh kiện thêm để làm add-on** (ngoài RAM đã có):
```bash
curl -X POST http://localhost:3000/api/v1/warehouse/items -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"sku":"WIN11-LICENSE","name":"Ban quyen Windows 11","unit":"license","quantityOnHand":50,"costPrice":1000000,"sellPrice":1500000}'
curl -X POST http://localhost:3000/api/v1/warehouse/items -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"sku":"ANTIVIRUS-1Y","name":"Antivirus ban quyen 1 nam","unit":"license","quantityOnHand":50,"costPrice":150000,"sellPrice":250000}'
```

**Bước 2 – Tạo rule: mua RAM thì gợi ý thêm Windows + Antivirus + dịch vụ vệ sinh:**
```bash
curl -X POST http://localhost:3000/api/v1/sales/rules -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"triggerType":"product_sku","triggerValue":"RAM-8GB-DDR4","suggestedProductSkus":["WIN11-LICENSE","ANTIVIRUS-1Y"],"suggestedServiceNote":"Ve sinh may dinh ky sau khi nang cap RAM"}'
```

**Bước 3 – Tạo đơn hàng mua RAM, rồi xem gợi ý add-on:**
```bash
curl -X POST http://localhost:3000/api/v1/shop/orders -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"customerId":"CUSTOMER_ID","items":[{"inventoryItemId":"RAM_ITEM_ID","quantity":1}]}'

curl http://localhost:3000/api/v1/sales/suggest/order/ORDER_ID -H "Authorization: Bearer TOKEN"
```
Kết quả mong đợi: gợi ý gồm **Windows 11 License**, **Antivirus 1 năm** (kèm giá bán thật từ Kho), và ghi chú dịch vụ "Vệ sinh máy định kỳ".

**Test tương tự cho Ticket** (tạo rule với `triggerType: "skill_code"`, `triggerValue: "mainboard"`), rồi gọi `GET /sales/suggest/ticket/:ticketId`.

### Cài đặt WhatsApp Business API (kênh chính cho khách RemoteIT: Anh, Canada, Úc, New Zealand, Mỹ)

**Bước 1 – Tạo Meta App:**
1. Vào https://developers.facebook.com/apps → Tạo App mới, loại "Business"
2. Thêm sản phẩm **WhatsApp** vào app
3. Trong mục WhatsApp → API Setup, lấy **Phone Number ID** (số test miễn phí Meta cấp sẵn để dùng thử) và **Temporary Access Token** (hết hạn 24h — cần đổi sang System User Token vĩnh viễn trước khi dùng thật)
4. Vào App Settings → Basic, lấy **App Secret**

**Bước 2 – Cấu hình `.env`:**
```
WHATSAPP_PHONE_NUMBER_ID=<phone_number_id_lay_o_buoc_1>
WHATSAPP_ACCESS_TOKEN=<access_token_lay_o_buoc_1>
WHATSAPP_APP_SECRET=<app_secret_lay_o_buoc_1>
WHATSAPP_WEBHOOK_VERIFY_TOKEN=<tu_dat_1_chuoi_bat_ky_vd_"aibos-verify-2026">
WHATSAPP_TENANT_CODE=remoteit
```

**Bước 3 – Đăng ký Webhook với Meta** (cần server có domain public, dùng `ngrok` khi test local):
```powershell
ngrok http 3000
```
Lấy URL ngrok (dạng `https://xxxx.ngrok-free.app`), vào Meta App → WhatsApp → Configuration → Webhook, điền:
- **Callback URL**: `https://xxxx.ngrok-free.app/webhooks/whatsapp`
- **Verify Token**: đúng giá trị đã đặt trong `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- Subscribe vào field **messages**

Meta sẽ gọi thử `GET` để xác thực — nếu thấy log `WhatsApp webhook da xac thuc thanh cong voi Meta` là thành công.

**Bước 4 – Test nhận tin nhắn thật:** dùng chính điện thoại của bạn, thêm số test WhatsApp Meta cấp vào danh bạ, nhắn tin bất kỳ (vd "Hello, my internet is not working"). Kiểm tra log server sẽ thấy:
```
Tu dong tao khach hang moi tu WhatsApp: <so_dien_thoai>
Da xu ly tin nhan WhatsApp tu <so_dien_thoai>: "Hello, my internet is not working"
```

**Bước 5 – Kiểm tra hội thoại đã tự động tạo:**
```bash
curl http://localhost:3000/api/v1/customers -H "Authorization: Bearer TOKEN_REMOTEIT"
```
Sẽ thấy khách hàng mới tự động tạo từ số điện thoại WhatsApp.

**Bước 6 – Nhân viên trả lời bằng tiếng Việt, kiểm tra khách nhận được bản tiếng Anh THẬT trên điện thoại:**
```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations/CONV_ID/messages -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN_REMOTEIT" \
  -d '{"senderType":"staff","text":"Vui long kiem tra lai modem va khoi dong lai router."}'
```
Kết quả mong đợi: **điện thoại thật của bạn nhận được tin nhắn WhatsApp bằng tiếng Anh**, đã dịch tự động — đây là bằng chứng toàn bộ luồng end-to-end hoạt động thật, không phải mô phỏng.

**Lưu ý quan trọng:**
- Số điện thoại test của Meta **chỉ nhắn được tới 5 số đã thêm vào danh sách "Recipients"** trong Meta App Dashboard — cần thêm số điện thoại thật của bạn vào đó trước khi test
- Trước khi dùng thật cho khách hàng thật, cần **đăng ký số điện thoại doanh nghiệp thật** (không dùng số test của Meta) và chuyển Access Token sang loại vĩnh viễn (System User Token)
- Endpoint webhook (`/webhooks/whatsapp`) **không yêu cầu JWT** vì Meta gọi từ ngoài — bảo mật dựa vào xác thực chữ ký `X-Hub-Signature-256`, đã code sẵn trong `whatsapp-webhook.controller.ts`

### Cài đặt Telegram Bot (kênh nội bộ: quản trị, kỹ thuật viên, giám đốc)

**Bước 1 – Tạo Bot với @BotFather trên Telegram:**
1. Mở Telegram, tìm và chat với `@BotFather`
2. Gõ `/newbot`, đặt tên và username cho bot (username phải kết thúc bằng `bot`, vd `aibos_pctech_bot`)
3. BotFather trả về **Bot Token** dạng `123456:ABC-DEF...`

**Bước 2 – Cấu hình `.env`:**
```
TELEGRAM_BOT_TOKEN=<token_lay_o_buoc_1>
TELEGRAM_WEBHOOK_SECRET=<tu_dat_1_chuoi_bat_ky>
```

**Bước 3 – Đăng ký Webhook với Telegram** (dùng `ngrok` như phần WhatsApp, hoặc dùng chung ngrok đang chạy nếu cùng port):
```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://xxxx.ngrok-free.app/webhooks/telegram","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```
Kết quả mong đợi: `{"ok":true,"result":true,"description":"Webhook was set"}`

**Bước 4 – Nhắn bất kỳ tin nhắn nào cho Bot của bạn trên Telegram** (tìm đúng username bot đã tạo, bấm Start). Bot sẽ trả lời:
```
👋 Chào bạn! Chat ID của bạn là: 123456789
Vui lòng đăng nhập vào hệ thống AI BOS và liên kết Telegram bằng ID này trước khi có thể sử dụng lệnh.
```

**Bước 5 – Liên kết Chat ID với tài khoản (gọi API có JWT):**
```bash
curl -X POST http://localhost:3000/api/v1/telegram/link -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"telegramChatId":"123456789"}'
```

**Bước 6 – Test lệnh thật qua Telegram** — nhắn cho Bot các câu:
- `doanh thu hôm nay` → Bot trả lời doanh thu hôm nay + tháng này (lấy từ Dashboard thật)
- `ticket đang mở` → số ticket đang mở + đã đóng hôm nay
- `tồn kho thấp` → danh sách linh kiện sắp hết hàng

**Lưu ý quan trọng:**
- Rule-based, **không gọi Claude API** cho các lệnh trên — nhanh, không tốn chi phí, đúng nguyên tắc đã áp dụng cho AI Sales
- Chỉ Chat ID **đã liên kết** (qua Bước 5) mới nhận được phản hồi lệnh thật — Chat ID lạ chỉ nhận được hướng dẫn liên kết, không truy vấn được dữ liệu
- Có thể mở rộng thêm lệnh mới dễ dàng — chỉ cần thêm điều kiện trong `telegram-command.service.ts`, không đụng code module khác

### AI Chat Website (tư vấn khách hàng + kiểm tra kho thật + tạo ticket có xác nhận)

**Cần `ANTHROPIC_API_KEY` thật trong `.env`** (đã cấu hình từ trước).

**Ví dụ giao diện frontend có nút camera** (đúng yêu cầu của bạn — dùng thuộc tính HTML5 chuẩn, không cần thư viện camera riêng):
```html
<form id="chatForm">
  <input type="text" id="messageInput" placeholder="Nhập tin nhắn..." />

  <!-- Nut may camera: capture="environment" tu dong mo CAMERA SAU cua dien thoai -->
  <label for="cameraInput">📷</label>
  <input type="file" id="cameraInput" accept="image/*" capture="environment" hidden />

  <button type="submit">Gửi</button>
</form>

<script>
async function sendMessage(sessionId, text, imageFile, tenantCode) {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('tenantCode', tenantCode);
  if (sessionId) formData.append('sessionId', sessionId);
  if (imageFile) formData.append('image', imageFile);

  const res = await fetch('http://localhost:3000/api/v1/public/webchat/messages', {
    method: 'POST',
    body: formData, // KHONG set Content-Type thu cong - browser tu dat multipart boundary dung
  });
  return res.json();
}
</script>
```

Trên điện thoại, bấm vào 📷 sẽ **mở thẳng camera sau** (không phải thư viện ảnh) nhờ `capture="environment"` — không cần code WebRTC/`getUserMedia` phức tạp.

**Test bằng curl (mô phỏng gửi tin nhắn kèm ảnh):**

**Bước 1 – Khách hỏi về sản phẩm (AI tự tra kho thật):**
```bash
curl -X POST http://localhost:3000/api/v1/public/webchat/messages \
  -F "text=Shop con RAM 8GB khong, gia bao nhieu?" \
  -F "tenantCode=pctech"
```
Kết quả mong đợi: AI trả lời dựa trên dữ liệu Kho thật (đã tạo ở phần test Warehouse trước đó) — lưu lại `sessionId` trả về để dùng tiếp.

**Bước 2 – Khách yêu cầu sửa máy, gửi kèm ảnh lỗi:**
```bash
curl -X POST http://localhost:3000/api/v1/public/webchat/messages \
  -F "text=May tinh cua toi bi loi man hinh nhu the nay" \
  -F "tenantCode=pctech" \
  -F "sessionId=SESSION_ID_TU_BUOC_1" \
  -F "image=@C:\duong\dan\anh_loi.jpg"
```
AI sẽ phân tích ảnh (Claude Vision) và hỏi thêm thông tin (tên, số điện thoại) trước khi đề xuất tạo ticket.

**Bước 3 – Khách cung cấp thông tin + xác nhận tạo ticket:**
```bash
curl -X POST http://localhost:3000/api/v1/public/webchat/messages \
  -F "text=Ten toi la Nguyen Van G, so dien thoai 0988776655. Dong y tao ticket." \
  -F "tenantCode=pctech" \
  -F "sessionId=SESSION_ID_TU_BUOC_1"
```
Kết quả mong đợi: response có `createdTicketId` khác `null` — kiểm tra lại:
```bash
curl http://localhost:3000/api/v1/tickets/CREATED_TICKET_ID -H "Authorization: Bearer TOKEN"
```

**Xem lịch sử hội thoại:**
```bash
curl http://localhost:3000/api/v1/public/webchat/sessions/SESSION_ID/history
```

**Nguyên tắc quan trọng đã áp dụng:**
- AI **không bao giờ tự bịa giá/tồn kho** — luôn gọi tool `check_inventory` tra dữ liệu thật
- AI **không tự ý tạo ticket** — phải hỏi thông tin + chờ khách xác nhận rõ ràng trước khi gọi tool `create_ticket`, đúng nguyên tắc "AI đề xuất, có xác nhận" xuyên suốt dự án
- Endpoint **public, không cần JWT** vì phục vụ khách vãng lai chưa đăng nhập — Sprint sau nên bổ sung rate-limit/CAPTCHA để chống spam trước khi dùng thật

### Cài đặt Logo thương hiệu (Settings/Branding)

**Bước 1 – Admin upload logo** (cần đăng nhập, dùng `TOKEN` như các API khác):
```bash
curl -X PATCH http://localhost:3000/api/v1/settings/branding/logo -H "Authorization: Bearer TOKEN" \
  -F "logo=@C:\duong\dan\logo_pctech.png"
```
Kết quả trả về `logoUrl` (vd `/uploads/branding/xxxx.png`).

**Bước 2 – Xem logo qua trình duyệt** (không cần đăng nhập, vì file logo serve công khai):
```
http://localhost:3000/uploads/branding/xxxx.png
```

**Bước 3 – Widget chat lấy logo tự động theo `tenantCode` (endpoint public, khách vãng lai dùng được):**
```bash
curl "http://localhost:3000/api/v1/public/webchat/branding?tenantCode=pctech"
```
Kết quả: `{ "logoUrl": "/uploads/branding/xxxx.png", "name": "PCTech Computer Repair" }`

**Ví dụ frontend hiển thị logo trên màn hình chat:**
```html
<div id="chatHeader">
  <img id="brandLogo" src="" alt="Logo" />
  <span id="brandName"></span>
</div>
<script>
async function loadBranding(tenantCode) {
  const res = await fetch(`http://localhost:3000/api/v1/public/webchat/branding?tenantCode=${tenantCode}`);
  const data = await res.json();
  if (data.logoUrl) {
    document.getElementById('brandLogo').src = `http://localhost:3000${data.logoUrl}`;
  }
  document.getElementById('brandName').textContent = data.name;
}
</script>
```

**Lưu ý bảo mật quan trọng:** chỉ đúng 1 thư mục `uploads/branding/` được serve công khai qua URL — các thư mục khác (`uploads/tickets`, `uploads/webchat` chứa ảnh lỗi máy/thông tin khách hàng) **không** được serve tĩnh, tránh lộ dữ liệu nhạy cảm ra internet.

### API giám sát/can thiệp AI Chat Website (dành cho nhân viên — chỉ API, chưa có giao diện)

**Bối cảnh:** khi khách chat với AI Chat Website, nhân viên hiện chưa có giao diện để "nhìn thấy". Các API dưới đây chuẩn bị sẵn logic, để sau này Admin Frontend chỉ cần "vẽ giao diện lên trên".

**Bước 1 – Xem danh sách tất cả phiên chat đang có:**
```bash
curl http://localhost:3000/api/v1/webchat/sessions -H "Authorization: Bearer TOKEN"
```

**Bước 2 – Xem chi tiết 1 phiên (giống endpoint public nhưng yêu cầu đăng nhập):**
```bash
curl http://localhost:3000/api/v1/webchat/sessions/SESSION_ID -H "Authorization: Bearer TOKEN"
```

**Bước 3 – Nhân viên "giành quyền" từ AI** (dùng khi thấy AI trả lời sai hoặc khách muốn nói chuyện với người thật):
```bash
curl -X POST http://localhost:3000/api/v1/webchat/sessions/SESSION_ID/takeover -H "Authorization: Bearer TOKEN"
```
Từ giờ, nếu khách tiếp tục nhắn tin qua endpoint public (`/public/webchat/messages`), AI **sẽ không tự động trả lời nữa** — response trả về `awaitingStaff: true`.

**Bước 4 – Nhân viên tự gõ tin nhắn trả lời khách:**
```bash
curl -X POST http://localhost:3000/api/v1/webchat/sessions/SESSION_ID/reply -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"text":"Chao ban, minh la nhan vien ho tro, minh se giup ban ngay day."}'
```

**Bước 5 – Trả quyền lại cho AI khi xong việc:**
```bash
curl -X POST http://localhost:3000/api/v1/webchat/sessions/SESSION_ID/release -H "Authorization: Bearer TOKEN"
```

### Tự động cảnh báo Telegram nếu nhân viên không phản hồi trong 15 giây

**Cơ chế:** khi nhân viên đã `takeover` 1 phiên, nếu khách nhắn tiếp mà sau **15 giây** chưa có ai trả lời, hệ thống tự động gửi cảnh báo qua Telegram (dùng BullMQ delayed job).

**Điều kiện cần trước khi test:** đã cấu hình `TELEGRAM_BOT_TOKEN` và **đã liên kết tài khoản** (`POST /api/v1/telegram/link`) như hướng dẫn ở phần Telegram phía trên.

**Test:**
1. Thực hiện lại Bước 3-4 ở mục "API giám sát webchat" phía trên (takeover + khách gửi tin nhắn)
2. **Không gọi** `POST /reply` trong vòng 15 giây
3. Kiểm tra điện thoại Telegram của bạn — sẽ nhận được tin nhắn:
```
⚠️ Khách đang chờ phản hồi!

Phiên chat: xxxxx
Tin nhắn khách: "..."

Đã quá 15 giây chưa có ai trả lời. Vui lòng vào hệ thống xử lý ngay.
```

**Bonus — trả lời trực tiếp từ Telegram (không cần gọi API `/reply` thủ công):**
Sau khi nhận cảnh báo, chỉ cần **gõ thẳng câu trả lời vào Telegram** (không cần lệnh đặc biệt) — hệ thống tự động nhận diện đây là phiên đang chờ bạn xử lý, chuyển tin nhắn thành câu trả lời gửi cho khách trên webchat, và xác nhận lại:
```
✅ Đã gửi trả lời cho khách (phiên xxxxx).
```

**Lưu ý quan trọng:**
- Nếu phiên chưa gán `assignedStaffId` cụ thể, cảnh báo sẽ gửi cho **tất cả** nhân viên đã liên kết Telegram của tenant đó

### Xử lý nhiều khách hàng nhắn tin CÙNG LÚC (đa tenant + đa phiên)

**Đa tenant (PCTech + RemoteIT):** không cần làm gì thêm — mọi bảng đã lọc theo `tenantId` từ đầu dự án, cảnh báo Telegram của PCTech chỉ đến nhân viên PCTech, không lẫn với RemoteIT.

**Đa phiên cùng 1 nhân viên (đã sửa lỗi thiết kế quan trọng):** trước đây hệ thống **đoán** "phiên gần nhất" khi nhân viên trả lời trên Telegram — rủi ro gửi nhầm cho khách khác khi xử lý nhiều người cùng lúc. Đã thay bằng cơ chế **"phiên đang focus"** + **snapshot đánh số cố định** qua 2 lệnh:
- `/ds` — xem danh sách khách đang phụ trách, đánh số 1, 2, 3...
- `/s <số>` — chọn khách theo số để trả lời tiếp theo (vd: `/s 2`)

**Điểm quan trọng nhất — chống lỗi khi có khách MỚI chen vào giữa `/ds` và `/s`:** số thứ tự được **"chụp ảnh" cố định** ngay tại thời điểm gõ `/ds`, lưu lại trong hệ thống — **không** tính lại theo thời gian thực. Nếu có khách mới nhắn tin sau khi bạn đã xem `/ds`, khách đó **không** làm xáo trộn số 1, 2, 3 đã chốt, chỉ xuất hiện khi bạn gõ `/ds` lại lần nữa.

**Test kịch bản đúng tình huống bạn nêu (khách mới chen vào giữa 2 lệnh):**

**Bước 1 – Tạo 2 phiên webchat (2 khách ban đầu):**
```bash
curl -X POST http://localhost:3000/api/v1/public/webchat/sessions -H "Content-Type: application/json" -d '{"tenantCode":"pctech"}'
# Lap lai lan 2, duoc SESSION_ID_1 va SESSION_ID_2
```

**Bước 2 – Nhân viên nhận cả 2 phiên:**
```bash
curl -X POST http://localhost:3000/api/v1/webchat/sessions/SESSION_ID_1/takeover -H "Authorization: Bearer TOKEN"
curl -X POST http://localhost:3000/api/v1/webchat/sessions/SESSION_ID_2/takeover -H "Authorization: Bearer TOKEN"
```

**Bước 3 – Trên Telegram, gõ lệnh xem danh sách (chốt snapshot tại đây):**
```
/ds
```
Bot trả lời:
```
📋 Các khách bạn đang phụ trách
1. Khách (cập nhật ...)
2. Khách (cập nhật ...)

Dùng lệnh /s <số> để chọn khách muốn trả lời tiếp theo (vd: /s 2).
```

**Bước 4 – MÔ PHỎNG ĐÚNG TÌNH HUỐNG BẠN HỎI: khách thứ 3 nhắn tin XEN VÀO giữa lúc này** (chưa gõ `/s` vội):
```bash
curl -X POST http://localhost:3000/api/v1/public/webchat/sessions -H "Content-Type: application/json" -d '{"tenantCode":"pctech"}'
# duoc SESSION_ID_3 (khach moi)
curl -X POST http://localhost:3000/api/v1/webchat/sessions/SESSION_ID_3/takeover -H "Authorization: Bearer TOKEN"
```

**Bước 5 – Giờ mới gõ lệnh chọn khách số 2 (là khách ở SESSION_ID_2, KHÔNG PHẢI khách mới):**
```
/s 2
```
Bot xác nhận: `✅ Đã chuyển sang trả lời khách số 2...`

**Kết quả cần kiểm chứng:** gõ tin nhắn tự do bất kỳ → **phải gửi đúng cho khách ở SESSION_ID_2** (khách thứ 2 ban đầu), **không bị lệch sang khách mới (SESSION_ID_3)** dù khách đó nhắn tin sau khi bạn đã xem `/ds`. Kiểm tra bằng cách xem lịch sử:
```bash
curl "http://localhost:3000/api/v1/public/webchat/sessions/SESSION_ID_2/history"
```
Tin nhắn vừa gõ trên Telegram phải xuất hiện ở đây, **không** xuất hiện ở lịch sử của `SESSION_ID_3`.

**Bước 6 – Muốn trả lời khách mới (số 3), phải gõ `/ds` lại để cập nhật danh sách trước:**
```
/ds
```
Lần này danh sách sẽ có đủ 3 khách, `/s 3` mới trỏ đúng đến khách mới.

### Cập nhật quan trọng: KHÔNG cần gõ `/ds` trước nữa + Tự động dịch qua Telegram

Sau phản hồi của bạn, mình đã nâng cấp thêm 2 điểm:

**1. Số thứ tự giờ CỐ ĐỊNH (giống số vé xếp hàng), không cần xem `/ds` trước:**
- Số được gán **1 lần duy nhất** ngay lúc `takeover` (không phải vị trí trong danh sách tại 1 thời điểm)
- Cảnh báo 15 giây **tự hiện sẵn số** — gõ `/s <số>` ngay, không cần `/ds` trước nữa
- `/ds` giờ chỉ là lệnh xem lại **tùy chọn**, không bắt buộc

**Test nhanh:**
```bash
# Tao 2 phien, takeover ca 2
curl -X POST http://localhost:3000/api/v1/webchat/sessions/SESSION_ID_1/takeover -H "Authorization: Bearer TOKEN"
# -> tra ve queueNumber: 1
curl -X POST http://localhost:3000/api/v1/webchat/sessions/SESSION_ID_2/takeover -H "Authorization: Bearer TOKEN"
# -> tra ve queueNumber: 2
```
Khách ở `SESSION_ID_2` nhắn tin, đợi 15 giây → Telegram nhận cảnh báo:
```
⚠️ Khách số 2 đang chờ phản hồi!
...
👉 Gõ /s 2 để chuyển sang trả lời khách này ngay (không cần xem danh sách trước).
```
Gõ thẳng `/s 2` — **không cần gõ `/ds` trước** — vẫn hoạt động đúng.

**2. Tin nhắn trả lời qua Telegram giờ TỰ ĐỘNG DỊCH** (áp dụng đúng quy tắc đã thống nhất: mặc định bật cho RemoteIT, tắt cho PCTech trừ khi khai báo riêng):

**Test:** tạo phiên webchat cho tenant `remoteit`, khai báo ngôn ngữ khách:
```bash
curl -X POST http://localhost:3000/api/v1/public/webchat/sessions -H "Content-Type: application/json" \
  -d '{"tenantCode":"remoteit","customerLanguage":"en"}'
```
Takeover phiên này, rồi trả lời bằng tiếng Việt qua Telegram (gõ trực tiếp, ví dụ: "Vui lòng khởi động lại router giúp tôi"). Kiểm tra khách nhận được gì:
```bash
curl "http://localhost:3000/api/v1/public/webchat/sessions/SESSION_ID/history"
```
Kết quả mong đợi: khách thấy **bản tiếng Anh đã dịch**, không phải nguyên văn tiếng Việt.

**Nhân viên xem cả 2 bản (để đối chiếu) qua endpoint admin:**
```bash
curl http://localhost:3000/api/v1/webchat/sessions/SESSION_ID -H "Authorization: Bearer TOKEN"
```
Trường `translatedText` trong tin nhắn sẽ hiện bản tiếng Anh, còn `text` vẫn giữ nguyên văn tiếng Việt nhân viên đã gõ.

**Với PCTech (mặc định KHÔNG dịch)** — tạo phiên như bình thường không cần `customerLanguage`, trả lời qua Telegram sẽ giữ nguyên văn, không gọi Claude API (tiết kiệm chi phí, đúng tinh thần "chỉ dịch khi cần").

### Mở rộng Telegram Bridge sang WhatsApp (khách nhắn WhatsApp bằng ngôn ngữ khác)

**Tin quan trọng:** Dịch tự động cho WhatsApp **đã hoạt động sẵn** từ lúc tích hợp WhatsApp (dùng chung `ChatService`/`TranslationService`) — khách nhắn tiếng Anh tự dịch cho nhân viên đọc, nhân viên trả lời tiếng Việt tự dịch ngược gửi qua WhatsApp thật.

**Phần mới bổ sung:** cầu nối Telegram (giành quyền, số thứ tự, cảnh báo 15s) — trước đây chỉ áp dụng AI Chat Website — giờ **áp dụng cho cả WhatsApp**, dùng chung 1 dãy số thứ tự (`/s <số>` hoạt động cho cả 2 loại khách).

**Khác biệt quan trọng:** WhatsApp không có AI tự trả lời trước, nên cần bước **"nhận xử lý" (`/claim`)** trước khi tham gia `/s <số>`.

**Test luồng đầy đủ:**

**Bước 1 – Khách WhatsApp nhắn tin lần đầu** (qua webhook thật, hoặc mô phỏng qua API):
```bash
curl -X POST http://localhost:3000/api/v1/chat/conversations -H "Content-Type: application/json" -H "Authorization: Bearer TOKEN" \
  -d '{"customerId":"CUSTOMER_ID","customerLanguage":"en"}'
```
Với webhook WhatsApp thật, bước này tự động xảy ra khi khách nhắn tin — **tất cả nhân viên đã liên kết Telegram** sẽ nhận ngay:
```
📲 Khách WhatsApp mới nhắn, chưa ai nhận xử lý!

Tin nhắn: "..."

👉 Gõ /claim <mã> để nhận xử lý cuộc hội thoại này.
```

**Bước 2 – Nhân viên gõ lệnh nhận xử lý trên Telegram:**
```
/claim <8_ky_tu_dau_cua_conversation_id>
```
Bot xác nhận: `✅ Đã nhận xử lý, bạn là khách số 1.`

**Bước 3 – Từ giờ dùng chung cơ chế đã test:** gõ tin nhắn tự do → tự động gửi cho đúng khách WhatsApp này; nếu đang xử lý nhiều khách (cả Website lẫn WhatsApp), `/ds` sẽ liệt kê **cả 2 loại** kèm nhãn phân biệt, `/s <số>` chọn đúng khách dù là Website hay WhatsApp.

**Bước 4 – Nếu 15 giây không trả lời, cảnh báo tự động gửi:**
```
⚠️ Khách số 1 (WhatsApp) đang chờ phản hồi!
...
👉 Gõ /s 1 để trả lời ngay.
```

**Kiểm tra dịch hoạt động đúng** — trả lời bằng tiếng Việt qua Telegram, kiểm tra khách WhatsApp thật nhận được bản tiếng Anh đã dịch (giống hệt cách test đã làm ở phần WhatsApp Business API phía trên).

### Cài đặt Zalo OA (khách hàng Việt Nam, chủ yếu PCTech)

**Lưu ý quan trọng:** Zalo OA API của bên thứ ba có thể thay đổi theo thời gian — code đã viết theo tài liệu phổ biến nhất, **bắt buộc kiểm tra lại với tài liệu Zalo Developers mới nhất** trước khi dùng thật, đặc biệt phần xác thực chữ ký (`mac`).

**Bước 1 – Tạo Zalo Official Account + đăng ký ứng dụng:**
1. Vào https://developers.zalo.me, tạo ứng dụng mới, liên kết với 1 Zalo OA
2. Lấy **App Secret** trong phần cài đặt ứng dụng
3. Lấy **OA Access Token** qua luồng OAuth của Zalo (cần refresh định kỳ)

**Bước 2 – Cấu hình `.env`:**
```
ZALO_OA_ACCESS_TOKEN=<access_token>
ZALO_APP_SECRET=<app_secret>
ZALO_TENANT_CODE=pctech
```

**Bước 3 – Đăng ký Webhook URL** trong Zalo Developers Console:
```
https://xxxx.ngrok-free.app/webhooks/zalo
```

**Bước 4 – Test bằng cách nhắn tin thật vào Zalo OA** (từ điện thoại), hoặc mô phỏng qua API — dùng chung toàn bộ cơ chế `/claim`, `/ds`, `/s <số>`, cảnh báo 15s đã test với WhatsApp, chỉ khác: **Zalo mặc định KHÔNG dịch tự động** (khách Việt Nam), trong khi WhatsApp mặc định CÓ dịch (khách quốc tế). Nếu PCTech gặp khách nước ngoài qua Zalo, có thể bật dịch riêng bằng cách gọi `POST /chat/conversations` với `enableAutoTranslate: true` trước khi liên kết webhook (tùy biến thêm nếu cần).

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
