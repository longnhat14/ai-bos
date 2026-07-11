# AI BOS – AI Business Operating System

> Tài liệu tổng quan dự án
> Ngày cập nhật: 07/07/2026

---

## 1. Tầm nhìn dự án

AI BOS không được thiết kế theo mô hình truyền thống:

```
Website → CRM → AI
```

mà theo tư duy ngược lại:

```
AI Business OS → Website chỉ là một giao diện (UI)
```

AI BOS là một **nền tảng vận hành doanh nghiệp bằng AI (AI Business Operating System)**, ban đầu triển khai cho **PCTech** và **RemoteIT** (các doanh nghiệp sửa chữa máy tính / dịch vụ IT), với định hướng phát triển dài hạn thành nền tảng **SaaS đa doanh nghiệp (multi-tenant)** có thể thương mại hóa cho:

- PCTech
- RemoteIT
- Các cửa hàng máy tính
- Trung tâm sửa chữa
- Doanh nghiệp dịch vụ IT
- Và các lĩnh vực khác (bằng cách thêm/thay module nghiệp vụ)

---

## 2. Kiến trúc tổng thể

```
                         AI Business OS
                                │
 ┌──────────────────────────────┼──────────────────────────────┐
 │                              │                              │
 ▼                              ▼                              ▼
Website                     Mobile App                  AI Chat
 │                              │                              │
 └───────────────► Business Core Platform ◄────────────────────┘
                               │
      ┌────────────────────────┼────────────────────────┐
      ▼                        ▼                        ▼
    CRM                      ERP                     Ticket
      ▼                        ▼                        ▼
    Shop                     Kho                  Warranty
      ▼                        ▼                        ▼
   Invoice               AI Dispatcher         Dashboard
```

### Business Event Bus

Thay vì các module gọi trực tiếp lẫn nhau, mọi thao tác được phát ra dưới dạng **sự kiện (event)**, giúp:

- Các module độc lập, dễ bảo trì
- Dễ thêm tính năng mới mà không cần sửa nhiều nơi
- Dễ mở rộng sang nhiều ứng dụng / nhiều khách hàng SaaS

**Ví dụ luồng sự kiện:**

```
Order Created → AI → Invoice Engine → QR Engine → PDF Engine → Notification Engine → Dashboard
```

```
Ticket Closed → Warranty Engine → CRM → Customer Score → AI Follow-up → Email → Zalo
```

---

## 3. Các module nghiệp vụ cốt lõi

| Module | Chức năng |
|---|---|
| **CRM** | Quản lý khách hàng |
| **ERP** | Vận hành nội bộ |
| **Shop** | Bán hàng, sản phẩm |
| **Ticket** | Xử lý yêu cầu sửa chữa |
| **Kho (Warehouse)** | Quản lý tồn kho |
| **Invoice** | Hóa đơn |
| **Warranty** | Bảo hành |
| **Dashboard** | Báo cáo, giám sát tổng thể |

---

## 4. Các AI Engine

### 4.1. AI Dispatcher Engine ⭐⭐⭐⭐⭐
"Bộ não điều phối" — quyết định giao việc cho kỹ thuật viên nào, khi nào, mức ưu tiên, có cần chuyển người hay không.

**Luồng xử lý:**
```
Ticket mới → AI Dispatcher
  ├── Phân tích yêu cầu
  ├── Xác định kỹ năng
  ├── Xác định vị trí
  ├── Kiểm tra SLA
  ├── Tính điểm kỹ thuật viên
  ├── Đề xuất 3 ứng viên tốt nhất
  ├── (Tùy chọn) Tự động giao việc nếu đạt ngưỡng tin cậy
  └── Theo dõi tiến độ và điều chỉnh nếu cần
```

**Các tiêu chí xét chọn kỹ thuật viên:**
1. Quốc gia (ưu tiên KTV cùng nước, hoặc Remote Engineer nếu khác nước)
2. Tỉnh/Thành phố (ưu tiên khu vực gần)
3. Khoảng cách địa lý
4. Chuyên môn / kỹ năng phù hợp với loại sự cố
5. Độ bận (số ticket đang xử lý) — cân bằng tải công việc
6. Lịch làm việc (đang rảnh / đang bận / nghỉ)
7. Đánh giá (rating) từ khách hàng
8. Kinh nghiệm (số ca đã xử lý theo từng loại lỗi)

**Công thức tính điểm (ví dụ):**
```
Score = Distance + Skill + Rating + Experience + Availability + Workload + Language + Priority
```
Mỗi tiêu chí có trọng số riêng.

**3 chế độ vận hành:**
- **Manual**: AI chỉ gợi ý, quản lý quyết định
- **Semi-Auto**: AI đề xuất, quản lý chỉ cần xác nhận
- **Auto**: AI tự động giao việc nếu đạt ngưỡng tin cậy đã cấu hình

**Hồ sơ kỹ thuật viên (dữ liệu cần lưu):**
ID, Country, City, Latitude, Longitude, Languages, Skills, Certificates, Timezone, Working Hours, Online Status, Current Tickets, Rating, Completed Jobs

**Ứng dụng cho RemoteIT (ví dụ):**
```
Khách hàng (Singapore) → Ticket: Microsoft 365 → AI phân tích
→ Không cần kỹ thuật onsite → Chọn Remote Engineer
→ Ngôn ngữ: English, Múi giờ: UTC+8 → Phân công → Gửi link họp → Bắt đầu hỗ trợ
```

### 4.2. AI Pricing Engine ⭐⭐⭐⭐⭐
Tự động sinh báo giá dựa trên: database dịch vụ, tồn kho, giá nhập, công sửa.

*Ví dụ: khách hỏi "Thay màn hình Dell Latitude 7420" → AI tra cứu và sinh báo giá tự động.*

### 4.3. AI Diagnostic Engine ⭐⭐⭐⭐⭐
Chẩn đoán lỗi dựa trên triệu chứng khách mô tả, đưa ra xác suất nguyên nhân để kỹ thuật viên chuẩn bị linh kiện trước.

*Ví dụ: "Máy bật không lên" → RAM 90%, Nguồn 6%, Main 2%, CPU 2%.*

### 4.4. AI Sales Engine ⭐⭐⭐⭐⭐
Gợi ý dịch vụ/sản phẩm cộng thêm (add-on upsell) dựa trên đơn hàng của khách.

*Ví dụ: khách mua SSD → AI gợi ý cài Windows, Office, Antivirus, sao lưu dữ liệu, vệ sinh máy.*

### 4.5. AI Knowledge Engine ⭐⭐⭐⭐⭐
"Bộ não tri thức" của toàn hệ thống — lưu trữ SOP, quy trình, lỗi thường gặp, hướng dẫn, FAQ, tài liệu kỹ thuật, kinh nghiệm sửa chữa. Các AI Engine khác dựa vào kho tri thức này để trả lời/điều phối thay vì chỉ suy luận từ mô hình ngôn ngữ thuần túy.

---

## 5. Lộ trình phát triển (Roadmap)

### Giai đoạn 1 – Platform Core
- Người dùng & phân quyền
- API
- Database
- Event Bus
- Notification
- File Storage

### Giai đoạn 2 – Business Modules
- CRM
- Shop
- Ticket
- Kho
- Hóa đơn
- Bảo hành
- Dashboard

### Giai đoạn 3 – AI Engines
- AI Dispatcher
- AI Diagnostic
- AI Pricing
- AI Sales
- AI Knowledge
- AI Automation

### Giai đoạn 4 – SaaS & Ecosystem
- Multi-tenant
- Mobile App
- Đối tác
- API công khai
- Marketplace
- Billing

---

## 6. Định hướng dài hạn

Nếu xây dựng đúng ngay từ đầu, PCTech Business Platform sẽ không chỉ là hệ thống quản lý nội bộ cho PCTech, mà trở thành một **AI Business Operating System (AI BOS)** có thể triển khai cho nhiều doanh nghiệp khác nhau trong lĩnh vực sửa chữa/dịch vụ IT, và mở rộng sang các lĩnh vực khác chỉ bằng cách thay đổi/bổ sung module nghiệp vụ.

Đây là hướng đi đầu tư xây dựng **một nền tảng phần mềm có thể thương mại hóa**, không chỉ là một website phục vụ nội bộ.

---

*Tài liệu này nên được lưu tại: `D:\GitHubWorkspace\Ai BOS\AI_BOS_Project_Overview.md`*
