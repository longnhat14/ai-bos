import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';

export class ConfirmDiagnosisDto {
  // Ky thuat vien xac nhan nguyen nhan NAO trong danh sach AI de xuat la dung thuc te
  @IsInt()
  @Min(0)
  confirmedCauseIndex: number;

  @IsNotEmpty()
  actualFindingNote: string; // ghi chu thuc te KTV tim thay, dua vao noi dung SOP moi
}
