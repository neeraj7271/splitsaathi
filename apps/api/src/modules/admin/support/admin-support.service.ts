import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AdminSupportTicketEntity,
  AdminSupportMessageEntity,
  ImportJobEntity,
  ExportJobEntity,
  SupportSenderType
} from '@splitsaathi/db';

export interface TicketQuery {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
}

@Injectable()
export class AdminSupportService {
  constructor(
    @InjectRepository(AdminSupportTicketEntity)
    private readonly ticketRepo: Repository<AdminSupportTicketEntity>,
    @InjectRepository(AdminSupportMessageEntity)
    private readonly messageRepo: Repository<AdminSupportMessageEntity>,
    @InjectRepository(ImportJobEntity)
    private readonly importJobRepo: Repository<ImportJobEntity>,
    @InjectRepository(ExportJobEntity)
    private readonly exportJobRepo: Repository<ExportJobEntity>
  ) {}

  async listTickets(query: TicketQuery) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const qb = this.ticketRepo.createQueryBuilder('t')
      .orderBy('t.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    }
    if (query.priority) {
      qb.andWhere('t.priority = :priority', { priority: query.priority });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getTicketDetail(ticketId: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    const messages = await this.messageRepo.find({
      where: { ticketId },
      order: { createdAt: 'ASC' }
    });

    return {
      ticket,
      messages
    };
  }

  async replyTicket(ticketId: string, senderId: string, body: string, senderType: SupportSenderType = 'admin') {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    const message = this.messageRepo.create({
      ticketId,
      senderType,
      senderId,
      body
    });
    await this.messageRepo.save(message);

    if (ticket.status === 'open') {
      ticket.status = 'in_progress';
      await this.ticketRepo.save(ticket);
    }

    return message;
  }

  async updateTicketStatus(ticketId: string, status: any) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    ticket.status = status;
    await this.ticketRepo.save(ticket);
    return ticket;
  }

  async listImportExportJobs() {
    const imports = await this.importJobRepo.find({ order: { createdAt: 'DESC' }, take: 50 });
    const exports = await this.exportJobRepo.find({ order: { createdAt: 'DESC' }, take: 50 });

    return {
      imports: imports.map((i) => ({
        id: i.id,
        type: 'import',
        source: i.source,
        state: i.state,
        createdAt: i.createdAt.toISOString()
      })),
      exports: exports.map((e) => ({
        id: e.id,
        type: 'export',
        exportType: e.exportType,
        state: e.state,
        createdAt: e.createdAt.toISOString()
      }))
    };
  }

  async retryJob(jobId: string, type: 'import' | 'export') {
    if (type === 'import') {
      const job = await this.importJobRepo.findOne({ where: { id: jobId } });
      if (!job) throw new NotFoundException('Import job not found.');
      job.state = 'uploaded';
      await this.importJobRepo.save(job);
      return { success: true, message: 'Import job reset to uploaded queue for reprocessing.' };
    } else {
      const job = await this.exportJobRepo.findOne({ where: { id: jobId } });
      if (!job) throw new NotFoundException('Export job not found.');
      job.state = 'queued';
      await this.exportJobRepo.save(job);
      return { success: true, message: 'Export job re-queued for processing.' };
    }
  }
}
