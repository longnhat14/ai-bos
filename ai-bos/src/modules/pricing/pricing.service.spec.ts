import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PriceCatalog } from './price-catalog.entity';
import { TicketsService } from '../tickets/tickets.service';
import { WarehouseService } from '../warehouse/warehouse.service';

describe('PricingService', () => {
  let service: PricingService;
  let catalogRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let ticketsService: { findOne: jest.Mock };
  let warehouseService: { getPartsByTicket: jest.Mock };

  beforeEach(async () => {
    catalogRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ id: 'entry-1', ...entity })),
    };
    ticketsService = { findOne: jest.fn() };
    warehouseService = { getPartsByTicket: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        { provide: getRepositoryToken(PriceCatalog), useValue: catalogRepo },
        { provide: TicketsService, useValue: ticketsService },
        { provide: WarehouseService, useValue: warehouseService },
      ],
    }).compile();

    service = module.get(PricingService);
  });

  describe('createCatalogEntry - chan trung ten dich vu', () => {
    it('CHAN tao trung neu ten dich vu chi khac hoa/thuong ("Mainboard" vs "mainboard")', async () => {
      catalogRepo.find.mockResolvedValue([
        { skillCode: 'mainboard', description: 'Sua mainboard', laborPrice: 300000, isActive: true },
      ]);

      await expect(
        service.createCatalogEntry('tenant-1', {
          skillCode: 'Mainboard',
          description: 'Sua mainboard 2',
          laborPrice: 400000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('CHAN tao trung neu chi khac khoang trang (" Main Board " vs "main board")', async () => {
      catalogRepo.find.mockResolvedValue([
        { skillCode: 'main board', description: 'Sua mainboard', laborPrice: 300000, isActive: true },
      ]);

      await expect(
        service.createCatalogEntry('tenant-1', {
          skillCode: '  Main   Board  ',
          description: 'Sua mainboard 2',
          laborPrice: 400000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('CHO PHEP tao neu ten dich vu THAT SU khac nhau', async () => {
      catalogRepo.find.mockResolvedValue([
        { skillCode: 'mainboard', description: 'Sua mainboard', laborPrice: 300000, isActive: true },
      ]);

      const result = await service.createCatalogEntry('tenant-1', {
        skillCode: 'ram',
        description: 'Sua RAM',
        laborPrice: 200000,
      });

      expect(result.skillCode).toBe('ram');
    });

    it('luu ten dich vu o dang CHUAN HOA (chu thuong, bo khoang trang thua)', async () => {
      catalogRepo.find.mockResolvedValue([]);

      const result = await service.createCatalogEntry('tenant-1', {
        skillCode: '  Man Hinh  ',
        description: 'Thay man hinh',
        laborPrice: 500000,
      });

      expect(result.skillCode).toBe('man hinh');
    });
  });

  describe('suggestQuote - so khop khong phan biet hoa/thuong/khoang trang', () => {
    it('van khop dung gia du ticket go khac hoa/thuong voi bang gia da luu', async () => {
      ticketsService.findOne.mockResolvedValue({
        id: 'ticket-1',
        skillRequired: ['MainBoard'],
      });
      catalogRepo.find.mockResolvedValue([
        { skillCode: 'mainboard', description: 'Sua mainboard', laborPrice: 300000, isActive: true },
      ]);

      const result = await service.suggestQuote('tenant-1', 'ticket-1');

      expect(result.missingSkills).toEqual([]);
      expect(result.laborTotal).toBe(300000);
      expect(result.laborBreakdown[0].description).toBe('Sua mainboard');
    });

    it('bao THIEU GIA neu dich vu THAT SU chua co trong bang gia (khong phai loi chinh ta)', async () => {
      ticketsService.findOne.mockResolvedValue({
        id: 'ticket-1',
        skillRequired: ['man hinh cam ung'],
      });
      catalogRepo.find.mockResolvedValue([
        { skillCode: 'mainboard', description: 'Sua mainboard', laborPrice: 300000, isActive: true },
      ]);

      const result = await service.suggestQuote('tenant-1', 'ticket-1');

      expect(result.missingSkills).toEqual(['man hinh cam ung']);
      expect(result.laborTotal).toBe(0);
    });

    it('cong dung tong tien cong khi ticket can NHIEU dich vu', async () => {
      ticketsService.findOne.mockResolvedValue({
        id: 'ticket-1',
        skillRequired: ['mainboard', 'ram'],
      });
      catalogRepo.find.mockResolvedValue([
        { skillCode: 'mainboard', description: 'Sua mainboard', laborPrice: 300000, isActive: true },
        { skillCode: 'ram', description: 'Thay RAM', laborPrice: 150000, isActive: true },
      ]);

      const result = await service.suggestQuote('tenant-1', 'ticket-1');

      expect(result.laborTotal).toBe(450000);
      expect(result.suggestedTotal).toBe(450000);
    });
  });
});
