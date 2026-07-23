import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { Ticket, TicketStatus } from './ticket.entity';
import { TicketStatusHistory } from './ticket-status-history.entity';
import { EventBusService } from '../../common/event-bus/event-bus.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketRepo: { findOne: jest.Mock; save: jest.Mock };
  let historyRepo: { create: jest.Mock; save: jest.Mock };
  let eventBus: { publish: jest.Mock };

  function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
    return {
      id: 'ticket-1',
      tenantId: 'tenant-1',
      ticketCode: 'PCT-2026-0001',
      status: TicketStatus.RECEIVED,
      quotedPrice: null,
      finalPrice: null,
      closedAt: null,
      ...overrides,
    } as Ticket;
  }

  beforeEach(async () => {
    ticketRepo = {
      findOne: jest.fn(),
      save: jest.fn((ticket) => Promise.resolve(ticket)),
    };
    historyRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(() => Promise.resolve({})),
    };
    eventBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: getRepositoryToken(TicketStatusHistory), useValue: historyRepo },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get(TicketsService);
  });

  describe('updateStatus - quy tac chuyen trang thai', () => {
    it('CHO PHEP chuyen dung buoc: received -> diagnosing', async () => {
      ticketRepo.findOne.mockResolvedValue(makeTicket({ status: TicketStatus.RECEIVED }));

      const result = await service.updateStatus(
        'tenant-1',
        'ticket-1',
        { status: TicketStatus.DIAGNOSING } as any,
        'staff-1',
      );

      expect(result.status).toBe(TicketStatus.DIAGNOSING);
    });

    it('CHAN nhay buoc: khong the tu received sang confirmed (bo qua diagnosing/quoted)', async () => {
      ticketRepo.findOne.mockResolvedValue(makeTicket({ status: TicketStatus.RECEIVED }));

      await expect(
        service.updateStatus('tenant-1', 'ticket-1', { status: TicketStatus.CONFIRMED } as any, 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('CHAN chuyen tiep tu trang thai da ket thuc (closed khong the chuyen di dau nua)', async () => {
      ticketRepo.findOne.mockResolvedValue(makeTicket({ status: TicketStatus.CLOSED }));

      await expect(
        service.updateStatus('tenant-1', 'ticket-1', { status: TicketStatus.DIAGNOSING } as any, 'staff-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('khi dong ticket (closed) TU DONG lay finalPrice tu quotedPrice neu chua tung bao gia rieng', async () => {
      ticketRepo.findOne.mockResolvedValue(
        makeTicket({ status: TicketStatus.TESTING, quotedPrice: 500000, finalPrice: null }),
      );

      const result = await service.updateStatus(
        'tenant-1',
        'ticket-1',
        { status: TicketStatus.CLOSED } as any,
        'staff-1',
      );

      expect(result.finalPrice).toBe(500000);
      expect(result.closedAt).toBeInstanceOf(Date);
    });

    it('KHONG ghi de finalPrice neu da duoc thiet lap rieng truoc do', async () => {
      ticketRepo.findOne.mockResolvedValue(
        makeTicket({ status: TicketStatus.TESTING, quotedPrice: 500000, finalPrice: 450000 }),
      );

      const result = await service.updateStatus(
        'tenant-1',
        'ticket-1',
        { status: TicketStatus.CLOSED } as any,
        'staff-1',
      );

      expect(result.finalPrice).toBe(450000);
    });

    it('bao loi NotFoundException neu ticket khong ton tai', async () => {
      ticketRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('tenant-1', 'khong-ton-tai', { status: TicketStatus.DIAGNOSING } as any, 'staff-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setFinalPrice', () => {
    it('cap nhat finalPrice ma KHONG dong trang thai (dung khi tao hoa don thu cong)', async () => {
      ticketRepo.findOne.mockResolvedValue(makeTicket({ status: TicketStatus.CLOSED, finalPrice: null }));

      const result = await service.setFinalPrice('tenant-1', 'ticket-1', 750000);

      expect(result.finalPrice).toBe(750000);
      expect(result.status).toBe(TicketStatus.CLOSED);
    });
  });
});
