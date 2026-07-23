import { UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

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
