-- ============================================================
-- AI BOS - Database Schema - Tuan 1: Platform Core + Ticket + CRM
-- Phien ban: MariaDB (chuyen doi tu PostgreSQL de khop voi hosting)
-- Nguyen tac: moi bang co tenant_id de san sang cho multi-tenant (Giai doan 4)
--
-- LUU Y QUAN TRONG:
-- File nay CHI dung khi import thu cong len hosting production that (khong dung Docker).
-- O moi truong dev local (qua docker-compose), TypeORM tu tao schema qua "synchronize: true"
-- (xem app.module.ts) - KHONG chay file nay cung luc voi synchronize, se bi xung dot
-- (loi "Foreign key constraint is incorrectly formed" khi TypeORM co gang sua lai schema).
--
-- Yeu cau: MariaDB 10.7+ (de dung DEFAULT (UUID()) cho primary key).
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- TENANTS (chuan bi cho SaaS sau nay; hien tai chi co 1 tenant: pctech)
-- ------------------------------------------------------------
CREATE TABLE tenants (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    code VARCHAR(50) UNIQUE NOT NULL,          -- vd: 'pctech', 'remoteit'
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- USERS (Admin, Technician - 2 vai tro cho MVP tuan 1)
-- ------------------------------------------------------------
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'technician', -- 'admin' | 'technician'
    phone VARCHAR(30),
    -- cac truong phuc vu AI Dispatcher sau nay (Giai doan 3), tao san de khong phai migrate lai
    skills JSON DEFAULT NULL,                   -- vd: [{"skill": "mainboard", "level": 5}]
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    rating DECIMAL(3,2) DEFAULT 5.0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_tenant_email (tenant_id, email),
    CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- CUSTOMERS (CRM toi gian - Tuan 1, se mo rong Sprint 5)
-- ------------------------------------------------------------
CREATE TABLE customers (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),                          -- phuc vu AI Dispatcher (khoang cach) sau nay
    notes TEXT,
    customer_score DECIMAL(5,2) DEFAULT 0,       -- Customer Score, tinh toan o Sprint 5
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_customers_tenant_phone (tenant_id, phone),
    CONSTRAINT fk_customers_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TICKETS (module loi - uu tien so 1)
-- ------------------------------------------------------------
CREATE TABLE tickets (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    ticket_code VARCHAR(30) NOT NULL,            -- vd: 'PCT-2026-0001', sinh tu dong
    customer_id CHAR(36) NOT NULL,
    assigned_technician_id CHAR(36),

    issue_description TEXT NOT NULL,             -- mo ta loi khach cung cap
    device_type VARCHAR(100),                     -- vd: 'laptop', 'desktop', 'printer'
    device_model VARCHAR(255),

    status VARCHAR(30) NOT NULL DEFAULT 'received',
    -- 'received' -> 'diagnosing' -> 'quoted' -> 'confirmed' -> 'repairing' -> 'testing' -> 'closed' -> 'cancelled'

    priority VARCHAR(20) DEFAULT 'normal',        -- 'low' | 'normal' | 'high' | 'urgent'
    skill_required JSON DEFAULT NULL,             -- vd: ["mainboard"], phuc vu AI Dispatcher

    quoted_price DECIMAL(12,2),
    final_price DECIMAL(12,2),

    sla_due_at DATETIME,                           -- han xu ly du kien

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    closed_at DATETIME,

    UNIQUE KEY uq_tickets_tenant_code (tenant_id, ticket_code),
    CONSTRAINT fk_tickets_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_tickets_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_tickets_technician FOREIGN KEY (assigned_technician_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_tickets_tenant_status ON tickets(tenant_id, status);
CREATE INDEX idx_tickets_technician ON tickets(assigned_technician_id);

-- ------------------------------------------------------------
-- TICKET ATTACHMENTS (anh loi dinh kem)
-- ------------------------------------------------------------
CREATE TABLE ticket_attachments (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    ticket_id CHAR(36) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    uploaded_by CHAR(36),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attachments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_attachments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_attachments_user FOREIGN KEY (uploaded_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TICKET STATUS HISTORY (audit trail vong doi ticket)
-- ------------------------------------------------------------
CREATE TABLE ticket_status_history (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    ticket_id CHAR(36) NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by CHAR(36),
    note TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_history_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- EVENT LOG (Outbox pattern cho Business Event Bus)
-- Moi hanh dong quan trong ghi vao day truoc khi ban qua Redis/BullMQ,
-- dam bao khong mat event neu queue loi.
-- ------------------------------------------------------------
CREATE TABLE event_log (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    event_type VARCHAR(100) NOT NULL,             -- vd: 'ticket.created', 'ticket.closed'
    payload JSON NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'published' | 'failed'
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME,
    CONSTRAINT fk_eventlog_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_event_log_status ON event_log(status);

-- ------------------------------------------------------------
-- SEED: tenant mac dinh cho PCTech
-- ------------------------------------------------------------
INSERT INTO tenants (code, name) VALUES ('pctech', 'PCTech Computer Repair');

-- ============================================================
-- GHI CHU: neu hosting dung MariaDB cu hon 10.7 (khong ho tro DEFAULT (UUID())):
-- 1. Bo phan "DEFAULT (UUID())" o moi bang
-- 2. TypeORM van tu sinh UUID o tang ung dung (khong phu thuoc DB function),
--    nen ung dung NestJS van hoat dong binh thuong.
-- 3. Rieng dong INSERT seed tenant cuoi file, can sua thanh:
--    INSERT INTO tenants (id, code, name) VALUES (UUID(), 'pctech', 'PCTech Computer Repair');
-- ============================================================
