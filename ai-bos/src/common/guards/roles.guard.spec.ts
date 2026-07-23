import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../modules/users/user.entity';

/**
 * Test cho RolesGuard - day la thanh phan BAO MAT QUAN TRONG NHAT sau khi phat
 * hien va va lo hong "POST /auth/register cong khai cho tu chon role=admin".
 * RolesGuard la lop phong thu CUOI CUNG dam bao Technician khong the goi duoc
 * cac endpoint tai chinh/cau hinh (doanh thu, huy bao hanh, sua gia...).
 */
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  function createMockContext(userRole: UserRole | undefined): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: userRole ? { role: userRole } : undefined }),
      }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('cho phep truy cap neu endpoint KHONG khai bao @Roles nao ca (mac dinh mo)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext(UserRole.TECHNICIAN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('CHAN Technician khoi endpoint chi danh cho Admin (vd doanh thu, huy bao hanh)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext(UserRole.TECHNICIAN);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('CHO PHEP Admin truy cap endpoint chi danh cho Admin', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext(UserRole.ADMIN);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('CHAN hoan toan neu khong co user tren request (chua dang nhap/token loi)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    const context = createMockContext(undefined);

    expect(guard.canActivate(context)).toBe(false);
  });

  it('cho phep neu endpoint khai bao NHIEU role va user thuoc 1 trong so do', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN, UserRole.TECHNICIAN]);
    const context = createMockContext(UserRole.TECHNICIAN);

    expect(guard.canActivate(context)).toBe(true);
  });
});
