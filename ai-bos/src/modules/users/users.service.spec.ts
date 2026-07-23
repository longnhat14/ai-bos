import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { User, UserRole } from './user.entity';

describe('UsersService - createEmployee (thay the /auth/register da bi xoa)', () => {
  let service: UsersService;
  let userRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((entity) => Promise.resolve({ id: 'user-1', ...entity })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: userRepo }],
    }).compile();

    service = module.get(UsersService);
  });

  it('BAM MAT KHAU truoc khi luu - KHONG BAO GIO luu plain text', async () => {
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.createEmployee('tenant-1', {
      email: 'ktv@pctech.vn',
      password: 'mat-khau-that-123',
      fullName: 'KTV Moi',
      role: UserRole.TECHNICIAN,
    });

    expect(result.passwordHash).toBeDefined();
    expect(result.passwordHash).not.toBe('mat-khau-that-123');
    const isValidHash = await bcrypt.compare('mat-khau-that-123', result.passwordHash);
    expect(isValidHash).toBe(true);
  });

  it('CHAN tao trung email trong CUNG 1 tenant', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'existing-user', email: 'admin@pctech.vn' });

    await expect(
      service.createEmployee('tenant-1', {
        email: 'admin@pctech.vn',
        password: '123456',
        fullName: 'Trung Email',
        role: UserRole.TECHNICIAN,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('luu DUNG role da chon - Admin tao Admin thi phai la Admin, khong bi ha xuong Technician', async () => {
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.createEmployee('tenant-1', {
      email: 'admin2@pctech.vn',
      password: '123456',
      fullName: 'Admin Moi',
      role: UserRole.ADMIN,
    });

    expect(result.role).toBe(UserRole.ADMIN);
  });

  it('luu DUNG role Technician khi duoc chon', async () => {
    userRepo.findOne.mockResolvedValue(null);

    const result = await service.createEmployee('tenant-1', {
      email: 'ktv2@pctech.vn',
      password: '123456',
      fullName: 'KTV Moi 2',
      role: UserRole.TECHNICIAN,
    });

    expect(result.role).toBe(UserRole.TECHNICIAN);
  });
});
