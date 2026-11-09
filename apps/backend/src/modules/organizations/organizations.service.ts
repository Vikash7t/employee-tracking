import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateOrganizationInput, OrganizationDto } from '@employee-tracking/contracts';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<OrganizationDto[]> {
    const orgs = await this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return orgs.map(this.mapToDto);
  }

  async findById(id: string): Promise<OrganizationDto> {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return this.mapToDto(org);
  }

  async create(input: CreateOrganizationInput): Promise<OrganizationDto> {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: input.slug },
    });
    if (existing) {
      throw new ConflictException(`Organization slug '${input.slug}' already exists`);
    }

    const created = await this.prisma.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        timezone: input.timezone || 'Asia/Kolkata',
      },
    });

    return this.mapToDto(created);
  }

  private mapToDto(org: any): OrganizationDto {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      timezone: org.timezone,
      isActive: org.isActive,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }
}
