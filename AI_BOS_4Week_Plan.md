# AI BOS – Kế hoạch triển khai Full Scope trong 4 tuần
## (Solo Developer + Claude Code + Freelancer hỗ trợ)

> Ngày lập: 11/07/2026
> Mục tiêu: Chạy được đầy đủ Platform Core + 7 Business Modules + 5 AI Engines + Zalo/OpenClaw trong 4 tuần
> Bản chất: "Chạy được đầy đủ" (functional), không phải "hoàn thiện production" — cần 1 đợt hardening ngắn sau tuần 4 (xem mục 6)

---

## 1. Mô hình lực lượng

| Vai trò | Người phụ trách | Trách nhiệm |
|---|---|---|
| **Kiến trúc + AI Engine + Tích hợp** | Bạn (Nhật Quang) | Thiết kế schema, Event Bus, logic AI Dispatcher/Diagnostic/Pricing, review toàn bộ code |
| **Code generation tốc độ cao** | Claude Code | Sinh CRUD API, schema migration, boilerplate frontend, viết test cơ bản, refactor theo yêu cầu |
| **Freelancer #1 (Frontend)** | Thuê ngoài 4 tuần | Dựng UI các module theo API đã có sẵn (Ticket, CRM, Kho, Invoice, Warranty, Shop, Dashboard) |
| **Freelancer #2 (QA/Integration) — tùy chọn** | Thuê ngoài, part-time tuần 3-4 | Test luồng nghiệp vụ end-to-end, phát hiện lỗi tích hợp sớm |

**Nguyên tắc phân việc:** Bạn không tự tay gõ từng dòng CRUD — dùng Claude Code để sinh khung, bạn review + chỉnh logic nghiệp vụ đặc thù (SLA, công thức tính điểm AI Dispatcher, quy tắc phân quyền). Freelancer chỉ động vào phần đã có API chuẩn, không tự ý đổi schema.

---

## 2. Lộ trình 4 tuần

### TUẦN 1 – Platform Core + Ticket + CRM

**Bạn (với Claude Code):**
- Thiết kế schema database đầy đủ ngay từ đầu (mọi bảng có `tenant_id`)
- Dùng Claude Code sinh nhanh: Auth (JWT), API layer versioned, Event Bus (Redis + BullMQ), Ticket module đầy đủ vòng đời, CRM cơ bản
- Định nghĩa Event Schema chuẩn (`ticket.created`, `ticket.closed`...)
- Deploy lên VPS, cấu hình domain/SSL ngay từ đầu để tránh dồn việc deploy về cuối

**Freelancer #1 (bắt đầu từ giữa tuần khi có API Ticket/CRM):**
- Dựng UI: tạo/xem/cập nhật ticket, hồ sơ khách hàng

**Đầu ra cuối tuần 1:** Đăng nhập được, tạo ticket được, event bắn/nhận qua queue, CRM cơ bản hoạt động.

---

### TUẦN 2 – Kho, Invoice, Warranty, Shop, Dashboard

**Bạn (với Claude Code):**
- Sinh nhanh CRUD cho Kho (tồn kho, nhập/xuất), Invoice (sinh hóa đơn từ event `ticket.closed`, xuất PDF/QR), Warranty (theo dõi hạn, nhắc tự động), Shop (sản phẩm, đơn hàng cơ bản)
- Dashboard: tổng hợp KPI cơ bản qua API/event có sẵn
- Bạn tập trung review: logic trừ kho đúng khi đóng ticket, logic tính hạn bảo hành

**Freelancer #1:**
- Dựng UI cho 5 module trên, song song với backend đang hoàn thiện

**Freelancer #2 (bắt đầu tham gia cuối tuần 2):**
- Bắt đầu test thử luồng: tạo ticket → dùng linh kiện → đóng ticket → hóa đơn tự sinh → kho tự trừ

**Đầu ra cuối tuần 2:** Toàn bộ 7 module chạy được, liên kết qua Event Bus.

---

### TUẦN 3 – 5 AI Engines

Đây là phần **bạn phải trực tiếp làm nhiều nhất** — Claude Code hỗ trợ sinh code gọi API/orchestration, nhưng logic nghiệp vụ AI (tiêu chí, trọng số, prompt) cần bạn quyết định vì gắn chặt với hiểu biết thực tế PCTech/RemoteIT.

- **AI Dispatcher:** 4-5 tiêu chí (chuyên môn, khoảng cách, độ bận, lịch làm việc, đánh giá), chế độ Semi-Auto
- **AI Pricing:** gọi API Kho + bảng giá công sửa → sinh báo giá
- **AI Diagnostic:** thiết kế prompt + đưa dữ liệu SOP hiện có của PCTech vào ngữ cảnh (chưa cần Vector DB phức tạp, có thể dùng context trực tiếp trong 4 tuần đầu)
- **AI Knowledge:** đưa SOP vào pgvector, xây API truy vấn
- **AI Sales:** rule-based gợi ý add-on trước (nhanh hơn nhiều so với AI-based), nâng cấp sau

**Freelancer #1:** Dựng UI hiển thị gợi ý AI Dispatcher, kết quả chẩn đoán, báo giá
**Freelancer #2:** Tiếp tục test tích hợp module cũ + bắt đầu test AI Engine

**Đầu ra cuối tuần 3:** AI Dispatcher gợi ý được KTV, AI Pricing sinh báo giá, AI Diagnostic trả lời chẩn đoán cơ bản.

---

### TUẦN 4 – Zalo/OpenClaw + AI Chat + Ổn định

**Bạn (với Claude Code):**
- OpenClaw Gateway kết nối Zalo Bot API
- Zalo Session Manager + Permission Checker
- 4-5 lệnh Zalo cơ bản: tạo ticket, kiểm tra bảo hành, doanh thu hôm nay, kiểm tra kho
- AI Chat website: tư vấn + kiểm kho + tạo đơn (nếu kịp; nếu không, ưu tiên Zalo trước, AI Chat web đẩy sang đợt hardening)

**Freelancer #2 (tập trung chính tuần này):**
- Test toàn bộ end-to-end: từ tạo ticket đến Zalo, từ AI Dispatcher đến hóa đơn
- Lập danh sách lỗi ưu tiên theo mức độ nghiêm trọng

**Bạn (2-3 ngày cuối):**
- Sửa lỗi nghiêm trọng theo danh sách freelancer QA đưa ra
- Không cố sửa hết mọi lỗi nhỏ — ưu tiên lỗi ảnh hưởng dữ liệu thật (sai hóa đơn, sai tồn kho, sai phân công)

**Đầu ra cuối tuần 4:** Hệ thống chạy đầy đủ phạm vi, đã qua 1 vòng test, sẵn sàng dùng thử thật tại PCTech với giám sát chặt.

---

## 3. Điều kiện để mô hình này khả thi

- Bạn cần **thao tác Claude Code thành thạo** (viết prompt rõ ràng, review code sinh ra nhanh) — nếu chưa quen, tuần 1 sẽ chậm hơn dự kiến vì vừa làm vừa học
- Freelancer #1 cần có kinh nghiệm React/Tailwind sẵn, không cần đào tạo từ đầu
- Bạn phải **review mọi code do Claude Code sinh ra** trước khi merge — không tự động chấp nhận toàn bộ, đặc biệt ở phần Auth, tính tiền, trừ kho

## 4. Rủi ro lớn nhất của kế hoạch 4 tuần này

| Rủi ro | Mức độ | Cách giảm thiểu |
|---|---|---|
| Testing không đủ sâu | **Cao** | Dồn Freelancer #2 vào QA từ tuần 2, không chờ tuần 4 |
| AI Diagnostic/Pricing chưa chính xác vì thiếu dữ liệu thật | Trung bình | Thông báo rõ với KTV đây là "gợi ý", không phải quyết định cuối |
| Logic tính tiền/trừ kho sai do làm nhanh | **Cao** | Bạn tự tay review kỹ riêng phần này, không giao freelancer/Claude Code tự quyết |
| Zalo Bot API có thể có giới hạn/thay đổi chính sách | Trung bình | Kiểm tra tài liệu OpenClaw ngay đầu tuần 4, đừng để sát ngày mới phát hiện vướng |
| Kiệt sức vì tốc độ cao 4 tuần liên tục | Trung bình | Có thể chấp nhận trễ 3-5 ngày nếu cần, còn hơn ép xong đúng hạn nhưng lỗi nhiều |

## 5. Ngân sách bổ sung cho kế hoạch 4 tuần này

| Hạng mục | Chi phí ước tính |
|---|---|
| Freelancer #1 (Frontend, 4 tuần full-time) | Tùy thị trường, tham khảo 8-15 triệu đồng cho 4 tuần tại Việt Nam |
| Freelancer #2 (QA, part-time 2 tuần) | Tham khảo 3-5 triệu đồng |
| Claude Code (API usage tăng do dùng nhiều) | Ước tính 1.5-3 triệu đồng/tháng cho tháng này |
| Hosting + Zalo OA (như bảng chi phí đã tính trước) | ~1-3 triệu đồng/tháng |

*Chi phí freelancer là ước tính tham khảo, có thể chênh lệch tùy nơi bạn tìm và kinh nghiệm cụ thể — nên tự khảo giá trước khi chốt ngân sách.*

## 6. Bắt buộc: đợt "Hardening" sau tuần 4

Đây không phải bước tùy chọn — **cần 1-2 tuần sau đó** để:
- Sửa lỗi phát sinh khi PCTech dùng thật (không phải mọi lỗi phát hiện được trong 4 tuần)
- Tinh chỉnh AI Dispatcher/Diagnostic dựa trên phản hồi thật từ KTV
- Viết thêm test tự động cho các luồng quan trọng (tính tiền, trừ kho, phân quyền)

Không nên bỏ qua bước này chỉ vì "đã xong 4 tuần" — đây là phần quyết định hệ thống có dùng an toàn lâu dài hay không.

---

*Tài liệu này nên lưu tại: `D:\GitHubWorkspace\Ai BOS\AI_BOS_4Week_Plan.md`*
