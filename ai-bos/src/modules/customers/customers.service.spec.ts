import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { Customer } from './customer.entity';
import { EventBusService } from '../../common/event-bus/event-bus.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let customerRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let eventBus: { publish: jest.Mock };

  beforeEach(async () => {
    customerRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ id: 'cust-1', ...entity })),
    };
    eventBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: getRepositoryToken(Customer), useValue: customerRepo },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get(CustomersService);
  });

  describe('create - tu dong ghep khach hang trung SDT', () => {
    it('tra ve khach hang DA CO neu SDT da ton tai, KHONG tao ban ghi moi', async () => {
      const existingCustomer = { id: 'cust-existing', fullName: 'Khach Cu', phone: '0900000000' };
      customerRepo.findOne.mockResolvedValue(existingCustomer);

      const result = await service.create('tenant-1', {
        fullName: 'Ten Khac',
        phone: '0900000000',
      } as any);

      expect(result).toBe(existingCustomer);
      expect(customerRepo.save).not.toHaveBeenCalled();
    });

    it('tao moi neu SDT chua ton tai', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      const result = await service.create('tenant-1', {
        fullName: 'Khach Moi',
        phone: '0911111111',
      } as any);

      expect(result.fullName).toBe('Khach Moi');
      expect(customerRepo.save).toHaveBeenCalled();
    });
  });

  describe('update - sua thong tin (bao gom SDT)', () => {
    it('CHO PHEP sua SDT sang so MOI chua ai dung', async () => {
      const customer = { id: 'cust-1', tenantId: 'tenant-1', fullName: 'A', phone: '0900000000' };
      customerRepo.findOne
        .mockResolvedValueOnce(customer)
        .mockResolvedValueOnce(null);

      const result = await service.update('tenant-1', 'cust-1', { phone: '0922222222' } as any);

      expect(result.phone).toBe('0922222222');
    });

    it('CHAN sua SDT trung voi khach hang KHAC - bao loi ro rang thay vi loi SQL', async () => {
      const customer = { id: 'cust-1', tenantId: 'tenant-1', fullName: 'A', phone: '0900000000' };
      const otherCustomer = { id: 'cust-2', fullName: 'Khach B', phone: '0933333333' };
      customerRepo.findOne
        .mockResolvedValueOnce(customer)
        .mockResolvedValueOnce(otherCustomer);

      await expect(
        service.update('tenant-1', 'cust-1', { phone: '0933333333' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('KHONG kiem tra trung SDT neu giu nguyen SDT cu (khong doi gi)', async () => {
      const customer = { id: 'cust-1', tenantId: 'tenant-1', fullName: 'A', phone: '0900000000' };
      customerRepo.findOne.mockResolvedValueOnce(customer);

      const result = await service.update('tenant-1', 'cust-1', {
        phone: '0900000000',
        fullName: 'A Moi',
      } as any);

      expect(result.fullName).toBe('A Moi');
      expect(customerRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('bao NotFoundException neu khach hang khong ton tai', async () => {
      customerRepo.findOne.mockResolvedValue(null);

      await expect(service.update('tenant-1', 'khong-ton-tai', {} as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
