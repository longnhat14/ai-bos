import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateTechnicianProfileDto } from './dto/user.dto';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

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
