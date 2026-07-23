import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateEmployeeDto, UpdateTechnicianProfileDto } from './dto/user.dto';
import { UserRole } from './user.entity';
import { UsersService } from './users.service';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Tao tai khoan nhan vien moi (Admin hoac Technician) - CHI Admin duoc goi.
  // Day la endpoint DUY NHAT con lai de tao tai khoan trong he thong - thay
  // the hoan toan cho POST /auth/register cu (da XOA vi la lo hong bao mat).
  @Post()
  @Roles(UserRole.ADMIN)
  createEmployee(@CurrentUser() user: JwtPayload, @Body() dto: CreateEmployeeDto) {
    return this.usersService.createEmployee(user.tenantId, dto);
  }

  // Danh sach TOAN BO nhan vien (ca Admin lan Technician) - dung cho trang
  // quan ly nhan vien o Frontend. CHI Admin xem duoc (giong logic tai chinh khac).
  @Get()
  @Roles(UserRole.ADMIN)
  findAll(@CurrentUser() user: JwtPayload) {
    return this.usersService.findAll(user.tenantId);
  }

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
