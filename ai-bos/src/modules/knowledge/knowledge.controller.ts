import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../users/user.entity';
import { CreateKnowledgeEntryDto, UpdateKnowledgeEntryDto } from './dto/knowledge.dto';
import { KnowledgeService } from './knowledge.service';

/**
 * Luu y: viec KTV xac nhan chan doan dung (DiagnosticService.confirmDiagnosis)
 * cung goi KnowledgeService.create() nhung goi TRUC TIEP qua service, KHONG qua
 * controller nay - nen gioi han POST/PATCH o day thanh Admin-only KHONG lam
 * gian doan luong "KTV xac nhan -> tu dong nuoi Knowledge Base" da thiet ke.
 */
@Controller('api/v1/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateKnowledgeEntryDto) {
    return this.knowledgeService.create(user.tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.knowledgeService.findAll(user.tenantId);
  }

  @Get('search')
  search(@CurrentUser() user: JwtPayload, @Query('q') query: string) {
    return this.knowledgeService.search(user.tenantId, query || '');
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.knowledgeService.findOne(user.tenantId, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeEntryDto,
  ) {
    return this.knowledgeService.update(user.tenantId, id, dto);
  }
}
