import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';
import { TicketsService } from '../tickets/tickets.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

export interface DispatcherSuggestion {
  technicianId: string;
  fullName: string;
  totalScore: number;
  breakdown: {
    skillScore: number;
    ratingScore: number;
    workloadScore: number;
    locationScore: number;
  };
  isAvailable: boolean;
  openTicketsCount: number;
}

/**
 * AI Dispatcher - Sprint 9.
 *
 * Cong thuc tinh diem (rut gon tu 8 tieu chi ly thuyet xuong 4 tieu chi chinh
 * cho MVP, dung theo dung ke hoach 4 tuan da thong nhat):
 *
 *   Score = skillScore (0-40) + ratingScore (0-20) + workloadScore (0-20) + locationScore (0-20)
 *
 * KTV dang "isAvailable = false" (dang nghi/ban toan bo) bi LOAI HOAN TOAN,
 * khong tinh diem, dung nguyen tac "Nghi -> Loai" da mo ta truoc day.
 *
 * Che do van hanh (Manual/Semi-Auto/Auto) khong nam trong service nay -
 * DispatcherController quyet dinh: endpoint /suggest = Manual/Semi-Auto (chi de xuat),
 * endpoint /auto-assign = Auto (tu dong giao viec cho nguoi diem cao nhat).
 */
@Injectable()
export class DispatcherService {
  constructor(
    private readonly usersService: UsersService,
    private readonly ticketsService: TicketsService,
    private readonly customersService: CustomersService,
  ) {}

  async suggestTechnicians(
    tenantId: string,
    ticketId: string,
    limit = 3,
  ): Promise<DispatcherSuggestion[]> {
    const ticket = await this.ticketsService.findOne(tenantId, ticketId);
    const customer = await this.customersService.findOne(tenantId, ticket.customerId);
    const technicians = await this.usersService.findTechnicians(tenantId);

    // Loai ngay tu dau nhung KTV dang khong ranh - khong tinh diem cho ho
    // Va loai luon KTV ONSITE khac quoc gia voi khach - ve mat vat ly khong the giao viec
    // (Remote Engineer thi khong bi loai o day, du khac quoc gia van co the ho tro tu xa)
    const eligibleTechnicians = technicians.filter((t) => {
      if (!t.isAvailable) return false;
      if (!t.isRemote && t.country && customer.country && t.country !== customer.country) {
        return false;
      }
      return true;
    });

    const suggestions = await Promise.all(
      eligibleTechnicians.map(async (tech) => {
        const openTicketsCount = await this.ticketsService.countOpenTicketsByTechnician(
          tenantId,
          tech.id,
        );

        const skillScore = this.calculateSkillScore(tech, ticket.skillRequired);
        const ratingScore = this.calculateRatingScore(tech);
        const workloadScore = this.calculateWorkloadScore(openTicketsCount);
        const locationScore = this.calculateLocationScore(tech, customer);

        return {
          technicianId: tech.id,
          fullName: tech.fullName,
          totalScore: skillScore + ratingScore + workloadScore + locationScore,
          breakdown: { skillScore, ratingScore, workloadScore, locationScore },
          isAvailable: tech.isAvailable,
          openTicketsCount,
        };
      }),
    );

    return suggestions.sort((a, b) => b.totalScore - a.totalScore).slice(0, limit);
  }

  /**
   * Che do AUTO: tu dong giao ticket cho KTV diem cao nhat.
   * Theo nguyen tac da thong nhat, KHONG nen goi ham nay tu dong ngay khi tao ticket -
   * chi nen goi khi Admin/he thong da cau hinh muc nguong tin cay ro rang (de sau).
   */
  async autoAssign(tenantId: string, ticketId: string): Promise<DispatcherSuggestion> {
    const suggestions = await this.suggestTechnicians(tenantId, ticketId, 1);

    if (suggestions.length === 0) {
      throw new NotFoundException(
        'Khong tim thay ky thuat vien nao dang ranh de tu dong giao viec',
      );
    }

    const topSuggestion = suggestions[0];
    await this.ticketsService.assignTechnician(
      tenantId,
      ticketId,
      { technicianId: topSuggestion.technicianId },
      'ai-dispatcher', // danh dau day la AI tu giao, khong phai nguoi that bam nut
    );

    return topSuggestion;
  }

  private calculateSkillScore(tech: User, skillRequired: string[]): number {
    if (!skillRequired || skillRequired.length === 0) return 20; // khong yeu cau ky nang cu the -> diem trung binh
    if (!tech.skills || tech.skills.length === 0) return 0;

    const matchedLevels = skillRequired
      .map((required) => tech.skills.find((s) => s.skill === required)?.level || 0)
      .filter((level) => level > 0);

    if (matchedLevels.length === 0) return 0; // khong co ky nang nao khop -> loai gan nhu hoan toan

    const avgLevel = matchedLevels.reduce((sum, l) => sum + l, 0) / matchedLevels.length;
    return Math.round((avgLevel / 5) * 40); // level 1-5 -> 0-40 diem
  }

  private calculateRatingScore(tech: User): number {
    return Math.round((Number(tech.rating) / 5) * 20); // rating 0-5 -> 0-20 diem
  }

  private calculateWorkloadScore(openTicketsCount: number): number {
    // Cang it ticket dang xu ly, diem cang cao - toi da 20, giam dan, khong am
    return Math.max(0, 20 - openTicketsCount * 4);
  }

  private calculateLocationScore(tech: User, customer: { city?: string; country?: string }): number {
    // Remote Engineer: khong bi rang buoc vi tri vat ly. Cung quoc gia la diem cong nhe
    // (tien lich lam viec/ngon ngu chung), KHONG bat buoc.
    if (tech.isRemote) {
      if (!customer.country || !tech.country) return 15;
      return tech.country === customer.country ? 20 : 15;
    }

    // KTV onsite: BAT BUOC cung quoc gia moi kha thi ve mat vat ly - khac quoc gia = 0 diem
    // (se bi loai khoi de xuat vi diem qua thap, xem them hard-filter o suggestTechnicians)
    if (tech.country && customer.country && tech.country !== customer.country) {
      return 0;
    }

    // Cung quoc gia (hoac thieu du lieu quoc gia) -> xet tiep theo tinh/thanh pho nhu cu
    if (!customer.city || !tech.city) return 10;
    return tech.city.trim().toLowerCase() === customer.city.trim().toLowerCase() ? 20 : 5;
  }
}
