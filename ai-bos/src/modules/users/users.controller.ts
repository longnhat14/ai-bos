import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UpdateTechnicianProfileDto } from './dto/user.dto';
import { UserRole } from './user.entity';
import { UsersService } from './users.service';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('technicians')
  findTechnicians(@CurrentUser() user: JwtPayload) {
    return this.usersService.findTechnicians(user.tenantId);
  }

  // Cap nhat ky nang/khu vuc/tinh trang ranh-ban cua ky thuat vien - AI Dispatcher se dung du lieu nay.
  // CHI Admin duoc sua (tranh 1 KTV tu y sua rating/skill cua KTV khac de gianh viec).
  @Patch(':id/profile')
  @Roles(UserRole.ADMIN)
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTechnicianProfileDto,
  ) {
    return this.usersService.updateTechnicianProfile(user.tenantId, id, dto);
  }
}
