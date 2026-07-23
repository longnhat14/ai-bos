import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WarrantyService } from './warranty.service';
import { Warranty, WarrantyStatus } from './warranty.entity';
import { EventBusService } from '../../common/event-bus/event-bus.service';

describe('WarrantyService', () => {
  let service: WarrantyService;
  let warrantyRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(async () => {
    warrantyRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    eventBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarrantyService,
        { provide: getRepositoryToken(Warranty), useValue: warrantyRepo },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get(WarrantyService);
  });

  describe('checkActive - tinh so ngay con lai theo thoi gian thuc', () => {
    it('bao CON HIEU LUC neu ngay het han o TUONG LAI', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      warrantyRepo.findOne.mockResolvedValue({
        id: 'w-1',
        status: WarrantyStatus.ACTIVE,
        endDate: futureDate,
      });

      const result = await service.checkActive('tenant-1', 'ticket-1');

      expect(result.isActive).toBe(true);
      expect(result.daysRemaining).toBeGreaterThan(0);
      expect(result.daysRemaining).toBeLessThanOrEqual(30);
    });

    it('bao HET HAN neu ngay het han o QUA KHU, DU truong status van la "active"', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      warrantyRepo.findOne.mockResolvedValue({
        id: 'w-1',
        status: WarrantyStatus.ACTIVE,
        endDate: pastDate,
      });

      const result = await service.checkActive('tenant-1', 'ticket-1');

      expect(result.isActive).toBe(false);
      expect(result.daysRemaining).toBe(0);
    });

    it('bao KHONG HIEU LUC ngay lap tuc neu da bi huy (voided), bat ke ngay het han', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      warrantyRepo.findOne.mockResolvedValue({
        id: 'w-1',
        status: WarrantyStatus.VOIDED,
        endDate: futureDate,
      });

      const result = await service.checkActive('tenant-1', 'ticket-1');

      expect(result.isActive).toBe(false);
      expect(result.daysRemaining).toBe(0);
    });
  });

  describe('createFromTicket - chan tao trung', () => {
    it('KHONG tao trung neu ticket DA CO bao hanh roi', async () => {
      const existing = { id: 'w-existing', ticketId: 'ticket-1' };
      warrantyRepo.findOne.mockResolvedValue(existing);

      const result = await service.createFromTicket('tenant-1', 'ticket-1', 'cust-1');

      expect(result).toBe(existing);
      expect(warrantyRepo.save).not.toHaveBeenCalled();
    });

    it('tinh dung ngay het han theo so thang bao hanh truyen vao', async () => {
      warrantyRepo.findOne.mockResolvedValue(null);

      const result = await service.createFromTicket(
        'tenant-1',
        'ticket-1',
        'cust-1',
        'laptop',
        'Dell XPS',
        6,
      );

      const monthsDiff =
        (result.endDate.getFullYear() - result.startDate.getFullYear()) * 12 +
        (result.endDate.getMonth() - result.startDate.getMonth());
      expect(monthsDiff).toBe(6);
      expect(result.status).toBe(WarrantyStatus.ACTIVE);
    });
  });

  describe('voidWarranty', () => {
    it('doi status sang VOIDED va luu ly do', async () => {
      warrantyRepo.findOne.mockResolvedValue({
        id: 'w-1',
        status: WarrantyStatus.ACTIVE,
      });

      const result = await service.voidWarranty('tenant-1', 'w-1', { reason: 'Khach tu thao may' } as any);

      expect(result.status).toBe(WarrantyStatus.VOIDED);
      expect(result.notes).toBe('Khach tu thao may');
    });
  });
});
