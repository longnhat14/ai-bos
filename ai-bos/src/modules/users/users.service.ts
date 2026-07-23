import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { CreateEmployeeDto, UpdateTechnicianProfileDto } from './dto/user.dto';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  /**
   * Tao tai khoan nhan vien moi - THAY THE hoan toan cho AuthService.register()
   * cu (da bi XOA vi la lo hong bao mat: cong khai, ai cung tu chon duoc role=admin).
   * Endpoint goi ham nay BAT BUOC qua RolesGuard(ADMIN) - xem UsersController.
   * KHONG tra ve accessToken (khac dang nhap that su) - day la Admin TAO tai
   * khoan cho NGUOI KHAC, khong phai nguoi do tu dang nhap.
   */
  async createEmployee(tenantId: string, dto: CreateEmployeeDto): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { tenantId, email: dto.email } });
    if (existing) {
      throw new ConflictException('Email da duoc su dung trong tenant nay');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      tenantId,
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      phone: dto.phone,
    });
    return this.userRepo.save(user);
  }

  async findAll(tenantId: string): Promise<User[]> {
    return this.userRepo.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async findTechnicians(tenantId: string): Promise<User[]> {
    return this.userRepo.find({
      where: { tenantId, role: UserRole.TECHNICIAN, isActive: true },
    });
  }

  async findOne(tenantId: string, id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { tenantId, id } });
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user;
  }

  async updateTechnicianProfile(
    tenantId: string,
    id: string,
    dto: UpdateTechnicianProfileDto,
  ): Promise<User> {
    const user = await this.findOne(tenantId, id);

    if (dto.skills !== undefined) user.skills = dto.skills;
    if (dto.city !== undefined) user.city = dto.city;
    if (dto.country !== undefined) user.country = dto.country;
    if (dto.isRemote !== undefined) user.isRemote = dto.isRemote;
    if (dto.isAvailable !== undefined) user.isAvailable = dto.isAvailable;

    await this.userRepo.save(user);
    return user;
  }
}
