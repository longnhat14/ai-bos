import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateKnowledgeEntryDto, UpdateKnowledgeEntryDto } from './dto/knowledge.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('api/v1/knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Post()
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
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeEntryDto,
  ) {
    return this.knowledgeService.update(user.tenantId, id, dto);
  }
}
