-- ============================================================
-- AI BOS - Database Schema - Tuan 1: Platform Core + Ticket + CRM
-- Nguyen tac: moi bang co tenant_id de san sang cho multi-tenant (Giai doan 4)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- TENANTS (chuan bi cho SaaS sau nay; hien tai chi co 1 tenant: pctech)
-- ------------------------------------------------------------
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,          -- vd: 'pctech', 'remoteit'
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- USERS (Admin, Technician - 2 vai tro cho MVP tuan 1)
-- ------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'technician', -- 'admin' | 'technician'
    phone VARCHAR(30),
    -- cac truong phuc vu AI Dispatcher sau nay (Giai doan 3), tao san de khong phai migrate lai
    skills JSONB DEFAULT '[]',                 -- vd: [{"skill": "mainboard", "level": 5}]
    is_available BOOLEAN NOT NULL DEFAULT true,
    rating NUMERIC(3,2) DEFAULT 5.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

-- ------------------------------------------------------------
-- CUSTOMERS (CRM toi gian - Tuan 1, se mo rong Sprint 5)
-- ------------------------------------------------------------
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),                          -- phuc vu AI Dispatcher (khoang cach) sau nay
    notes TEXT,
    customer_score NUMERIC(5,2) DEFAULT 0,       -- Customer Score, tinh toan o Sprint 5
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, phone)
);

-- ------------------------------------------------------------
-- TICKETS (module loi - uu tien so 1)
-- ------------------------------------------------------------
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    ticket_code VARCHAR(30) NOT NULL,            -- vd: 'PCT-2026-0001', sinh tu dong
    customer_id UUID NOT NULL REFERENCES customers(id),
    assigned_technician_id UUID REFERENCES users(id),

    issue_description TEXT NOT NULL,             -- mo ta loi khach cung cap
    device_type VARCHAR(100),                     -- vd: 'laptop', 'desktop', 'printer'
    device_model VARCHAR(255),

    status VARCHAR(30) NOT NULL DEFAULT 'received',
    -- 'received' -> 'diagnosing' -> 'quoted' -> 'confirmed' -> 'repairing' -> 'testing' -> 'closed' -> 'cancelled'

    priority VARCHAR(20) DEFAULT 'normal',        -- 'low' | 'normal' | 'high' | 'urgent'
    skill_required JSONB DEFAULT '[]',            -- vd: ["mainboard"], phuc vu AI Dispatcher

    quoted_price NUMERIC(12,2),
    final_price NUMERIC(12,2),

    sla_due_at TIMESTAMPTZ,                        -- han xu ly du kien

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,

    UNIQUE (tenant_id, ticket_code)
);

CREATE INDEX idx_tickets_tenant_status ON tickets(tenant_id, status);
CREATE INDEX idx_tickets_technician ON tickets(assigned_technician_id);

-- ------------------------------------------------------------
-- TICKET ATTACHMENTS (anh loi dinh kem)
-- ------------------------------------------------------------
CREATE TABLE ticket_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- TICKET STATUS HISTORY (audit trail vong doi ticket)
-- ------------------------------------------------------------
CREATE TABLE ticket_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by UUID REFERENCES users(id),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- EVENT LOG (Outbox pattern cho Business Event Bus)
-- Moi hanh dong quan trong ghi vao day truoc khi ban qua Redis/BullMQ,
-- dam bao khong mat event neu queue loi.
-- ------------------------------------------------------------
CREATE TABLE event_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    event_type VARCHAR(100) NOT NULL,             -- vd: 'ticket.created', 'ticket.closed'
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'published' | 'failed'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ
);

CREATE INDEX idx_event_log_status ON event_log(status);

-- ------------------------------------------------------------
-- SEED: tenant mac dinh cho PCTech
-- ------------------------------------------------------------
INSERT INTO tenants (code, name) VALUES ('pctech', 'PCTech Computer Repair');
