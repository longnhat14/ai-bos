import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { LoginDto, RegisterDto } from './dto/auth.dto';

// Trong Sprint 1, tam thoi hard-code tenant mac dinh la PCTech.
// Sang Giai doan 4 (multi-tenant), tenantId se lay theo subdomain/header thay vi hard-code.
const DEFAULT_TENANT_CODE = 'pctech';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto, tenantId: string) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email, tenantId } });
    if (existing) {
      throw new ConflictException('Email da duoc su dung trong tenant nay');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      tenantId,
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role ?? UserRole.TECHNICIAN,
      phone: dto.phone,
    });
    await this.userRepo.save(user);

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto, tenantId: string) {
    const user = await this.userRepo.findOne({ where: { email: dto.email, tenantId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Email hoac mat khau khong dung');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Email hoac mat khau khong dung');
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: User) {
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
