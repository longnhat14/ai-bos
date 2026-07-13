import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { UserRole } from '../users/user.entity';
import { AdjustStockDto, CreateInventoryItemDto, UpdateInventoryItemDto, UsePartForTicketDto } from './dto/warehouse.dto';
import { WarehouseService } from './warehouse.service';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGE_UPLOAD_DIR = join(process.cwd(), 'uploads', 'warehouse');

@Controller('api/v1/warehouse')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  // Tao linh kien/SKU moi trong kho - CHI Admin (thiet lap danh muc, khong phai viec hang ngay cua KTV)
  @Post('items')
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateInventoryItemDto) {
    return this.warehouseService.create(user.tenantId, dto);
  }

  @Get('items')
  findAll(@CurrentUser() user: JwtPayload) {
    return this.warehouseService.findAll(user.tenantId);
  }

  @Get('items/low-stock')
  findLowStock(@CurrentUser() user: JwtPayload) {
    return this.warehouseService.findLowStock(user.tenantId);
  }

  @Get('items/:id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.warehouseService.findOne(user.tenantId, id);
  }

  // Sua thong tin san pham (ten, don vi, gia, nguong canh bao) - KHAC voi adjust-stock
  // (chi doi so luong ton). CHI Admin - gia ca la thong tin nhay cam.
  @Patch('items/:id')
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.warehouseService.update(user.tenantId, id, dto);
  }

  // Nhap/xuat kho thu cong (vd nhap hang moi ve) - CHI Admin, tranh KTV tu y sua ton kho
  @Patch('items/:id/adjust-stock')
  @Roles(UserRole.ADMIN)
  adjustStock(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.warehouseService.adjustStock(user.tenantId, id, dto);
  }

  // Dung linh kien cho 1 ticket cu the - tru kho ngay lap tuc. Mo cho ca KTV vi day
  // la thao tac hang ngay khi sua chua (khac voi adjust-stock la dieu chinh kho tong the).
  @Post('tickets/:ticketId/parts')
  usePartForTicket(
    @CurrentUser() user: JwtPayload,
    @Param('ticketId') ticketId: string,
    @Body() dto: UsePartForTicketDto,
  ) {
    return this.warehouseService.usePartForTicket(user.tenantId, ticketId, dto);
  }

  @Get('tickets/:ticketId/parts')
  getPartsByTicket(@CurrentUser() user: JwtPayload, @Param('ticketId') ticketId: string) {
    return this.warehouseService.getPartsByTicket(user.tenantId, ticketId);
  }

  // Upload anh minh hoa san pham (co the goi nhieu lan de them nhieu anh) - CHI Admin
  @Post('items/:id/images')
  @Roles(UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: IMAGE_UPLOAD_DIR,
        filename: (_req, file, callback) => {
          callback(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          return callback(new BadRequestException('Chi ho tro anh JPEG/PNG/WEBP/GIF'), false);
        }
        callback(null, true);
      },
    }),
  )
  async uploadImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Khong nhan duoc file');
    return this.warehouseService.addImage(user.tenantId, id, file);
  }

  @Get('items/:id/images')
  getImages(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.warehouseService.getImages(user.tenantId, id);
  }

  @Delete('items/:id/images/:imageId')
  @Roles(UserRole.ADMIN)
  deleteImage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.warehouseService.deleteImage(user.tenantId, id, imageId);
  }

  static getImageUploadDir(): string {
    return IMAGE_UPLOAD_DIR;
  }
}
